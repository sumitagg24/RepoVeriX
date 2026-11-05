"""Build the RepoVeriX project report as DOCX and PDF from one content model.

Both renderers consume the same block list, so wording cannot drift between the
two deliverables.

Run:  python report/build_report.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPORT_DIR = Path(__file__).resolve().parent
ROOT = REPORT_DIR.parent
FIG_DIR = REPORT_DIR / "figures"
OUT_DIR = ROOT / "report_output"
FONT_DIR = Path("/home/user/report_assets/fonts")

sys.path.insert(0, str(REPORT_DIR))

from content_part1 import CHAPTERS as C1, FRONT_MATTER, FRONT_MATTER_BLOCKS  # noqa: E402
from content_part2 import CHAPTERS as C2  # noqa: E402
from content_part3 import CHAPTERS as C3RAW, REFERENCES  # noqa: E402

# References belong before the appendices, as in the reference report format.
_APPENDIX_AT = next(i for i, b in enumerate(C3RAW) if str(b.get("title", "")).startswith("Appendix A"))
C3 = C3RAW[:_APPENDIX_AT]
APPENDICES = C3RAW[_APPENDIX_AT:]


# --------------------------------------------------------------------------- text helpers
TOKEN = re.compile(r"(\*\*.+?\*\*|\*[^*]+?\*)")


def rich_runs(text: str):
    """Split a string into (text, bold, italic) runs."""
    out = []
    for part in TOKEN.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**") and len(part) > 4:
            out.append((part[2:-2], True, False))
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            out.append((part[1:-1], False, True))
        else:
            out.append((part, False, False))
    return out


def plain(text: str) -> str:
    return "".join(t for t, _, _ in rich_runs(text))


def heading_text(block: dict) -> str:
    num, title = block.get("num", ""), block["title"]
    if not num:
        return title
    if block["t"] == "h1":
        return title if title.startswith("Appendix") else f"{num}. {title}"
    return f"{num} {title}"


def toc_text(block: dict) -> str:
    num, title = block.get("num", ""), block["title"]
    if not num:
        return title
    if block["t"] == "h1":
        return title if title.startswith("Appendix") else f"{num}    {title}"
    return f"        {num}  {title}"


# --------------------------------------------------------------------------- document assembly
class Doc:
    """Block list with numbering, headings and TOC metadata resolved."""

    def __init__(self):
        self.blocks = C1 + C2 + C3 + REFERENCES + APPENDICES
        self.figures = []          # [(number, caption, source)]
        self.tables = []
        self.toc = []              # [(level, text, block_index)]
        self.heading_index = {}    # block_index -> (level, text)
        self._number()

    def _number(self):
        fig = tab = 0
        for i, b in enumerate(self.blocks):
            if b["t"] == "figure":
                fig += 1
                b["num"] = fig
                self.figures.append((fig, b["caption"], b.get("source", "")))
            elif b["t"] == "table":
                tab += 1
                b["num"] = tab
                self.tables.append((tab, b["caption"], b.get("source", "")))
            elif b["t"] in ("h1", "h2"):
                text = heading_text(b)
                b["text"] = text
                self.toc.append((1 if b["t"] == "h1" else 2, text, i))
                self.heading_index[i] = (1 if b["t"] == "h1" else 2, text)

    def word_count(self):
        n = 0
        for b in self.blocks:
            if b["t"] == "p":
                n += len(b["text"].split())
            elif b["t"] in ("bullets", "numbers"):
                n += sum(len(x.split()) for x in b["items"])
            elif b["t"] == "table":
                n += sum(len(" ".join(r).split()) for r in b["rows"])
        return n


# =========================================================================== PDF renderer
def locate_pages(doc: "Doc", pdf_path: Path, body_start: int, first_h1: int) -> dict:
    """Read heading/caption page numbers back out of a rendered PDF."""
    import pymupdf

    with pymupdf.open(pdf_path) as pdf:
        pages = [pdf[i].get_text().split("\n") for i in range(body_start - 1, len(pdf))]

    # flatten to a monotonic list of (page_offset, line) for forward scanning
    flat = [(n, line.strip()) for n, lines in enumerate(pages) for line in lines if line.strip()]
    cursor = 0

    def find(label):
        nonlocal cursor
        for j in range(cursor, len(flat)):
            if flat[j][1] == label:
                cursor = j
                return flat[j][0] + 1
        return None

    out = {}
    for idx, b in enumerate(doc.blocks):
        if b["t"] in ("h1", "h2", "h3"):
            page = find(heading_text(b))
            if page is not None:
                out[idx] = page
        elif b["t"] == "table":
            page = find(f"Table {b['num']}.")
            if page is not None:
                out[("tab", b["num"])] = page
        elif b["t"] == "figure":
            page = find(f"Figure {b['num']}.")
            if page is not None:
                out[("fig", b["num"])] = page
    return out


def build_pdf(doc: Doc, out_path: Path, toc_pages: int = 2, page_numbers=None, body_start=None):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import cm, mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import (
        BaseDocTemplate, CondPageBreak, Flowable, Frame, Image, KeepTogether, NextPageTemplate,
        PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    )

    ACCENT = colors.HexColor("#14503c")
    INK = colors.HexColor("#1d2529")
    MUTED = colors.HexColor("#5b6b70")
    RULE = colors.HexColor("#c9d2ce")
    ZEBRA = colors.HexColor("#f6f8f7")

    for name, file in (
        ("Caladea", "Caladea-Regular.ttf"),
        ("Caladea-Bold", "Caladea-Bold.ttf"),
        ("Caladea-Italic", "Caladea-Italic.ttf"),
        ("Caladea-BoldItalic", "Caladea-BoldItalic.ttf"),
    ):
        pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
    pdfmetrics.registerFontFamily(
        "Caladea", normal="Caladea", bold="Caladea-Bold",
        italic="Caladea-Italic", boldItalic="Caladea-BoldItalic",
    )

    BODY_SIZE = 10.5
    LEAD = 13.45

    s_body = ParagraphStyle("body", fontName="Caladea", fontSize=BODY_SIZE, leading=LEAD,
                            alignment=TA_JUSTIFY, spaceAfter=4.2, textColor=INK)
    s_h1 = ParagraphStyle("h1", fontName="Caladea-Bold", fontSize=16.5, leading=20,
                          textColor=ACCENT, spaceBefore=0, spaceAfter=9, keepWithNext=1)
    s_h2 = ParagraphStyle("h2", fontName="Caladea-Bold", fontSize=12.2, leading=15,
                          textColor=ACCENT, spaceBefore=8, spaceAfter=3.5, keepWithNext=0)
    s_h3 = ParagraphStyle("h3", fontName="Caladea-BoldItalic", fontSize=11.5, leading=15,
                          textColor=INK, spaceBefore=8, spaceAfter=3)
    s_bullet = ParagraphStyle("bullet", parent=s_body, leftIndent=15, bulletIndent=3,
                              spaceAfter=2.6, bulletFontName="Caladea", bulletFontSize=BODY_SIZE)
    s_num = ParagraphStyle("num", parent=s_body, leftIndent=17, bulletIndent=3,
                           spaceAfter=3.2, bulletFontName="Caladea", bulletFontSize=BODY_SIZE)
    s_doc = ParagraphStyle("docbody", fontName="Caladea", fontSize=11.2, leading=16.4,
                           alignment=TA_JUSTIFY, spaceAfter=7.5, textColor=INK)
    s_note = ParagraphStyle("note", fontName="Caladea-Italic", fontSize=9, leading=12.6,
                            textColor=MUTED, alignment=TA_LEFT, spaceAfter=6)
    s_capfig = ParagraphStyle("capfig", fontName="Caladea", fontSize=9.1, leading=12,
                              alignment=TA_CENTER, textColor=INK, spaceBefore=3, spaceAfter=2)
    s_src = ParagraphStyle("src", fontName="Caladea-Italic", fontSize=8.0, leading=10.4,
                           alignment=TA_CENTER, textColor=MUTED, spaceAfter=7)
    s_captab = ParagraphStyle("captab", fontName="Caladea", fontSize=9.1, leading=12,
                              alignment=TA_LEFT, textColor=INK, spaceBefore=2, spaceAfter=4)
    s_tcell = ParagraphStyle("tcell", fontName="Caladea", fontSize=7.9, leading=9.5, textColor=INK)
    s_thead = ParagraphStyle("thead", fontName="Caladea-Bold", fontSize=7.9, leading=9.5,
                             textColor=colors.white)
    s_toc1 = ParagraphStyle("toc1", fontName="Caladea-Bold", fontSize=9.7, leading=11.6,
                            textColor=INK, leftIndent=0, firstLineIndent=0)
    s_toc2 = ParagraphStyle("toc2", fontName="Caladea", fontSize=9.1, leading=10.15,
                            textColor=INK, leftIndent=18, firstLineIndent=0)
    s_cover_inst = ParagraphStyle("ci", fontName="Caladea-Bold", fontSize=14, leading=19,
                                  alignment=TA_CENTER, textColor=INK, spaceAfter=2)
    s_cover_small = ParagraphStyle("cs", fontName="Caladea", fontSize=11.5, leading=16,
                                   alignment=TA_CENTER, textColor=MUTED)
    s_cover_title = ParagraphStyle("ct", fontName="Caladea-Bold", fontSize=30, leading=36,
                                   alignment=TA_CENTER, textColor=ACCENT, spaceAfter=2)
    s_cover_sub = ParagraphStyle("csub", fontName="Caladea-Italic", fontSize=12.5, leading=17,
                                 alignment=TA_CENTER, textColor=INK)
    s_center = ParagraphStyle("center", parent=s_body, alignment=TA_CENTER)
    s_refs = ParagraphStyle("refs", parent=s_body, leftIndent=17, firstLineIndent=-17,
                            spaceAfter=4.0, fontSize=9.9, leading=13.4)

    pages_meta = {"body_start": None, "headings": {}, "current_h1": ""}

    class Marker(Flowable):
        """Zero-height flowable that records the page a heading lands on."""

        def __init__(self, key=None, body_start=False):
            super().__init__()
            self.key = key
            self.body_start = body_start
            self.width = 0
            self.height = 0

        def draw(self):
            page = self.canv.getPageNumber()
            if self.body_start:
                pages_meta["body_start"] = page
            elif self.key is not None:
                pages_meta["headings"][self.key] = page

    class HRule(Flowable):
        def __init__(self, width, thickness=0.6, color=RULE, space=4):
            super().__init__()
            self.width, self.thickness, self.color, self.space = width, thickness, color, space
            self.height = space

        def draw(self):
            self.canv.setStrokeColor(self.color)
            self.canv.setLineWidth(self.thickness)
            self.canv.line(0, self.space / 2, self.width, self.space / 2)

    def on_cover(canv, d):
        pass

    ROMAN = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
             (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]

    def on_front(canv, d):
        n = canv.getPageNumber() - 1          # the cover carries no number
        out, v = "", n
        for value, sym in ROMAN:
            while v >= value:
                out += sym
                v -= value
        canv.saveState()
        canv.setFont("Caladea", 9)
        canv.setFillColor(MUTED)
        canv.drawCentredString(A4[0] / 2, 1.12 * cm, out.lower() if out else "")
        canv.restoreState()

    def on_body(canv, d):
        canv.saveState()
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.5)
        canv.line(2.35 * cm, A4[1] - 1.75 * cm, A4[0] - 2.15 * cm, A4[1] - 1.75 * cm)
        canv.setFont("Caladea", 8.4)
        canv.setFillColor(MUTED)
        canv.drawString(2.35 * cm, A4[1] - 1.58 * cm, "RepoVeriX  |  Evidence-Grounded Repository Auditing and Verified Repair")
        canv.drawRightString(A4[0] - 2.15 * cm, A4[1] - 1.58 * cm, "Project Report")
        start = body_start or pages_meta["body_start"] or 1
        canv.setFont("Caladea", 9)
        canv.drawCentredString(A4[0] / 2, 1.12 * cm, str(canv.getPageNumber() - start + 1))
        canv.restoreState()

    left, right, top, bottom = 2.35 * cm, 2.15 * cm, 2.2 * cm, 1.95 * cm
    frame = Frame(left, bottom, A4[0] - left - right, A4[1] - top - bottom, id="main",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    cover_frame = Frame(left, bottom, A4[0] - left - right, A4[1] - top - bottom, id="cover",
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    tmpl = BaseDocTemplate(
        str(out_path), pagesize=A4, leftMargin=left, rightMargin=right,
        topMargin=top, bottomMargin=bottom,
        title="RepoVeriX — Project Report",
        author="Sumit Aggarwal", subject="Evidence-Grounded Repository Auditing and Verified Automated Repair",
    )
    tmpl.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover),
        PageTemplate(id="front", frames=[frame], onPage=on_front),
        PageTemplate(id="body", frames=[frame], onPage=on_body),
    ])

    usable = A4[0] - left - right
    flow = []

    def P(text, style=s_body, **kw):
        return Paragraph(text, style, **kw)

    def html_of(text):
        runs = rich_runs(text)
        out = "".join(f"<b>{t}</b>" if b else f"<i>{t}</i>" if i else t for t, b, i in runs)
        return out.replace("&", "&amp;")

    def para(text, style=s_body, **kw):
        return Paragraph(html_of(text), style, **kw)

    def make_table(block):
        widths = [w / sum(block["cols"]) * usable for w in block["cols"]]
        cap = Paragraph(f"<b>Table {block['num']}.</b> {plain(block['caption'])}", s_captab)
        head = [Paragraph(h, s_thead) for h in block["head"]]
        rows = [[Paragraph(str(c), s_tcell) for c in r] for r in block["rows"]]
        t = Table([[cap]] + [head] + rows, colWidths=widths, repeatRows=2, hAlign="LEFT")
        style = [
            ("SPAN", (0, 0), (-1, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.white),
            ("LEFTPADDING", (0, 0), (-1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, 0), 4),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
            ("BACKGROUND", (0, 1), (-1, 1), ACCENT),
            ("TEXTCOLOR", (0, 1), (-1, 1), colors.white),
            ("GRID", (0, 1), (-1, -1), 0.4, RULE),
            ("VALIGN", (0, 1), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 1), (-1, -1), 3.2),
            ("RIGHTPADDING", (0, 1), (-1, -1), 3.2),
            ("TOPPADDING", (0, 1), (-1, -1), 2.2),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 2.2),
        ]
        for i in range(2, len(rows) + 2):
            if (i - 2) % 2 == 1:
                style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
        t.setStyle(TableStyle(style))
        return t

    def fig_caption(block):
        # reference captions sit under the figure; keepWithNext binds the figure to its caption
        st = ParagraphStyle("capkeep", parent=s_capfig, keepWithNext=1)
        return P(f"<b>Figure {block['num']}.</b> {plain(block['caption'])}", st)

    def tab_caption(block):
        return P(f"<b>Table {block['num']}.</b> {plain(block['caption'])}", s_captab)

    def fig_source(block):
        return P(block.get("source", ""), s_src)

    # ---------------------------------------------------------------- cover
    fm = FRONT_MATTER
    flow.append(NextPageTemplate("cover"))
    flow.append(Spacer(1, 0.9 * cm))
    flow.append(P(fm["institution"].upper(), s_cover_inst))
    flow.append(P(fm["programme"], s_cover_small))
    flow.append(Spacer(1, 0.28 * cm))
    flow.append(HRule(usable, 1.1, ACCENT, 6))
    flow.append(Spacer(1, 2.0 * cm))
    flow.append(P("A PROJECT REPORT ON", s_cover_small))
    flow.append(Spacer(1, 0.5 * cm))
    flow.append(P(fm["project_title"], s_cover_title))
    flow.append(P(fm["project_subtitle"], s_cover_sub))
    flow.append(Spacer(1, 1.6 * cm))
    flow.append(HRule(usable * 0.42, 0.7, RULE, 6))
    flow.append(Spacer(1, 1.4 * cm))
    flow.append(P("Submitted in partial fulfilment of the requirements for the award of the degree of", s_cover_small))
    flow.append(P("Bachelor of Technology in Computer Science and Engineering", s_center))
    flow.append(Spacer(1, 1.5 * cm))
    flow.append(P("<b>Submitted by</b>", s_cover_small))
    flow.append(Spacer(1, 0.22 * cm))
    flow.append(P(f"<b>{fm['student']}</b>", s_center))
    flow.append(P(f"Roll Number {fm['roll']}   ·   Section {fm['section']}", s_cover_small))
    flow.append(Spacer(1, 1.2 * cm))
    flow.append(P("<b>Under the guidance of</b>", s_cover_small))
    flow.append(P(fm["guide"], s_center))
    flow.append(P(fm["guide_line"], s_cover_small))
    flow.append(Spacer(1, 1.6 * cm))
    flow.append(HRule(usable, 0.6, RULE, 6))
    flow.append(P(fm["session"], s_cover_small))
    flow.append(P("Department of Computer Science and Engineering", s_cover_small))
    flow.append(PageBreak())

    # ---------------------------------------------------------------- certificate
    flow.append(NextPageTemplate("front"))
    flow.append(P("CERTIFICATE", s_h1))
    flow.append(Spacer(1, 0.5 * cm))
    flow.append(para(
        "This is to certify that the project report entitled **“RepoVeriX — Evidence-Grounded "
        "Repository-Level Code Auditing and Verified Automated Repair”** is the bona fide work "
        f"carried out by **{fm['student']}** (Roll Number {fm['roll']}), a student of "
        f"{fm['programme']} at the {fm['institution']}, in partial fulfilment of the requirements "
        "for the award of the degree of Bachelor of Technology.", s_doc))
    flow.append(para(
        "The work recorded in this report was carried out under my supervision during the "
        f"{fm['session']}. The report has been prepared in accordance with the guidelines issued by "
        "the department, and the contents of this report have not been submitted, in whole or in "
        "part, for the award of any other degree or diploma at this or any other institution.", s_doc))
    flow.append(para(
        "The project addresses evidence-grounded repository-level code auditing and verified "
        "automated repair. The implementation, the benchmark apparatus and the documentation "
        "described in the chapters that follow were examined during the preparation of this report. "
        "To the best of my knowledge, the report represents the candidate's own work, and all "
        "external material used has been acknowledged in the references.", s_doc))
    flow.append(para(
        "The report documents the system as it exists in the project repository rather than as it is intended "
        "to exist. Behaviour present in the code is described with reference to the module that provides it; "
        "behaviour that depends on an external service or an operator action is marked as documented; and "
        "quantitative results that require an experiment not yet executed are marked as pending. This "
        "distinction is maintained throughout so that the examiner can separate demonstrated capability from "
        "intended capability without ambiguity.", s_doc))
    flow.append(para(
        "The project work includes the analysis engine, the service interface, the persistence schema, the "
        "developer interface, the benchmark apparatus and the supporting documentation. The candidate has "
        "presented the work at the internal review stages prescribed by the department, and the corrections "
        "suggested during those reviews have been incorporated into this version of the report.", s_doc))
    flow.append(Spacer(1, 1.5 * cm))
    sig = Table(
        [
            [P("<b>Signature of Guide</b>", s_body), P("<b>Signature of Head of Department</b>", s_body)],
            [P(f"{fm['guide']}<br/>{fm['guide_line']}", s_body), P(f"{fm['hod']}<br/>{fm['hod_line']}", s_body)],
        ],
        colWidths=[usable / 2, usable / 2],
    )
    sig.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
    ]))
    flow.append(sig)
    flow.append(Spacer(1, 1.4 * cm))
    flow.append(HRule(usable, 0.5, RULE, 6))
    flow.append(para(
        "Internal Examiner: ______________________________        External Examiner: "
        "______________________________", s_body))
    flow.append(para("Date of Examination: ____________________                 Place: ____________________", s_body))
    flow.append(PageBreak())

    # ---------------------------------------------------------------- declaration
    flow.append(P("DECLARATION", s_h1))
    flow.append(Spacer(1, 0.5 * cm))
    flow.append(para(
        f"I, **{fm['student']}**, student of {fm['programme']}, Roll Number {fm['roll']}, Section "
        f"{fm['section']}, hereby declare that the project report entitled **“RepoVeriX — "
        "Evidence-Grounded Repository-Level Code Auditing and Verified Automated Repair”** "
        "submitted to the department is a record of original work carried out by me.", s_doc))
    flow.append(para(
        "I further declare that the analysis, the system design, the implementation described in "
        "these chapters and the documentation of that implementation are my own work, and that the "
        "report does not contain any material that has been copied from any source without proper "
        "acknowledgement. Where the report describes behaviour that resides in the project "
        "repository, the description is derived from that repository; where a value could not be "
        "established from the repository, it has been marked as pending rather than estimated.", s_doc))
    flow.append(para(
        "I understand that any breach of this declaration, including the fabrication of results or "
        "the misrepresentation of another's work as my own, is a matter of academic misconduct and "
        "may be dealt with under the disciplinary rules of the institution. I also understand that "
        "the examiners may require me to demonstrate or explain any part of this work.", s_doc))
    flow.append(para(
        "I confirm that no part of this report was produced by presenting the project repository to a tool and "
        "accepting its output as documentation. The report was written from a line-by-line reading of the "
        "repository — its modules, its configuration, its schema, its route inventory, its prompts, its test "
        "modules and its documentation set — and every count, identifier and quoted limit in these chapters was "
        "taken from those sources. Where the repository did not determine an answer, the report says so instead "
        "of supplying one.", s_doc))
    flow.append(para(
        "I also confirm that the figures in this report are conceptual diagrams generated from verified "
        "repository facts, that no product screenshot has been fabricated, and that the source of each figure "
        "is recorded in its caption. The repository itself has been acknowledged in the references as the "
        "primary source for the system described here.", s_doc))
    flow.append(Spacer(1, 1.7 * cm))
    place = Table([[P(f"Date: ____________________", s_body), P(f"<b>{fm['student']}</b><br/>Roll Number {fm['roll']}", s_body)]],
                  colWidths=[usable * 0.45, usable * 0.55])
    place.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    flow.append(place)
    flow.append(PageBreak())

    # ---------------------------------------------------------------- acknowledgement
    flow.append(P("ACKNOWLEDGEMENT", s_h1))
    flow.append(Spacer(1, 0.4 * cm))
    flow.append(para(
        "A project of this kind accumulates debts that are easy to forget and impossible to repay "
        "individually. I record them here with gratitude.", s_doc))
    flow.append(para(
        "I am deeply thankful to my project guide for the supervision that shaped this work. The "
        "guidance was consistently of the kind that improves a system rather than merely approving "
        "it: questions about what the software could actually prove, insistence that an unmeasured "
        "result be labelled as such, and repeated pressure to state claims in a form that another "
        "person could check. Much of what is honest about both the system and this report came from "
        "that pressure.", s_doc))
    flow.append(para(
        "I extend my sincere thanks to the Head of the Department and to the faculty members of the "
        "Department of Computer Science and Engineering for the academic environment in which the "
        "work was carried out, and for the reviews that helped me separate what the project "
        "demonstrated from what it merely intended. I am grateful to the department for the "
        "laboratory facilities and the freedom to work on a problem that required equal parts of "
        "systems engineering and careful measurement.", s_doc))
    flow.append(para(
        "I thank my classmates and project partners for the long arguments about false positives, "
        "verification and what constitutes evidence — arguments that repeatedly turned out to be "
        "about design rather than terminology. I thank the maintainers of the open-source libraries "
        "on which the implementation depends: the parsing library, the web framework, the "
        "object-relational mapper, the container runtime and the frontend framework. A prototype "
        "that must run untrusted code and measure itself stands on a great deal of patient work by "
        "others.", s_doc))
    flow.append(para(
        "Finally, I thank my family for their patience during the months when the project took more "
        "time than it promised, and for the steady encouragement that made the work possible. Any "
        "errors that remain in the system described here, and in the description itself, are my "
        "own.", s_doc))
    flow.append(para(
        "I also record my appreciation for the wider research community whose published work made the design "
        "possible: the maintainers of static-analysis tooling and vulnerability benchmarks, the authors of the "
        "empirical studies on model-based code review, and the program-repair community whose insistence on "
        "execution as the only credible oracle shaped the verification engine described in Chapter 7. Working "
        "on a problem that others have already thought hard about is a humbling and useful experience, and the "
        "honest reporting conventions followed in this report are borrowed from that tradition rather than "
        "invented for it.", s_doc))
    flow.append(Spacer(1, 1.2 * cm))
    flow.append(P(f"<b>{fm['student']}</b>", s_body))
    flow.append(P(f"Roll Number {fm['roll']}   ·   Section {fm['section']}", s_body))
    flow.append(PageBreak())

    # ---------------------------------------------------------------- abstract
    flow.append(P("ABSTRACT", s_h1))
    flow.append(Spacer(1, 0.3 * cm))
    flow.append(para(
        "Software audits today are performed by tools that report defects with more confidence than "
        "they can support. Pattern-based scanners locate suspicious shapes without establishing "
        "whether the value reaching a dangerous operation is attacker-controlled; language models "
        "explain code fluently while producing claims that no repository evidence grounds; automated "
        "repair assistants propose patches without demonstrating that behaviour is preserved. A "
        "reviewer is left to reconcile three unverified opinions, and pays for that reconciliation "
        "exactly where time is least available.", s_doc))
    flow.append(para(
        "This project presents **RepoVeriX**, a research prototype for repository-level code "
        "auditing and verified automated repair, built on the principle that *the LLM proposes; "
        "evidence and execution verify*. RepoVeriX ingests a repository from an archive or a shallow "
        "clone under path-traversal and size guards, parses Python, JavaScript and TypeScript with "
        "tree-sitter, constructs a symbol, import and call graph, and applies a deterministic rule "
        "set that runs on every scan regardless of whether a model provider is configured. For each "
        "candidate it assembles a bounded, redacted context package, obtains a structured assessment "
        "from a pluggable provider, and then adjudicates the candidate into a VERIFIED, PROBABLE or "
        "REJECTED finding with an ordered evidence chain — source, transformation, sink, static "
        "analysis, call relationship and reasoning — where the minimum required evidence is asserted "
        "in code rather than in the prompt.", s_doc))
    flow.append(para(
        "Repairs follow the same two-tier logic: deterministic templates where the code matches a "
        "known shape exactly, and model-authored diffs otherwise, validated for applicability before "
        "storage. No repair is declared verified until it has been applied to a disposable copy of "
        "the repository and has survived a static baseline comparison, execution of the project's "
        "own test suite inside a resource-limited container, and a re-analysis that requires the "
        "original rule to stop firing. Tests passing alone never produce a verified verdict, and a "
        "verification that cannot run is reported as not verified rather than as success.", s_doc))
    flow.append(para(
        "The delivered system comprises a FastAPI service with 112 route declarations across 22 "
        "routers, a schema of 28 tables with ten migration revisions, an analysis engine of 45 "
        "modules and 13,402 lines, a Next.js interface of 40 routes and 22,580 lines, nine versioned "
        "prompt templates, and a test suite of 544 test functions. A benchmark apparatus supports "
        "four audit configurations over two seeded vulnerable repositories with ten annotated "
        "defects and computes precision, recall, F1 and false-positive rate from real runs, "
        "rendering undefined quantities as TBD rather than fabricating them. The quantitative "
        "comparison across the four configurations has not been executed for this report and is "
        "reported as pending; the properties that are demonstrable from the repository — non-mutation "
        "of originals, secret redaction, per-stage failure recording, addressable evidence chains, "
        "execution-gated repair verdicts and the refusal to invent metrics — are documented with the "
        "mechanism that enforces each.", s_doc))
    flow.append(Spacer(1, 0.35 * cm))
    flow.append(P("<b>Keywords:</b> repository-level code auditing; evidence-grounded analysis; "
                  "automated program repair; execution-based verification; static analysis; large "
                  "language models; secure software development; sandboxed testing; benchmark "
                  "evaluation.", s_body))
    flow.append(PageBreak())

    # ---------------------------------------------------------------- table of contents
    flow.append(P("TABLE OF CONTENTS", s_h1))
    flow.append(Spacer(1, 0.2 * cm))
    toc_pages_at = len(flow)

    def toc_line(level, text, page):
        style = s_toc1 if level == 1 else s_toc2
        dots = "." * max(6, int((usable * 0.92) / 4.6) - len(text))
        label = f"{text}  {dots}  {page if page is not None else '—'}"
        return Paragraph(label.replace("&", "&amp;"), style)

    entries = doc.toc
    if page_numbers is None:
        for level, text, _ in entries:
            flow.append(toc_line(level, text, None))
        flow.append(PageBreak())
        flow.append(P("LIST OF FIGURES", s_h1))
        flow.append(Spacer(1, 0.2 * cm))
        for n, cap, _ in doc.figures:
            flow.append(toc_line(2, f"Figure {n}.  {plain(cap)[:96]}", None))
        flow.append(Spacer(1, 0.45 * cm))
        flow.append(P("LIST OF TABLES", s_h1))
        flow.append(Spacer(1, 0.2 * cm))
        for n, cap, _ in doc.tables:
            flow.append(toc_line(1, f"Table {n}.  {plain(cap)[:96]}", None))
        flow.append(PageBreak())
    else:
        for level, text, idx in entries:
            flow.append(toc_line(level, text, page_numbers.get(idx)))
        flow.append(PageBreak())
        flow.append(P("LIST OF FIGURES", s_h1))
        flow.append(Spacer(1, 0.2 * cm))
        for n, cap, _ in doc.figures:
            flow.append(toc_line(2, f"Figure {n}.  {plain(cap)[:96]}", page_numbers.get(("fig", n))))
        flow.append(Spacer(1, 0.45 * cm))
        flow.append(P("LIST OF TABLES", s_h1))
        flow.append(Spacer(1, 0.2 * cm))
        for n, cap, _ in doc.tables:
            flow.append(toc_line(1, f"Table {n}.  {plain(cap)[:96]}", page_numbers.get(("tab", n))))
        flow.append(PageBreak())

    # ---------------------------------------------------------------- abbreviations
    flow.append(P("LIST OF ABBREVIATIONS", s_h1))
    flow.append(Spacer(1, 0.2 * cm))
    abbr = [
        ("API", "Application Programming Interface"),
        ("ASGI", "Asynchronous Server Gateway Interface"),
        ("AST", "Abstract Syntax Tree"),
        ("CRUD", "Create, Read, Update, Delete"),
        ("CI", "Continuous Integration"),
        ("CSP", "Content Security Policy"),
        ("CSS", "Cascading Style Sheets"),
        ("DAG", "Directed Acyclic Graph"),
        ("F1", "Harmonic mean of precision and recall"),
        ("FPR", "False Positive Rate"),
        ("GHCR", "GitHub Container Registry"),
        ("HTML", "Hypertext Markup Language"),
        ("HSTS", "HTTP Strict Transport Security"),
        ("HTTP", "Hypertext Transfer Protocol"),
        ("IDE", "Integrated Development Environment"),
        ("IDOR", "Insecure Direct Object Reference"),
        ("JSON", "JavaScript Object Notation"),
        ("JWT", "JSON Web Token"),
        ("LLM", "Large Language Model"),
        ("MVP", "Minimum Viable Product"),
        ("ORM", "Object-Relational Mapper"),
        ("PR", "Pull Request"),
        ("RBAC", "Role-Based Access Control"),
        ("REST", "Representational State Transfer"),
        ("RQ", "Research Question"),
        ("SARIF", "Static Analysis Results Interchange Format"),
        ("SEO", "Search Engine Optimisation"),
        ("SQL", "Structured Query Language"),
        ("SSRF", "Server-Side Request Forgery"),
        ("TBD", "To Be Determined (value pending experimental execution)"),
        ("TLS", "Transport Layer Security"),
        ("TS", "TypeScript"),
        ("UI", "User Interface"),
        ("UTC", "Coordinated Universal Time"),
        ("UUID", "Universally Unique Identifier"),
    ]
    abbr_tbl = Table(
        [[Paragraph("<b>Abbreviation</b>", s_thead), Paragraph("<b>Expansion</b>", s_thead)]] +
        [[Paragraph(a, s_tcell), Paragraph(b, s_tcell)] for a, b in abbr],
        colWidths=[usable * 0.24, usable * 0.76], repeatRows=1, hAlign="LEFT",
    )
    st = [
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
    ]
    for i in range(1, len(abbr) + 1):
        if i % 2 == 0:
            st.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    abbr_tbl.setStyle(TableStyle(st))
    flow.append(abbr_tbl)
    # the template must be switched BEFORE the break so that the first body page
    # is drawn with the body template (header + arabic folio)
    flow.append(NextPageTemplate("body"))
    flow.append(PageBreak())

    # ---------------------------------------------------------------- body
    flow.append(Marker(body_start=True))
    for i, b in enumerate(doc.blocks):
        kind = b["t"]
        if kind == "h1":
            flow.append(CondPageBreak(3.1 * cm) if i else CondPageBreak(0))
            if i:
                flow.append(Spacer(1, 0.55 * cm))
                flow.append(HRule(usable, 0.7, RULE, 8))
                flow.append(Spacer(1, 0.15 * cm))
            flow.append(Marker(key=i))
            flow.append(P(heading_text(b), s_h1))
        elif kind == "h2":
            flow.append(CondPageBreak(2.4 * cm))
            flow.append(Marker(key=i))
            flow.append(P(heading_text(b), s_h2))
        elif kind == "h3":
            flow.append(P(heading_text(b), s_h3))
        elif kind == "p":
            flow.append(para(b["text"]))
        elif kind == "note":
            flow.append(P(b["text"], s_note))
        elif kind == "bullets":
            for it in b["items"]:
                flow.append(para(it, s_bullet, bulletText="\u2022"))
        elif kind == "numbers":
            for n, it in enumerate(b["items"], 1):
                flow.append(para(it, s_num, bulletText=f"{n}."))
        elif kind == "refs":
            for it in b["items"]:
                flow.append(para(it, s_refs, bulletText="\u2022"))
        elif kind == "table":
            flow.append(Marker(key=("tab", b["num"])))
            flow.append(make_table(b))
            flow.append(fig_source(b))
        elif kind == "figure":
            caption = fig_caption(b)
            flow.append(Marker(key=("fig", b["num"])))
            path = FIG_DIR / Path(b["path"]).name
            from PIL import Image as PILImage
            w, h = PILImage.open(path).size
            # scale so that both the available width and 62% of the text height fit
            max_h = (A4[1] - top - bottom) * 0.62
            width = min(usable, max_h * w / h)
            img = Image(str(path), width=width, height=width * h / w)
            flow.append(KeepTogether([Spacer(1, 3), img, caption]))
            flow.append(fig_source(b))
        elif kind == "closing":
            flow.append(Spacer(1, 0.6 * cm))
            flow.append(HRule(usable, 0.5, RULE, 8))
            flow.append(P("End of report", s_center))
            flow.append(Spacer(1, 0.4 * cm))
            flow.append(P(f"<b>{FRONT_MATTER['student']}</b>", s_center))
            flow.append(P(f"Roll Number {FRONT_MATTER['roll']}   ·   Section {FRONT_MATTER['section']}", s_center))

    tmpl.build(flow)
    return pages_meta


# =========================================================================== DOCX renderer
def build_docx(doc: Doc, out_path: Path, page_numbers):
    from docx import Document
    from docx.enum.section import WD_SECTION
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    ACCENT = RGBColor(0x14, 0x50, 0x3C)
    INK = RGBColor(0x1D, 0x25, 0x29)
    MUTED = RGBColor(0x5B, 0x6B, 0x70)
    WHITE = RGBColor(0xFF, 0xFF, 0xFF)
    USABLE_CM = 21.0 - 2.35 - 2.15

    document = Document()
    normal = document.styles["Normal"]
    normal.font.name = "Cambria"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    rpr = normal.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), "Cambria")
    pf = normal.paragraph_format
    pf.space_after = Pt(4.6)
    pf.space_before = Pt(0)
    pf.line_spacing = 1.0

    def shade(el, hex_fill):
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), hex_fill)
        el.append(shd)

    def para_border_bottom(p, size=6, color="C9D2CE"):
        pPr = p._p.get_or_add_pPr()
        borders = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), str(size))
        bottom.set(qn("w:space"), "3")
        bottom.set(qn("w:color"), color)
        borders.append(bottom)
        pPr.append(borders)

    def add_field(paragraph, instr):
        r = paragraph.add_run()
        f1 = OxmlElement("w:fldChar"); f1.set(qn("w:fldCharType"), "begin")
        it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = instr
        f2 = OxmlElement("w:fldChar"); f2.set(qn("w:fldCharType"), "separate")
        t = OxmlElement("w:t"); t.text = "1"
        f3 = OxmlElement("w:fldChar"); f3.set(qn("w:fldCharType"), "end")
        r._r.append(f1); r._r.append(it); r._r.append(f2); r._r.append(t); r._r.append(f3)
        return r

    def set_page_numbering(section, fmt="decimal", start=1):
        sectPr = section._sectPr
        existing = sectPr.find(qn("w:pgNumType"))
        if existing is not None:
            sectPr.remove(existing)
        pg = OxmlElement("w:pgNumType")
        pg.set(qn("w:fmt"), fmt)
        pg.set(qn("w:start"), str(start))
        sectPr.append(pg)

    def page_setup(section):
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.left_margin = Cm(2.35)
        section.right_margin = Cm(2.15)
        section.top_margin = Cm(2.2)
        section.bottom_margin = Cm(1.95)
        section.header_distance = Cm(1.1)
        section.footer_distance = Cm(0.9)

    def rich(p, text, size=None, color=None, bold=False, italic=False):
        for chunk, b, i in rich_runs(text):
            r = p.add_run(chunk)
            r.bold = b or bold
            r.italic = i or italic
            if size:
                r.font.size = Pt(size)
            if color:
                r.font.color.rgb = color
        return p

    def para(text="", size=10.5, color=INK, bold=False, italic=False, align="justify",
             space_after=4.6, space_before=0, indent=0, first_indent=0, keep_next=False,
             style=None, line=1.0):
        p = document.add_paragraph(style=style) if style else document.add_paragraph()
        pf = p.paragraph_format
        pf.alignment = {"justify": WD_ALIGN_PARAGRAPH.JUSTIFY, "center": WD_ALIGN_PARAGRAPH.CENTER,
                        "left": WD_ALIGN_PARAGRAPH.LEFT, "right": WD_ALIGN_PARAGRAPH.RIGHT}[align]
        pf.space_after = Pt(space_after)
        pf.space_before = Pt(space_before)
        pf.line_spacing = line
        if indent:
            pf.left_indent = Cm(indent)
        if first_indent:
            pf.first_line_indent = Cm(first_indent)
        pf.keep_with_next = keep_next
        if text:
            rich(p, text, size=size, color=color, bold=bold, italic=italic)
        return p

    def heading(text, level):
        p = document.add_paragraph()
        pf = p.paragraph_format
        pf.space_before = Pt(0 if level == 1 else 9)
        pf.space_after = Pt(9 if level == 1 else 3.5)
        pf.keep_with_next = True
        pf.line_spacing = 1.0
        r = p.add_run(text)
        r.bold = True
        r.font.color.rgb = ACCENT
        r.font.size = Pt(16.5 if level == 1 else 12.2)
        if level == 3:
            r.italic = True
            r.font.color.rgb = INK
        if level == 1:
            bm = OxmlElement("w:bookmarkStart")
            return p
        return p

    def bullet(text, numbered=None, size=10.5, indent=0.62):
        p = document.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(indent + 0.55)
        pf.first_line_indent = Cm(-0.55)
        pf.space_after = Pt(2.8)
        pf.line_spacing = 1.02
        pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        prefix = f"{numbered}.  " if numbered is not None else "\u2022  "
        r = p.add_run(prefix)
        r.font.size = Pt(size)
        rich(p, text, size=size)
        return p

    def table_block(block, size=8.1):
        cols = block["cols"]
        total = sum(cols)
        table = document.add_table(rows=1, cols=len(cols))
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.LEFT
        table.autofit = False
        tblPr = table._tbl.tblPr
        layout = OxmlElement("w:tblLayout")
        layout.set(qn("w:type"), "fixed")
        tblPr.append(layout)

        def cell_text(cell, text, bold=False, color=None, size_pt=size, white=False):
            cell.text = ""
            p = cell.paragraphs[0]
            pf = p.paragraph_format
            pf.space_after = Pt(1.5)
            pf.space_before = Pt(1.5)
            pf.line_spacing = 1.05
            rich(p, str(text), size=size_pt, color=color, bold=bold)

        widths = [Cm(w / total * USABLE_CM) for w in cols]
        hdr = table.rows[0]
        trPr = hdr._tr.get_or_add_trPr()
        th = OxmlElement("w:tblHeader"); trPr.append(th)
        for i, h in enumerate(block["head"]):
            c = hdr.cells[i]
            c.width = widths[i]
            cell_text(c, h, bold=True, color=WHITE, white=True)
            shade(c._tc.get_or_add_tcPr(), "14503C")
        for ridx, row in enumerate(block["rows"]):
            r = table.add_row()
            trPr = r._tr.get_or_add_trPr()
            cant = OxmlElement("w:cantSplit"); trPr.append(cant)
            for i, val in enumerate(row):
                c = r.cells[i]
                c.width = widths[i]
                cell_text(c, val)
                if ridx % 2 == 1:
                    shade(c._tc.get_or_add_tcPr(), "F6F8F7")
        # tighten cell margins
        tblPr2 = table._tbl.tblPr
        mar = OxmlElement("w:tblCellMar")
        for side, w in (("top", 40), ("bottom", 40), ("left", 70), ("right", 70)):
            el = OxmlElement(f"w:{side}")
            el.set(qn("w:w"), str(w))
            el.set(qn("w:type"), "dxa")
            mar.append(el)
        tblPr2.append(mar)
        return table

    # ---------------------------------------------------------------- sections
    sec = document.sections[0]
    page_setup(sec)
    sec.different_first_page_header_footer = False

    # cover
    for _ in range(1):
        p = para(FRONT_MATTER["institution"].upper(), size=14, color=INK, bold=True, align="center",
                 space_after=2)
        para(FRONT_MATTER["programme"], size=11.5, color=MUTED, align="center", space_after=6)
        rule = para("", align="center", space_after=54)
        para("A PROJECT REPORT ON", size=11.5, color=MUTED, align="center", space_after=8)
        para(FRONT_MATTER["project_title"], size=30, color=ACCENT, bold=True, align="center", space_after=2)
        para(FRONT_MATTER["project_subtitle"], size=12.5, color=INK, italic=True, align="center", space_after=26)
        para("", align="center", space_after=40)
        para("Submitted in partial fulfilment of the requirements for the award of the degree of",
             size=11.5, color=MUTED, align="center", space_after=3)
        para("Bachelor of Technology in Computer Science and Engineering", size=11, align="center", space_after=34)
        para("Submitted by", size=11.5, color=MUTED, align="center", space_after=4)
        para(FRONT_MATTER["student"], size=13, bold=True, align="center", space_after=2)
        para(f"Roll Number {FRONT_MATTER['roll']}   ·   Section {FRONT_MATTER['section']}",
             size=11.5, color=MUTED, align="center", space_after=26)
        para("Under the guidance of", size=11.5, color=MUTED, align="center", space_after=4)
        para(FRONT_MATTER["guide"], size=12, align="center", space_after=2)
        para(FRONT_MATTER["guide_line"], size=11.5, color=MUTED, align="center", space_after=40)
        last = para(FRONT_MATTER["session"], size=11.5, color=MUTED, align="center", space_after=2)
        para("Department of Computer Science and Engineering", size=11.5, color=MUTED, align="center")

    # front matter section
    front = document.add_section(WD_SECTION.NEW_PAGE)
    page_setup(front)
    set_page_numbering(front, "upperRoman", 2)   # the cover is implicitly page i
    front.header.is_linked_to_previous = False
    front.footer.is_linked_to_previous = False
    fp = front.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_field(fp, " PAGE ")
    for r in fp.runs:
        r.font.size = Pt(9)
        r.font.color.rgb = MUTED
        r.font.name = "Cambria"

    # certificate
    heading("CERTIFICATE", 1)
    para("", space_after=10)
    para("This is to certify that the project report entitled **“RepoVeriX — Evidence-Grounded "
         "Repository-Level Code Auditing and Verified Automated Repair”** is the bona fide work carried "
         f"out by **{FRONT_MATTER['student']}** (Roll Number {FRONT_MATTER['roll']}), a student of "
         f"{FRONT_MATTER['programme']} at the {FRONT_MATTER['institution']}, in partial fulfilment of "
         "the requirements for the award of the degree of Bachelor of Technology.", space_after=9)
    para("The work recorded in this report was carried out under my supervision during the "
         f"{FRONT_MATTER['session']}. The report has been prepared in accordance with the guidelines "
         "issued by the department, and the contents of this report have not been submitted, in whole "
         "or in part, for the award of any other degree or diploma at this or any other institution.",
         space_after=9)
    para("The project addresses evidence-grounded repository-level code auditing and verified automated "
         "repair. The implementation, the benchmark apparatus and the documentation described in the "
         "chapters that follow were examined during the preparation of this report. To the best of my "
         "knowledge, the report represents the candidate's own work, and all external material used has "
         "been acknowledged in the references.", space_after=9)
    para("The report documents the system as it exists in the project repository rather than as it is intended "
         "to exist. Behaviour present in the code is described with reference to the module that provides it; "
         "behaviour that depends on an external service or an operator action is marked as documented; and "
         "quantitative results that require an experiment not yet executed are marked as pending. This "
         "distinction is maintained throughout so that the examiner can separate demonstrated capability from "
         "intended capability without ambiguity.", space_after=9)
    para("The project work includes the analysis engine, the service interface, the persistence schema, the "
         "developer interface, the benchmark apparatus and the supporting documentation. The candidate has "
         "presented the work at the internal review stages prescribed by the department, and the corrections "
         "suggested during those reviews have been incorporated into this version of the report.",
         space_after=44)
    t = document.add_table(rows=2, cols=2)
    t.autofit = False
    for i, (a, b) in enumerate([
        ("Signature of Guide", "Signature of Head of Department"),
        (FRONT_MATTER["guide"], FRONT_MATTER["hod"]),
    ]):
        c1, c2 = t.rows[i].cells
        for c, txt, bold in ((c1, a, i == 0), (c2, b, i == 0)):
            c.width = Cm(USABLE_CM / 2)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            rich(p, txt, size=10.5, bold=bold)
    para(FRONT_MATTER["guide_line"], size=9.5, color=MUTED, space_before=0, space_after=0)
    para("", space_after=40)
    para("Internal Examiner: ______________________________          External Examiner: "
         "______________________________", space_after=8)
    para("Date of Examination: ____________________               Place: ____________________",
         space_after=0)
    document.add_page_break()

    # declaration
    heading("DECLARATION", 1)
    para("", space_after=10)
    para(f"I, **{FRONT_MATTER['student']}**, student of {FRONT_MATTER['programme']}, Roll Number "
         f"{FRONT_MATTER['roll']}, Section {FRONT_MATTER['section']}, hereby declare that the project "
         "report entitled **“RepoVeriX — Evidence-Grounded Repository-Level Code Auditing and Verified "
         "Automated Repair”** submitted to the department is a record of original work carried out by me.",
         space_after=9)
    para("I further declare that the analysis, the system design, the implementation described in these "
         "chapters and the documentation of that implementation are my own work, and that the report does "
         "not contain any material that has been copied from any source without proper acknowledgement. "
         "Where the report describes behaviour that resides in the project repository, the description is "
         "derived from that repository; where a value could not be established from the repository, it has "
         "been marked as pending rather than estimated.", space_after=9)
    para("I understand that any breach of this declaration, including the fabrication of results or the "
         "misrepresentation of another's work as my own, is a matter of academic misconduct and may be "
         "dealt with under the disciplinary rules of the institution. I also understand that the examiners "
         "may require me to demonstrate or explain any part of this work.", space_after=9)
    para("I confirm that no part of this report was generated by presenting the project repository to a tool "
         "and accepting its output as documentation. The report was written from a line-by-line reading of the "
         "repository — its modules, its configuration, its schema, its route inventory, its prompts, its test "
         "modules and its documentation set — and every count, identifier and quoted limit in these chapters "
         "was taken from those sources. Where the repository did not determine an answer, the report says so "
         "instead of supplying one.", space_after=9)
    para("I also confirm that the figures in this report are conceptual diagrams generated from verified "
         "repository facts, that no product screenshot has been fabricated, and that the sources for each "
         "figure are recorded in its caption. The repository has been acknowledged in the references as the "
         "primary source for the system described here.", space_after=56)
    p = para("Date: ____________________", space_after=2)
    p2 = para(FRONT_MATTER["student"], bold=True, align="right", space_after=0)
    para(f"Roll Number {FRONT_MATTER['roll']}", align="right", space_after=0)
    document.add_page_break()

    # acknowledgement
    heading("ACKNOWLEDGEMENT", 1)
    para("", space_after=6)
    for txt in [
        "A project of this kind accumulates debts that are easy to forget and impossible to repay "
        "individually. I record them here with gratitude.",
        "I am deeply thankful to my project guide for the supervision that shaped this work. The guidance "
        "was consistently of the kind that improves a system rather than merely approving it: questions "
        "about what the software could actually prove, insistence that an unmeasured result be labelled as "
        "such, and repeated pressure to state claims in a form that another person could check. Much of "
        "what is honest about both the system and this report came from that pressure.",
        "I extend my sincere thanks to the Head of the Department and to the faculty members of the "
        "Department of Computer Science and Engineering for the academic environment in which the work was "
        "carried out, and for the reviews that helped me separate what the project demonstrated from what "
        "it merely intended. I am grateful to the department for the laboratory facilities and the freedom "
        "to work on a problem that required equal parts of systems engineering and careful measurement.",
        "I thank my classmates and project partners for the long arguments about false positives, "
        "verification and what constitutes evidence — arguments that repeatedly turned out to be about "
        "design rather than terminology. I thank the maintainers of the open-source libraries on which the "
        "implementation depends: the parsing library, the web framework, the object-relational mapper, the "
        "container runtime and the frontend framework. A prototype that must run untrusted code and "
        "measure itself stands on a great deal of patient work by others.",
        "Finally, I thank my family for their patience during the months when the project took more time "
        "than it promised, and for the steady encouragement that made the work possible. Any errors that "
        "remain in the system described here, and in the description itself, are my own.",
        "I also record my appreciation for the wider research community whose published work made the design "
        "possible: the maintainers of static analysis tooling and vulnerability benchmarks, the authors of the "
        "empirical studies on model-based code review, and the program-repair community whose insistence on "
        "execution as the only credible oracle shaped the verification engine described in Chapter 7. Working "
        "on a problem that others have already thought hard about is a humbling and useful experience, and the "
        "honest reporting conventions followed in this report are borrowed from that tradition rather than "
        "invented for it.",
    ]:
        para(txt, space_after=8)
    para("", space_after=44)
    para(FRONT_MATTER["student"], bold=True, space_after=2)
    para(f"Roll Number {FRONT_MATTER['roll']}   ·   Section {FRONT_MATTER['section']}", space_after=0)
    document.add_page_break()

    # abstract
    heading("ABSTRACT", 1)
    para("", space_after=6)
    for txt in [
        "Software audits today are performed by tools that report defects with more confidence than they "
        "can support. Pattern-based scanners locate suspicious shapes without establishing whether the "
        "value reaching a dangerous operation is attacker-controlled; language models explain code "
        "fluently while producing claims that no repository evidence grounds; automated repair assistants "
        "propose patches without demonstrating that behaviour is preserved. A reviewer is left to "
        "reconcile three unverified opinions, and pays for that reconciliation exactly where time is least "
        "available.",
        "This project presents **RepoVeriX**, a research prototype for repository-level code auditing and "
        "verified automated repair, built on the principle that *the LLM proposes; evidence and execution "
        "verify*. RepoVeriX ingests a repository from an archive or a shallow clone under path-traversal "
        "and size guards, parses Python, JavaScript and TypeScript with tree-sitter, constructs a symbol, "
        "import and call graph, and applies a deterministic rule set that runs on every scan regardless of "
        "whether a model provider is configured. For each candidate it assembles a bounded, redacted "
        "context package, obtains a structured assessment from a pluggable provider, and then adjudicates "
        "the candidate into a VERIFIED, PROBABLE or REJECTED finding with an ordered evidence chain — "
        "source, transformation, sink, static analysis, call relationship and reasoning — where the "
        "minimum required evidence is asserted in code rather than in the prompt.",
        "Repairs follow the same two-tier logic: deterministic templates where the code matches a known "
        "shape exactly, and model-authored diffs otherwise, validated for applicability before storage. No "
        "repair is declared verified until it has been applied to a disposable copy of the repository and "
        "has survived a static baseline comparison, execution of the project's own test suite inside a "
        "resource-limited container, and a re-analysis that requires the original rule to stop firing. "
        "Tests passing alone never produce a verified verdict, and a verification that cannot run is "
        "reported as not verified rather than as success.",
        "The delivered system comprises a FastAPI service with 112 route declarations across 22 routers, a "
        "schema of 28 tables with ten migration revisions, an analysis engine of 45 modules and 13,402 "
        "lines, a Next.js interface of 40 routes and 22,580 lines, nine versioned prompt templates, and a "
        "test suite of 544 test functions. A benchmark apparatus supports four audit configurations over "
        "two seeded vulnerable repositories with ten annotated defects and computes precision, recall, F1 "
        "and false-positive rate from real runs, rendering undefined quantities as TBD rather than "
        "fabricating them. The quantitative comparison across the four configurations has not been "
        "executed for this report and is reported as pending; the properties that are demonstrable from "
        "the repository — non-mutation of originals, secret redaction, per-stage failure recording, "
        "addressable evidence chains, execution-gated repair verdicts and the refusal to invent metrics — "
        "are documented with the mechanism that enforces each.",
    ]:
        para(txt, space_after=8)
    pb = document.add_paragraph()
    pb.paragraph_format.space_before = Pt(4)
    r = pb.add_run("Keywords: ")
    r.bold = True
    pb.add_run("repository-level code auditing; evidence-grounded analysis; automated program repair; "
               "execution-based verification; static analysis; large language models; secure software "
               "development; sandboxed testing; benchmark evaluation.")
    document.add_page_break()

    # table of contents
    heading("TABLE OF CONTENTS", 1)
    para("", space_after=4)

    def toc_entry(text, page, level=1):
        p = document.add_paragraph()
        pf = p.paragraph_format
        pf.space_after = Pt(3.5 if level == 2 else 5)
        pf.space_before = Pt(0)
        pf.line_spacing = 1.0
        pf.left_indent = Cm(0.55 if level == 2 else 0)
        pf.tab_stops.add_tab_stop(Cm(USABLE_CM), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        r = p.add_run(text)
        r.font.size = Pt(10.4 if level == 1 else 10)
        r.bold = level == 1
        r2 = p.add_run("\t" + (str(page) if page is not None else "—"))
        r2.font.size = Pt(10.4 if level == 1 else 10)
        r2.bold = level == 1
        return p

    for level, text, idx in doc.toc:
        toc_entry(text, page_numbers.get(idx), level)
    document.add_page_break()

    heading("LIST OF FIGURES", 1)
    para("", space_after=4)
    for n, cap, _ in doc.figures:
        toc_entry(f"Figure {n}.  {plain(cap)}", page_numbers.get(("fig", n)), 2)
    document.add_page_break()

    heading("LIST OF TABLES", 1)
    para("", space_after=4)
    for n, cap, _ in doc.tables:
        toc_entry(f"Table {n}.  {plain(cap)}", page_numbers.get(("tab", n)), 2)
    document.add_page_break()

    heading("LIST OF ABBREVIATIONS", 1)
    para("", space_after=4)
    abbr = [
        ("API", "Application Programming Interface"), ("AST", "Abstract Syntax Tree"),
        ("CI", "Continuous Integration"), ("CSP", "Content Security Policy"),
        ("CSS", "Cascading Style Sheets"), ("DAG", "Directed Acyclic Graph"),
        ("F1", "Harmonic mean of precision and recall"), ("FPR", "False Positive Rate"),
        ("GHCR", "GitHub Container Registry"),
        ("HTML", "Hypertext Markup Language"), ("HSTS", "HTTP Strict Transport Security"),
        ("HTTP", "Hypertext Transfer Protocol"), ("IDE", "Integrated Development Environment"),
        ("IDOR", "Insecure Direct Object Reference"), ("JSON", "JavaScript Object Notation"),
        ("JWT", "JSON Web Token"), ("LLM", "Large Language Model"),
        ("MVP", "Minimum Viable Product"), ("NFR", "Non-Functional Requirement"),
        ("ORM", "Object-Relational Mapper"), ("PII", "Personally Identifiable Information"),
        ("PR", "Pull Request"), ("RBAC", "Role-Based Access Control"),
        ("REST", "Representational State Transfer"), ("RQ", "Research Question"),
        ("SHA", "Secure Hash Algorithm"),
        ("SARIF", "Static Analysis Results Interchange Format"), ("SEO", "Search Engine Optimisation"),
        ("SQL", "Structured Query Language"), ("SSRF", "Server-Side Request Forgery"),
        ("TBD", "To Be Determined (pending experimental execution)"),
        ("TLS", "Transport Layer Security"), ("TS", "TypeScript"), ("UI", "User Interface"),
        ("UTC", "Coordinated Universal Time"), ("UUID", "Universally Unique Identifier"),
        ("XML", "Extensible Markup Language"), ("XSS", "Cross-Site Scripting"),
    ]
    table_block({"cols": [24, 76], "head": ["Abbreviation", "Expansion"], "rows": abbr}, size=9)

    # body section
    body = document.add_section(WD_SECTION.NEW_PAGE)
    page_setup(body)
    set_page_numbering(body, "decimal", 1)
    body.header.is_linked_to_previous = False
    body.footer.is_linked_to_previous = False
    hp = body.header.paragraphs[0]
    hp.paragraph_format.space_after = Pt(2)
    hp.paragraph_format.tab_stops.add_tab_stop(Cm(USABLE_CM), WD_TAB_ALIGNMENT.RIGHT)
    r = hp.add_run("RepoVeriX  |  Evidence-Grounded Repository Auditing and Verified Repair")
    r.font.size = Pt(8.4)
    r.font.color.rgb = MUTED
    r2 = hp.add_run("\tProject Report")
    r2.font.size = Pt(8.4)
    r2.font.color.rgb = MUTED
    para_border_bottom(hp, 4)
    bfp = body.footer.paragraphs[0]
    bfp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_field(bfp, " PAGE ")
    for r in bfp.runs:
        r.font.size = Pt(9)
        r.font.color.rgb = MUTED
        r.font.name = "Cambria"

    first = True
    for b in doc.blocks:
        kind = b["t"]
        if kind == "h1":
            if not first:
                sp = document.add_paragraph()
                sp.paragraph_format.space_before = Pt(10)
                sp.paragraph_format.space_after = Pt(0)
                sp.paragraph_format.line_spacing = 1.0
                para_border_bottom(sp, 6)
            first = False
            heading(heading_text(b), 1)
        elif kind == "h2":
            heading(heading_text(b), 2)
        elif kind == "h3":
            heading(heading_text(b), 3)
        elif kind == "p":
            para(b["text"])
        elif kind == "note":
            para(b["text"], size=9, color=MUTED, italic=True, space_after=6)
        elif kind == "bullets":
            for it in b["items"]:
                bullet(it)
        elif kind == "numbers":
            for n, it in enumerate(b["items"], 1):
                bullet(it, numbered=n)
        elif kind == "refs":
            for it in b["items"]:
                p = bullet(it, size=10.3, indent=1.0)
        elif kind == "table":
            cap = document.add_paragraph()
            cap.paragraph_format.space_before = Pt(4)
            cap.paragraph_format.space_after = Pt(4)
            cap.paragraph_format.keep_with_next = True
            rich(cap, f"**Table {b['num']}.** {plain(b['caption'])}", size=9.4)
            table_block(b)
            src = para(b.get("source", ""), size=8.2, color=MUTED, italic=True, space_before=3,
                       space_after=9)
        elif kind == "figure":
            img_p = document.add_paragraph()
            img_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            img_p.paragraph_format.space_before = Pt(4)
            img_p.paragraph_format.space_after = Pt(2)
            img_p.paragraph_format.keep_with_next = True
            path = FIG_DIR / Path(b["path"]).name
            run = img_p.add_run()
            from PIL import Image as PILImage
            wpx, hpx = PILImage.open(path).size
            max_h_cm = (29.7 - 2.2 - 1.95) * 0.62
            wcm = min(USABLE_CM, max_h_cm * wpx / hpx)
            run.add_picture(str(path), width=Cm(wcm))
            cap = para(f"**Figure {b['num']}.** {plain(b['caption'])}", size=9.4, align="center",
                       space_after=2)
            para(b.get("source", ""), size=8.2, color=MUTED, italic=True, align="center", space_after=10)
        elif kind == "closing":
            para("", space_after=18)
            p = para("End of report", align="center", space_after=10)
            para(FRONT_MATTER["student"], bold=True, align="center", space_after=2)
            para(f"Roll Number {FRONT_MATTER['roll']}   ·   Section {FRONT_MATTER['section']}",
                 align="center", space_after=0)

    document.save(str(out_path))


# =========================================================================== driver
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = Doc()
    print(f"blocks: {len(doc.blocks)}  figures: {len(doc.figures)}  tables: {len(doc.tables)}  "
          f"toc entries: {len(doc.toc)}  words: {doc.word_count():,}")

    first_h1 = next(i for i, b in enumerate(doc.blocks) if b["t"] == "h1")
    tmp = OUT_DIR / "_pass1.pdf"
    meta = build_pdf(doc, tmp, page_numbers=None)
    body_start = meta["headings"][first_h1]

    # The page a heading really occupies is read back from the rendered pass-1
    # document rather than trusting in-flow markers: a zero-height marker can be
    # flushed at the foot of a page while the heading itself is pushed over.
    nums = locate_pages(doc, tmp, body_start, first_h1)
    final = OUT_DIR / "RepoVeriX_Project_Report.pdf"
    meta2 = build_pdf(doc, final, page_numbers=nums, body_start=body_start)
    verify = locate_pages(doc, final, body_start, first_h1)
    shifted = [k for k in nums if verify.get(k) != nums[k]]
    if shifted:
        print(f"WARNING pagination shifted for {len(shifted)} entries: {shifted[:5]}")
        nums = verify                      # the printed PDF is the authority
        build_docx_pages = verify
    else:
        build_docx_pages = nums
    tmp.unlink(missing_ok=True)

    build_docx(doc, OUT_DIR / "RepoVeriX_Project_Report.docx", build_docx_pages)
    print("wrote", final)
    print("wrote", OUT_DIR / "RepoVeriX_Project_Report.docx")


if __name__ == "__main__":
    main()
