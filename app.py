import os
import re
import socket
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

from modules.pdf_reader import extract_text
from modules.deepseek_client import analyze_document
from modules.form_generator import create_fillable_pdf
from modules.store import create_form, get_form, add_submission, list_forms

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-key-change-in-production")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

BASE_DIR   = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "output"
ENV_FILE   = BASE_DIR / ".env"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS  = {"pdf"}
VALID_FIELD_TYPES   = {"text", "textarea", "date", "email", "phone", "checkbox", "list"}


def _get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _persist_api_key(key: str):
    content = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    pattern = re.compile(r"^DEEPSEEK_API_KEY=.*$", re.MULTILINE)
    new_line = f"DEEPSEEK_API_KEY={key}"
    if pattern.search(content):
        content = pattern.sub(new_line, content)
    else:
        content = content.rstrip("\n") + f"\n{new_line}\n"
    ENV_FILE.write_text(content, encoding="utf-8")


def _clean_fields(fields: list, require_nonempty_labels: bool = True) -> tuple[list, str | None]:
    """Validate and normalise a raw fields list. Returns (cleaned, error_or_None)."""
    if not isinstance(fields, list) or len(fields) == 0:
        return [], "Please add at least one field."
    cleaned = []
    for i, f in enumerate(fields):
        if not isinstance(f, dict):
            continue
        label = str(f.get("label") or "").strip()
        if require_nonempty_labels and not label:
            return [], f"Field #{i + 1} has an empty label."
        cleaned.append({
            "label":    label,
            "type":     f.get("type") if f.get("type") in VALID_FIELD_TYPES else "text",
            "required": bool(f.get("required", False)),
        })
    if not cleaned:
        return [], "No valid fields provided."
    return cleaned, None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api-key-status")
def api_key_status():
    key    = os.environ.get("DEEPSEEK_API_KEY", "")
    is_set = bool(key) and key != "sk-your-deepseek-api-key-here"
    return jsonify({"key_set": is_set})


@app.route("/set-api-key", methods=["POST"])
def set_api_key():
    data = request.get_json(silent=True) or {}
    key  = (data.get("api_key") or "").strip()
    if not key:
        return jsonify({"error": "API key cannot be empty."}), 400
    os.environ["DEEPSEEK_API_KEY"] = key
    try:
        _persist_api_key(key)
    except Exception:
        pass
    return jsonify({"ok": True})


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400
    f = request.files["file"]
    if not f.filename or not _allowed(f.filename):
        return jsonify({"error": "Please upload a valid PDF file."}), 400

    unique_name = f"{uuid.uuid4().hex}_{secure_filename(f.filename)}"
    upload_path = UPLOAD_DIR / unique_name
    f.save(str(upload_path))

    try:
        text = extract_text(str(upload_path))
        if not text.strip():
            return jsonify({"error": "Could not extract text from this PDF. It may be a scanned/image-only document."}), 422

        fields = analyze_document(text)
        if not fields:
            return jsonify({"error": "AI could not identify any form fields in this document."}), 422

        base_title   = Path(f.filename).stem.replace("_", " ").replace("-", " ").title()
        out_filename = f"form_{uuid.uuid4().hex[:8]}.pdf"
        out_path     = OUTPUT_DIR / out_filename
        create_fillable_pdf(fields, str(out_path), title=base_title or "Customer Information Form")

        return jsonify({
            "download_url": f"/download/{out_filename}",
            "filename":     out_filename,
            "field_count":  len(fields),
            "fields":       fields,
            "title":        base_title or "Customer Information Form",
        })
    except EnvironmentError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        app.logger.exception("Processing failed")
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500
    finally:
        upload_path.unlink(missing_ok=True)


@app.route("/build", methods=["POST"])
def build():
    data   = request.get_json(silent=True) or {}
    title  = (data.get("title") or "Customer Information Form").strip()
    cleaned, err = _clean_fields(data.get("fields") or [])
    if err:
        return jsonify({"error": err}), 400
    try:
        out_filename = f"form_{uuid.uuid4().hex[:8]}.pdf"
        out_path     = OUTPUT_DIR / out_filename
        create_fillable_pdf(cleaned, str(out_path), title=title)
        return jsonify({
            "download_url": f"/download/{out_filename}",
            "filename":     out_filename,
            "field_count":  len(cleaned),
            "fields":       cleaned,
        })
    except Exception as e:
        app.logger.exception("Build failed")
        return jsonify({"error": f"PDF generation failed: {str(e)}"}), 500


@app.route("/share", methods=["POST"])
def share():
    data   = request.get_json(silent=True) or {}
    title  = (data.get("title") or "Customer Information Form").strip()
    cleaned, err = _clean_fields(data.get("fields") or [])
    if err:
        return jsonify({"error": err}), 400

    form_id   = create_form(title, cleaned)
    port      = int(os.environ.get("PORT", 5000))
    lan_ip    = _get_lan_ip()
    share_url = f"http://{lan_ip}:{port}/form/{form_id}"

    return jsonify({
        "form_id":     form_id,
        "share_url":   share_url,
        "field_count": len(cleaned),
    })


@app.route("/form/<form_id>")
def web_form(form_id: str):
    form = get_form(form_id)
    if not form:
        return render_template("form.html", form=None, error="Form not found or expired."), 404
    return render_template("form.html", form=form, error=None)


@app.route("/form/<form_id>/submit", methods=["POST"])
def submit_form(form_id: str):
    form = get_form(form_id)
    if not form:
        return render_template("form.html", form=None, error="Form not found or expired."), 404

    # Collect submitted values keyed by field label
    submission_data = {}
    for field in form["fields"]:
        label = field["label"]
        ftype = field["type"]
        if ftype == "checkbox":
            submission_data[label] = "Yes" if request.form.get(label) else "No"
        elif ftype == "list":
            rows = [request.form.get(f"{label}_{i}", "").strip() for i in range(1, 6)]
            submission_data[label] = [r for r in rows if r]
        else:
            submission_data[label] = request.form.get(label, "").strip()

    # Validate required fields
    for field in form["fields"]:
        if field["required"]:
            val = submission_data.get(field["label"], "")
            if not val or val == "No" or (isinstance(val, list) and not val):
                return render_template("form.html", form=form, error=None,
                                       validation_error=f'"{field["label"]}" is required.',
                                       prefill=submission_data)

    add_submission(form_id, submission_data)
    return render_template("form.html", form=form, error=None, submitted=True)


@app.route("/responses")
def responses():
    return jsonify(list_forms())


@app.route("/download/<filename>")
def download(filename: str):
    safe = secure_filename(filename)
    return send_from_directory(str(OUTPUT_DIR), safe, as_attachment=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    lan  = _get_lan_ip()
    print(f"\n  WebToForm running at:")
    print(f"    Local:   http://localhost:{port}")
    print(f"    Network: http://{lan}:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
