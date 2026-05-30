# Skill: analyze-pdf

Analyze the PDF extraction and AI analysis pipeline.

## What this skill does
Tests or debugs the two-step pipeline:
1. PDF text extraction via `modules/pdf_reader.py`
2. DeepSeek field analysis via `modules/deepseek_client.py`

## How to invoke
The user might say:
- "debug the PDF analysis step"
- "why isn't the AI finding the right fields?"
- "test the extraction on this PDF"

## Steps

1. **Check the extracted text first:**
   ```python
   from modules.pdf_reader import extract_text
   text = extract_text("uploads/sample.pdf")
   print(text[:2000])
   ```
   Look for: garbled text (scanned/image PDF), empty output, truncation.

2. **Check the DeepSeek response:**
   ```python
   from modules.deepseek_client import analyze_document
   fields = analyze_document(text)
   print(fields)
   ```
   Expected: list of dicts with `label`, `type`, `required`.

3. **Common issues:**
   - `DEEPSEEK_API_KEY` missing → check `.env` file
   - Scanned PDF → PyMuPDF can't extract text from image-only PDFs; user may need OCR pre-processing
   - DeepSeek returns unexpected format → tune the prompt in `deepseek_client.py`

4. **Prompt tuning:** The system prompt in `deepseek_client.py` is the main lever. If the AI misidentifies fields, refine the prompt to be more specific about insurance document vocabulary.
