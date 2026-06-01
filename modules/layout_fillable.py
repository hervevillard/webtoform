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


def add_fillable_fields_to_existing_pdf(input_path: str, output_path: str, fields: list) -> list[dict]:
    """Add AcroForm widgets to an existing PDF and return normalized fields."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    doc = fitz.open(input_path)
    try:
        normalized = _clean_fields(fields, doc.page_count)
        if not normalized:
            raise ValueError("No valid field areas were provided.")

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

            if field["type"] == "checkbox":
                widget.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
                widget.field_value = "Off"
            elif field["type"] == "signature":
                # Many PDF viewers only show a "Sign" badge for signature widgets
                # and do not provide a full signing flow. Use a reliable text fallback.
                widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
                widget.text_font = "Helv"
                widget.text_fontsize = 10
            else:
                widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
                widget.text_font = "Helv"
                widget.text_fontsize = 10

            page.add_widget(widget)

        doc.save(output_path, garbage=4, deflate=True)
        return normalized
    finally:
        doc.close()
