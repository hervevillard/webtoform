import os
import re
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

from modules.pdf_reader import extract_text
from modules.deepseek_client import analyze_document
from modules.form_generator import create_fillable_pdf

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-key-change-in-production")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "output"
ENV_FILE   = BASE_DIR / ".env"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf"}


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _persist_api_key(key: str):
    """Write/update DEEPSEEK_API_KEY in the .env file."""
    content = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    pattern = re.compile(r"^DEEPSEEK_API_KEY=.*$", re.MULTILINE)
    new_line = f"DEEPSEEK_API_KEY={key}"
    if pattern.search(content):
        content = pattern.sub(new_line, content)
    else:
        content = content.rstrip("\n") + f"\n{new_line}\n"
    ENV_FILE.write_text(content, encoding="utf-8")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api-key-status")
def api_key_status():
    key = os.environ.get("DEEPSEEK_API_KEY", "")
    is_set = bool(key) and key != "sk-your-deepseek-api-key-here"
    return jsonify({"key_set": is_set})


@app.route("/set-api-key", methods=["POST"])
def set_api_key():
    data = request.get_json(silent=True) or {}
    key = (data.get("api_key") or "").strip()
    if not key:
        return jsonify({"error": "API key cannot be empty."}), 400
    os.environ["DEEPSEEK_API_KEY"] = key
    try:
        _persist_api_key(key)
    except Exception:
        pass  # saving to .env is best-effort; runtime env is already updated
    return jsonify({"ok": True})


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided."}), 400

    f = request.files["file"]
    if not f.filename or not _allowed(f.filename):
        return jsonify({"error": "Please upload a valid PDF file."}), 400

    # Save upload with unique name
    unique_name = f"{uuid.uuid4().hex}_{secure_filename(f.filename)}"
    upload_path = UPLOAD_DIR / unique_name
    f.save(str(upload_path))

    try:
        # Step 1: Extract text
        text = extract_text(str(upload_path))
        if not text.strip():
            return jsonify({"error": "Could not extract text from this PDF. It may be a scanned/image-only document."}), 422

        # Step 2: AI analysis
        fields = analyze_document(text)
        if not fields:
            return jsonify({"error": "AI could not identify any form fields in this document."}), 422

        # Step 3: Generate fillable PDF
        # Derive a friendly title from the filename
        base_title = Path(f.filename).stem.replace("_", " ").replace("-", " ").title()
        out_filename = f"form_{uuid.uuid4().hex[:8]}.pdf"
        out_path = OUTPUT_DIR / out_filename
        create_fillable_pdf(fields, str(out_path), title=base_title or "Customer Information Form")

        return jsonify({
            "download_url": f"/download/{out_filename}",
            "filename": out_filename,
            "field_count": len(fields),
            "fields": fields,
        })

    except EnvironmentError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        app.logger.exception("Processing failed")
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500
    finally:
        # Clean up the uploaded file
        upload_path.unlink(missing_ok=True)


@app.route("/download/<filename>")
def download(filename: str):
    safe = secure_filename(filename)
    return send_from_directory(str(OUTPUT_DIR), safe, as_attachment=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n  WebToForm is running at http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
