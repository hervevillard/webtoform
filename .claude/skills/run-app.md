# Skill: run-app

Launch and test the WebToForm app locally on Windows.

## What this skill does
Starts the Flask development server and validates the full end-to-end workflow.

## How to invoke
User might say:
- "run the app"
- "start the server"
- "test the app end to end"

## Steps

### First-time setup
1. Ensure Python 3.10+ is installed (`python --version`)
2. Double-click `launch.bat` OR run from terminal:
   ```bat
   cd C:\path\to\webtoform
   launch.bat
   ```
3. Edit `.env` and paste your DeepSeek API key: `DEEPSEEK_API_KEY=sk-...`

### Manual start (without .bat)
```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Then open `http://localhost:5000` in a browser.

### Testing the golden path
1. Click **Upload PDF** or drag a PDF onto the drop zone
2. Wait for the spinner — AI analysis takes 5–15 seconds
3. Click **Download Form** — opens/downloads the generated fillable PDF
4. Open the PDF in Adobe Acrobat or any PDF viewer and confirm fields are clickable

### Common issues
| Symptom | Fix |
|---|---|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` inside the venv |
| `DEEPSEEK_API_KEY not set` | Edit `.env` with your key |
| Port 5000 already in use | Change `PORT=5000` in `.env` or kill the conflicting process |
| Blank page after upload | Check browser console + Flask terminal for errors |
| PDF has no text / empty form | PDF may be image-only (scanned); see analyze-pdf skill |

### Ports & URLs
- App: `http://localhost:5000`
- Upload endpoint: `POST http://localhost:5000/upload`
- Download: `GET http://localhost:5000/download/<filename>`
