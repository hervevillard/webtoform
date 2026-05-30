"""
File-based JSON store for shared web forms and their submissions.
Writes are atomic: write to a temp file, then rename over the target.
"""
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

_DATA_DIR  = Path(__file__).parent.parent / "data"
_STORE_FILE = _DATA_DIR / "forms.json"


def _load() -> dict:
    _DATA_DIR.mkdir(exist_ok=True)
    if not _STORE_FILE.exists():
        return {}
    try:
        return json.loads(_STORE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save(forms: dict) -> None:
    _DATA_DIR.mkdir(exist_ok=True)
    tmp = _STORE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(forms, ensure_ascii=False, indent=2), encoding="utf-8")
    # Atomic replace
    os.replace(str(tmp), str(_STORE_FILE))


def create_form(title: str, fields: list[dict]) -> str:
    """Persist a new form definition and return its unique ID."""
    forms  = _load()
    form_id = uuid.uuid4().hex[:10]
    forms[form_id] = {
        "id":          form_id,
        "title":       title,
        "fields":      fields,
        "created":     datetime.now().isoformat(timespec="seconds"),
        "submissions": [],
    }
    _save(forms)
    return form_id


def get_form(form_id: str) -> dict | None:
    return _load().get(form_id)


def add_submission(form_id: str, data: dict) -> bool:
    """Append a submission to the form. Returns False if form not found."""
    forms = _load()
    if form_id not in forms:
        return False
    forms[form_id]["submissions"].append({
        "submitted": datetime.now().isoformat(timespec="seconds"),
        "data":      data,
    })
    _save(forms)
    return True


def list_forms() -> list[dict]:
    """Return all forms sorted newest first."""
    forms = _load()
    return sorted(forms.values(), key=lambda f: f["created"], reverse=True)
