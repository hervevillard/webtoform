import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_LEFT

# Layout constants
MARGIN = 0.75 * inch
LINE_HEIGHT = 0.55 * inch
FIELD_WIDTH = 4.5 * inch
FIELD_HEIGHT = 0.28 * inch
TEXTAREA_HEIGHT = 0.65 * inch
CHECKBOX_SIZE = 0.16 * inch
HEADER_COLOR = colors.HexColor("#1a4f8a")
REQUIRED_COLOR = colors.HexColor("#cc0000")
LABEL_COLOR = colors.HexColor("#333333")
LINE_COLOR = colors.HexColor("#b0b8c9")
PAGE_W, PAGE_H = LETTER


def _draw_header(c: canvas.Canvas, title: str):
    # Blue header band
    c.setFillColor(HEADER_COLOR)
    c.rect(0, PAGE_H - 1.1 * inch, PAGE_W, 1.1 * inch, fill=1, stroke=0)

    # Title
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(MARGIN, PAGE_H - 0.55 * inch, title)

    # Sub-label
    c.setFont("Helvetica", 9)
    c.drawString(MARGIN, PAGE_H - 0.82 * inch, "Please complete all required fields and return to your insurance agent.")


def _draw_footer(c: canvas.Canvas, page_num: int):
    c.setFillColor(colors.HexColor("#777777"))
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, 0.4 * inch, "Confidential — Insurance Customer Information Form")
    c.drawRightString(PAGE_W - MARGIN, 0.4 * inch, f"Page {page_num}")


def _draw_text_field(c: canvas.Canvas, x: float, y: float, label: str, required: bool, multiline: bool = False):
    fh = TEXTAREA_HEIGHT if multiline else FIELD_HEIGHT
    label_text = label + (" *" if required else "")

    # Label
    c.setFillColor(LABEL_COLOR)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y + fh + 4, label_text)

    if required:
        label_w = c.stringWidth(label, "Helvetica-Bold", 9)
        c.setFillColor(REQUIRED_COLOR)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + label_w + 2, y + fh + 4, " *")

    # Input box
    c.setStrokeColor(LINE_COLOR)
    c.setFillColor(colors.HexColor("#f7f9fc"))
    c.setLineWidth(0.75)
    c.roundRect(x, y, FIELD_WIDTH, fh, 3, fill=1, stroke=1)


def _draw_checkbox_field(c: canvas.Canvas, x: float, y: float, label: str, required: bool):
    c.setStrokeColor(LINE_COLOR)
    c.setFillColor(colors.white)
    c.setLineWidth(0.75)
    c.rect(x, y, CHECKBOX_SIZE, CHECKBOX_SIZE, fill=1, stroke=1)

    c.setFillColor(LABEL_COLOR)
    c.setFont("Helvetica", 9)
    suffix = " *" if required else ""
    c.drawString(x + CHECKBOX_SIZE + 6, y + 2, label + suffix)


def create_fillable_pdf(fields: list[dict], output_path: str, title: str = "Customer Information Form"):
    """Generate a printable/fillable PDF form from a list of field descriptors."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    c = canvas.Canvas(output_path, pagesize=LETTER)
    c.setTitle(title)
    c.setAuthor("WebToForm — AI Insurance Form Generator")

    page_num = 1
    _draw_header(c, title)
    _draw_footer(c, page_num)

    # Starting Y position below header
    y = PAGE_H - 1.4 * inch

    for field in fields:
        label = field.get("label", "Field")
        ftype = field.get("type", "text")
        required = field.get("required", False)

        multiline = ftype == "textarea"
        field_height = TEXTAREA_HEIGHT if multiline else FIELD_HEIGHT
        spacing = field_height + LINE_HEIGHT * 0.9

        # Append type hint to label where helpful
        hint_map = {"date": " (MM/DD/YYYY)", "email": " (email address)", "phone": " (phone number)"}
        display_label = label + hint_map.get(ftype, "")

        # Page break
        if y - spacing < 0.8 * inch:
            c.showPage()
            page_num += 1
            _draw_header(c, title)
            _draw_footer(c, page_num)
            y = PAGE_H - 1.4 * inch

        if ftype == "checkbox":
            _draw_checkbox_field(c, MARGIN, y, display_label, required)
            y -= 0.38 * inch
        else:
            _draw_text_field(c, MARGIN, y - field_height, display_label, required, multiline)
            y -= spacing

    # Required field legend
    if y - 0.4 * inch < 0.8 * inch:
        c.showPage()
        page_num += 1
        _draw_header(c, title)
        _draw_footer(c, page_num)
        y = PAGE_H - 1.4 * inch

    y -= 0.2 * inch
    c.setFillColor(REQUIRED_COLOR)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, y, "* Required field")

    c.save()
