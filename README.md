# WebToForm

AI-powered insurance form generator. Upload a PDF policy or intake document, and the app uses **DeepSeek AI** to identify what information needs to be collected from a customer — then produces a clean, printable fillable PDF form ready to send.

---

## How it works

```
Your PDF  →  Text extraction (PyMuPDF)  →  AI analysis (DeepSeek)  →  Fillable PDF (ReportLab)
```

1. You upload an insurance document (policy, intake sheet, coverage summary, etc.)
2. The app extracts all text from the PDF
3. DeepSeek reads the content and identifies the fields a customer needs to fill in (name, DOB, policy number, beneficiaries, etc.)
4. A formatted, printable PDF form is generated with labeled input boxes — ready to email or print

---

## Requirements

- **Windows PC**
- **Python 3.10 or newer** — [download from python.org](https://www.python.org/downloads/)
  - During installation, check **"Add Python to PATH"**
- **DeepSeek API key** — [get one free at platform.deepseek.com](https://platform.deepseek.com/api_keys)

---

## Quick start

### 1. Get the code

Download or clone this folder to your PC, e.g. `C:\WebToForm\`.

### 2. Launch the app

Double-click **`launch.bat`**.

On first run it will:
- Create a Python virtual environment
- Install all dependencies automatically
- Open the browser at `http://localhost:5000`

### 3. Enter your API key in the UI

If you have not set a DeepSeek API key yet, the app opens with a yellow warning banner and an expanded key panel at the top. Paste your key there and click **Save Key** — it is written to your local `.env` file automatically and never leaves your PC.

---

## Using the app

1. Drag & drop a PDF onto the upload area (or click to browse)
2. Click **Analyze & Generate Form**
3. Wait 5–15 seconds while AI processes the document
4. Review the detected fields in the preview list
5. Click **Download Fillable PDF** — send the form to your customer

---

## Project structure

```
webtoform/
├── app.py                   Flask web server and routes
├── modules/
│   ├── pdf_reader.py        Extracts text from PDF (PyMuPDF)
│   ├── deepseek_client.py   Calls DeepSeek API to identify form fields
│   └── form_generator.py    Builds the fillable PDF (ReportLab)
├── templates/
│   └── index.html           Web UI
├── static/
│   ├── css/style.css
│   └── js/app.js
├── uploads/                 Temporary PDF uploads (auto-cleaned)
├── output/                  Generated forms (auto-cleaned)
├── .claude/skills/          Agent skill files for Claude Code
├── requirements.txt         Python dependencies
├── .env.example             API key template
├── .env                     Your local config (not committed)
└── launch.bat               Windows launcher
```

---

## Configuration

All settings live in `.env` (copied from `.env.example` on first launch):

| Variable | Description |
|---|---|
| `DEEPSEEK_API_KEY` | Your DeepSeek API key (required) |
| `FLASK_SECRET_KEY` | Random secret for Flask sessions |
| `PORT` | Port to run the server on (default: `5000`) |

---

## Tech stack

| Component | Library |
|---|---|
| Web server | [Flask](https://flask.palletsprojects.com/) |
| PDF reading | [PyMuPDF](https://pymupdf.readthedocs.io/) (`fitz`) |
| AI analysis | [DeepSeek](https://platform.deepseek.com/) via OpenAI-compatible SDK |
| Form generation | [ReportLab](https://www.reportlab.com/) |

---

## Troubleshooting

**"Python is not installed or not in PATH"**
Reinstall Python and check "Add Python to PATH" during setup.

**"DEEPSEEK_API_KEY is not set"**
Open `.env` and make sure your key is on the line `DEEPSEEK_API_KEY=sk-...` with no spaces around `=`.

**"Could not extract text from this PDF"**
The PDF is likely a scanned image. PyMuPDF can only read text-based PDFs. Run the document through an OCR tool first (e.g. Adobe Acrobat, Microsoft Lens).

**Port 5000 is already in use**
Add `PORT=5001` (or any free port) to your `.env` file and relaunch.

**Blank page or form has no fields**
Check the terminal window for error details. The most common cause is a placeholder API key still in `.env`.

---

## Limitations

- Scanned / image-only PDFs are not supported (no OCR built in)
- Generated forms are printable but not AcroForm-interactive (no JavaScript form validation)
- Uploaded files and generated forms are not stored permanently; download promptly

---

## License

For internal / professional use. Not for redistribution.
