import os
import re
import fitz


VALID_FIELD_TYPES = {"text", "checkbox", "signature"}


def _safe_field_name(label: str, index: int) -> str:
    safe = re.sub(r"[^A-Za-z0-9_]+", "_", (label or "field").strip())
    safe = re.sub(r"_+", "_", safe).strip("_") or "field"
    return f"fld_{index}_{safe}"[:64]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _clean_fields(raw_fields: list, page_count: int) -> list[dict]:
    cleaned = []
    for i, item in enumerate(raw_fields):
        if not isinstance(item, dict):
            continue

        ftype = str(item.get("type", "text")).strip().lower()
        if ftype not in VALID_FIELD_TYPES:
            ftype = "text"

        try:
            page = int(item.get("page", 1))
            x = float(item.get("x", 0))
            y = float(item.get("y", 0))
            width = float(item.get("width", 0))
            height = float(item.get("height", 0))
        except (TypeError, ValueError):
            continue

        label = str(item.get("label") or "").strip()
        required = bool(item.get("required", False))

        if page < 1 or page > page_count:
            continue

        # Ignore tiny accidental selections.
        if width < 8 or height < 8:
            continue

        cleaned.append(
            {
                "page": page,
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "label": label,
                "type": ftype,
                "required": required,
            }
        )
    return cleaned


def _field_type_from_widget(widget) -> str:
    if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
        return "checkbox"
    if widget.field_type == fitz.PDF_WIDGET_TYPE_SIGNATURE:
        return "signature"
    return "text"


def extract_existing_fillable_fields(input_path: str) -> list[dict]:
    """Read existing AcroForm widgets from a PDF and return normalized field rectangles."""
    doc = fitz.open(input_path)
    try:
        fields: list[dict] = []
        for page_index in range(doc.page_count):
            page = doc[page_index]
            page_rect = page.rect
            widgets = list(page.widgets() or [])
            for w in widgets:
                rect = w.rect
                field_flags = int(getattr(w, "field_flags", 0) or 0)
                fields.append(
                    {
                        "page": page_index + 1,
                        "x": round(float(rect.x0), 2),
                        "y": round(float(page_rect.height - rect.y1), 2),
                        "width": round(float(rect.width), 2),
                        "height": round(float(rect.height), 2),
                        "label": (getattr(w, "field_label", None) or getattr(w, "field_name", "") or "").strip(),
                        "type": _field_type_from_widget(w),
                        "required": bool(field_flags & 2),
                    }
                )
        return fields
    finally:
        doc.close()


def _clear_existing_widgets(doc) -> None:
    for page_index in range(doc.page_count):
        page = doc[page_index]
        widgets = list(page.widgets() or [])
        for w in widgets:
            page.delete_widget(w)


def add_fillable_fields_to_existing_pdf(input_path: str, output_path: str, fields: list) -> list[dict]:
    """Replace all AcroForm widgets in a PDF with the provided normalized fields."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    doc = fitz.open(input_path)
    try:
        normalized = _clean_fields(fields, doc.page_count)
        if not normalized:
            raise ValueError("No valid field areas were provided.")

        _clear_existing_widgets(doc)

        for i, field in enumerate(normalized):
            page = doc[field["page"] - 1]
            rect = page.rect

            x0 = _clamp(field["x"], 0, rect.width - 4)
            # Frontend sends PDF coordinates with origin at bottom-left.
            # PyMuPDF expects top-left page coordinates for widget rects.
            y0_pdf = field["y"]
            h_pdf = field["height"]
            y0 = _clamp(rect.height - (y0_pdf + h_pdf), 0, rect.height - 4)
            x1 = _clamp(x0 + field["width"], x0 + 4, rect.width)
            y1 = _clamp(y0 + field["height"], y0 + 4, rect.height)

            widget = fitz.Widget()
            widget.field_name = _safe_field_name(field["label"], i + 1)
            widget.field_label = field["label"]
            widget.rect = fitz.Rect(x0, y0, x1, y1)
            widget.border_width = 0
            widget.border_style = "S"
            widget.border_color = (0.6, 0.5, 0.2)
            widget.fill_color = None
            widget.text_color = (0.1, 0.1, 0.2)
            widget.field_flags = 2 if field["required"] else 0

            if field["type"] == "checkbox":
                widget.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
                widget.field_value = "Off"
            elif field["type"] == "signature":
                widget.field_type = fitz.PDF_WIDGET_TYPE_SIGNATURE
            else:
                widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
                widget.text_font = "Helv"
                widget.text_fontsize = 10

            page.add_widget(widget)

        doc.save(output_path, garbage=4, deflate=True)
        return normalized
    finally:
        doc.close()
