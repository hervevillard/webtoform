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
│   ├── form_generator.py   # Builds fillable PDF from field list
│   └── layout_fillable.py  # Adds fillable widgets on top of existing PDF layout
├── templates/
│   └── index.html          # Single-page UI
├── static/
│   ├── css/style.css
│   ├── js/app.js
│   └── vendor/pdfjs/       # Locally pinned PDF.js runtime + worker
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
4. Start the Flask dev server on `http://localhost:8686`
5. Open the browser automatically

## Development Notes
- Upload size limit: 16 MB (configurable in `app.py`)
- Uploaded PDFs and generated forms are not persisted long-term; clean `uploads/` and `output/` periodically
- The DeepSeek prompt is in `modules/deepseek_client.py` — tune it there
- Form layout is defined in `modules/form_generator.py` — tweak fonts, spacing, header there
- Visual PDF rendering uses local `static/vendor/pdfjs/*` files to avoid CDN/worker mismatch issues
- API key can be entered directly in the UI; it is persisted to `.env` via `POST /set-api-key`
- The app launches without a pre-configured API key — `launch.bat` never blocks on missing key

## Agent Workflow Rules

### Always research online before making UI/UX or design decisions
Use the `deep-research` skill before any significant UI change, redesign, or addition of new design patterns. Do not rely solely on training knowledge for:
- UI/UX trends (design patterns evolve fast)
- Color theory and palette choices
- Accessibility standards
- Library versions and API changes
- Any "best practice" claim that could be outdated

Invoke: `/deep-research <specific question>` or use the `Workflow` tool with `name: "deep-research"`.

### Keep this file updated on every key change
After any of the following, update the relevant section of `CLAUDE.md` before closing the task:
- New routes added to `app.py`
- New modules or files added to the project
- Changes to environment variables
- UI theme or design system changes (update the Design System section below)
- Dependency additions or removals in `requirements.txt`
- Changes to how the app is launched or configured

## Design System
> Update this section whenever the UI theme changes.

### Current theme: African-inspired modern SaaS (applied 2026-05-30)

**Key palette tokens:**
| Token | Hex | Role |
|---|---|---|
| `--gold` | `#C9A84C` | Primary CTA, active states (Kente cloth) |
| `--terracotta` | `#C0502A` | Warnings, hover accents (Ankara sunset) |
| `--forest` | `#2D5A3D` | Success states (African forest) |
| `--midnight` | `#1C1C2E` | Header, heavy text (Adinkra ink) |
| `--ivory` | `#FDFAF3` | Card surfaces (parchment warm) |
| `--bg` | `#F7F2E8` | Page background (warm sand) |

**Typography:** Plus Jakarta Sans (Google Fonts), weights 400–800. Fallback: Segoe UI.

**Full details:** `.claude/skills/design-system.md`

### UI layout
- API key is **not** in the main column — it lives in a slide-down settings drawer triggered by the ⚙️ button in the header
- A pulsing dot in the header shows key status (green = set, orange pulse = missing)
- A slim warning strip appears below the header when no key is configured
- Main column contains only: step indicator → upload card → results card

### API routes (current)
| Method | Route | Purpose |
|---|---|---|
| GET | `/` | Serve UI |
| POST | `/upload` | Accept PDF, run pipeline, return download URL |
| GET | `/download/<filename>` | Serve generated PDF |
| GET | `/api-key-status` | Returns `{key_set: bool}` |
| POST | `/set-api-key` | Accepts `{api_key}`, sets env + persists to `.env` |
| POST | `/build` | Accepts `{title, fields}` JSON, generates PDF without AI, returns same shape as `/upload` |
| POST | `/build-from-layout` | Accepts uploaded PDF + visual field coordinates, injects AcroForm fields into original layout |
| POST | `/create-sign-session` | Accepts uploaded PDF + visual field coordinates, returns a shareable web signing URL |
| GET | `/sign/<id>` | Renders a signer page with text inputs + draw signature pads |
| POST | `/sign/<id>/submit` | Accepts signer values/signatures, embeds them into PDF, returns download page |
| POST | `/share` | Accepts `{title, fields}`, stores form in `data/forms.json`, returns `{form_id, share_url, field_count}` |
| GET | `/form/<id>` | Renders customer-facing web form (`templates/form.html`) |
| POST | `/form/<id>/submit` | Saves customer submission to `data/forms.json`, shows thank-you page |
| GET | `/responses` | Returns JSON list of all forms + submissions (agent only) |

### PDF form field types
| Type | Rendered as |
|---|---|
| `text` | Single-line AcroForm textfield |
| `signature` | AcroForm signature widget (or textfield fallback if viewer/library lacks signature widget support) |
| `textarea` | Multi-line AcroForm textfield |
| `date` | Single-line textfield with `(MM / DD / YYYY)` hint |
| `email` | Single-line textfield with email hint |
| `phone` | Single-line textfield with phone hint |
| `checkbox` | AcroForm checkbox widget |
| `list` | Section header + 5 numbered AcroForm textfield rows |

**Visual Fillable note:** Visual placement mode currently supports `text` and `signature` field types.
Use **Create Web Sign Link** when you need DocuSign-style drawn signatures captured in-browser and embedded into the final PDF.

**Note on date popup:** True calendar date-picker in PDF requires Adobe Acrobat JavaScript, which ReportLab's public canvas API does not expose. Date fields use a clearly-labelled text input as the best available cross-viewer alternative.

## Agent Skills
- `.claude/skills/analyze-pdf.md` — how to run/debug the PDF analysis step
- `.claude/skills/generate-form.md` — how to customize the fillable PDF output
- `.claude/skills/run-app.md` — how to launch and test the full app locally
- `.claude/skills/design-system.md` — color palette, typography, component patterns (African theme)
