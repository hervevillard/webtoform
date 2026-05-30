# Skill: generate-form

Customize or debug the fillable PDF generation step.

## What this skill does
Works with `modules/form_generator.py` to adjust the visual layout, field types, or structure of the output fillable PDF.

## How to invoke
The user might say:
- "add a signature field to the form"
- "change the form layout / font / colors"
- "the checkboxes aren't showing up"
- "add the company logo to the header"

## Key concepts

### Field types supported
| `type` value | Rendered as |
|---|---|
| `text` | Single-line text box |
| `textarea` | Multi-line text box |
| `checkbox` | Checkbox with label |
| `date` | Text box with `(MM/DD/YYYY)` hint |
| `email` | Text box with `(email)` hint |
| `phone` | Text box with `(phone)` hint |

### Layout parameters in `form_generator.py`
- `MARGIN` — left/right page margin
- `LINE_HEIGHT` — vertical spacing between fields
- `FIELD_WIDTH` — width of input box
- `HEADER_COLOR` — RGB tuple for the header bar

### Adding a logo
Place a PNG at `static/logo.png` and uncomment the `drawImage` call in `create_fillable_pdf`.

### Adding a signature field
Add `{"label": "Signature", "type": "signature", "required": True}` to the field list and handle `type == "signature"` in `form_generator.py` by drawing a wider underline box.

## Testing
Run the generator standalone:
```python
from modules.form_generator import create_fillable_pdf
fields = [
    {"label": "Full Name", "type": "text", "required": True},
    {"label": "Date of Birth", "type": "date", "required": True},
]
create_fillable_pdf(fields, "output/test_form.pdf")
```
Then open `output/test_form.pdf` in any PDF viewer.
