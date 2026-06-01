import base64
import binascii
import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path

import fitz


_SESSION_DIR = Path(__file__).parent.parent / "data" / "sign_sessions"
_SESSION_FILE = _SESSION_DIR / "sessions.json"
_VALID_TYPES = {"text", "signature"}


def _load_sessions() -> dict:
    _SESSION_DIR.mkdir(parents=True, exist_ok=True)
    if not _SESSION_FILE.exists():
        return {}
    try:
        return json.loads(_SESSION_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_sessions(data: dict) -> None:
    _SESSION_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _SESSION_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(_SESSION_FILE))


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def normalize_layout_fields(raw_fields: list, page_count: int) -> list[dict]:
    cleaned = []
    for i, item in enumerate(raw_fields):
        if not isinstance(item, dict):
            continue

        ftype = str(item.get("type", "text")).strip().lower()
        if ftype not in _VALID_TYPES:
            ftype = "text"

        try:
            page = int(item.get("page", 1))
            x = float(item.get("x", 0))
            y = float(item.get("y", 0))
            width = float(item.get("width", 0))
            height = float(item.get("height", 0))
        except (TypeError, ValueError):
            continue

        if page < 1 or page > page_count:
            continue
        if width < 8 or height < 8:
            continue

        label = str(item.get("label") or "").strip()
        key = str(item.get("key") or f"field_{i + 1}").strip() or f"field_{i + 1}"

        cleaned.append(
            {
                "key": key,
                "label": label,
                "type": ftype,
                "required": bool(item.get("required", False)),
                "page": page,
                "x": x,
                "y": y,
                "width": width,
                "height": height,
            }
        )
    return cleaned


def create_sign_session(input_pdf_path: str, fields: list, title: str = "Sign Document") -> dict:
    doc = fitz.open(input_pdf_path)
    try:
        normalized = normalize_layout_fields(fields, doc.page_count)
    finally:
        doc.close()

    if not normalized:
        raise ValueError("No valid fields were provided for signing.")

    session_id = uuid.uuid4().hex[:12]
    template_name = f"{session_id}_template.pdf"
    template_path = _SESSION_DIR / template_name
    shutil.copyfile(input_pdf_path, template_path)

    session = {
        "id": session_id,
        "title": (title or "Sign Document").strip() or "Sign Document",
        "template_pdf": template_name,
        "created": datetime.now().isoformat(timespec="seconds"),
        "fields": normalized,
    }

    sessions = _load_sessions()
    sessions[session_id] = session
    _save_sessions(sessions)
    return session


def get_sign_session(session_id: str) -> dict | None:
    return _load_sessions().get(session_id)


def _decode_data_url_png(data_url: str) -> bytes | None:
    if not data_url or not isinstance(data_url, str):
        return None
    if "," not in data_url:
        return None
    header, payload = data_url.split(",", 1)
    if "base64" not in header.lower():
        return None
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None


def build_signed_pdf(session: dict, submitted: dict, output_path: str) -> None:
    template_path = _SESSION_DIR / session["template_pdf"]
    if not template_path.exists():
        raise FileNotFoundError("Signing template was not found.")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    doc = fitz.open(str(template_path))
    try:
        for field in session["fields"]:
            page = doc[field["page"] - 1]
            rect = page.rect

            x0 = _clamp(field["x"], 0, rect.width - 2)
            y0 = _clamp(rect.height - (field["y"] + field["height"]), 0, rect.height - 2)
            x1 = _clamp(x0 + field["width"], x0 + 2, rect.width)
            y1 = _clamp(y0 + field["height"], y0 + 2, rect.height)
            box = fitz.Rect(x0, y0, x1, y1)

            value = submitted.get(field["key"], "")
            if field["type"] == "signature":
                image_bytes = _decode_data_url_png(value)
                if image_bytes:
                    page.insert_image(box, stream=image_bytes, keep_proportion=True, overlay=True)
            else:
                text = str(value or "").strip()
                if text:
                    page.insert_textbox(
                        box,
                        text,
                        fontname="helv",
                        fontsize=10,
                        color=(0.1, 0.1, 0.2),
                        align=fitz.TEXT_ALIGN_LEFT,
                    )

        doc.save(output_path, garbage=4, deflate=True)
    finally:
        doc.close()
