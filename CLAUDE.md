# WebToForm — AI-Powered Insurance Form Generator

## Purpose
This app lets an insurance agent upload a PDF (policy document, intake form, etc.), and uses **DeepSeek AI** to extract the relevant fields/questions. It then generates a fillable PDF form that the agent can send to customers to collect the needed information.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, Flask |
| AI | DeepSeek API (`deepseek-chat` model via OpenAI-compatible SDK) |
| PDF Reading | PyMuPDF (`fitz`) |
| Fillable PDF Generation | `reportlab` + `pypdf` |
| Frontend | Plain HTML/CSS/JS (no framework) |
| Configuration | `.env` file with `python-dotenv` |

## Project Layout
```
webtoform/
├── app.py                  # Flask entry point, all routes
├── modules/
│   ├── pdf_reader.py       # Extract text/structure from PDF
│   ├── deepseek_client.py  # Calls DeepSeek API, returns form field list
│   └── form_generator.py   # Builds fillable PDF from field list
├── templates/
│   └── index.html          # Single-page UI
├── static/
│   ├── css/style.css
│   └── js/app.js
├── uploads/                # Temporary storage for uploaded PDFs (gitignored)
├── output/                 # Generated fillable PDFs (gitignored)
├── .claude/skills/         # Agent skill files
├── requirements.txt
├── .env.example
├── .env                    # User-created, holds DEEPSEEK_API_KEY (gitignored)
└── launch.bat              # Windows launcher
```

## Key Files & Responsibilities

### `app.py`
- `POST /upload` — receives PDF, saves to `uploads/`, calls the pipeline, returns download link
- `GET /download/<filename>` — serves the generated fillable PDF
- `GET /` — serves the main UI

### `modules/pdf_reader.py`
- `extract_text(path) -> str` — uses PyMuPDF to pull all text from every page

### `modules/deepseek_client.py`
- `analyze_document(text) -> list[dict]` — sends the extracted text to DeepSeek with a structured prompt asking it to identify what information needs to be collected; returns a list of `{"label": str, "type": str, "required": bool}` field descriptors
- Uses the OpenAI-compatible endpoint: `https://api.deepseek.com`
- Model: `deepseek-chat`

### `modules/form_generator.py`
- `create_fillable_pdf(fields, output_path)` — builds a PDF with text input boxes for each field using ReportLab, suitable for digital completion and printing

## Environment Variables
```
DEEPSEEK_API_KEY=sk-...
FLASK_SECRET_KEY=change-me
```

## Running the App
Double-click `launch.bat` on Windows. It will:
1. Create a Python virtual environment if one doesn't exist
2. Install all dependencies from `requirements.txt`
3. Copy `.env.example` → `.env` if `.env` doesn't exist (user must fill in API key)
4. Start the Flask dev server on `http://localhost:5000`
5. Open the browser automatically

## Development Notes
- Upload size limit: 16 MB (configurable in `app.py`)
- Uploaded PDFs and generated forms are not persisted long-term; clean `uploads/` and `output/` periodically
- The DeepSeek prompt is in `modules/deepseek_client.py` — tune it there
- Form layout is defined in `modules/form_generator.py` — tweak fonts, spacing, header there

## Agent Skills
- `.claude/skills/analyze-pdf.md` — how to run/debug the PDF analysis step
- `.claude/skills/generate-form.md` — how to customize the fillable PDF output
- `.claude/skills/run-app.md` — how to launch and test the full app locally
