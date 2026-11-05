"""Generate the conceptual diagrams used in the RepoVeriX project report.

Every diagram is derived from verified repository information (module inventory,
API route counts, documented stage order, database models, deployment files).
No product screenshots are fabricated and no stock images are used.

Run:  python report/figures/make_figures.py
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

HERE = Path(__file__).resolve().parent
OUT = HERE
ROOT = HERE.parent.parent

ACCENT = "#14503c"
ACCENT_LIGHT = "#eaf2ee"
INK = "#1d2529"
MUTED = "#5b6b70"
WARN = "#8a4b12"
WARN_LIGHT = "#fbf0e3"
GREY = "#8c9aa0"
GRID = "#c9d2ce"

FONT_DIR = Path("/home/user/report_assets/fonts")
for f in FONT_DIR.glob("*.ttf"):
    font_manager.fontManager.addfont(str(f))

plt.rcParams.update(
    {
        "font.family": "Caladea",
        "font.size": 9,
        "axes.linewidth": 0.0,
        "savefig.dpi": 240,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.05,
    }
)


class Canvas:
    """Top-down drawing canvas: y coordinates are measured from the top edge."""

    def __init__(self, w_in, design_height):
        """design_height is expressed in the same 0-100 units as the x axis."""
        self.w, self.H = w_in, float(design_height)
        self.fig, self.ax = plt.subplots(figsize=(w_in, w_in * self.H / 100.0))
        self.ax.set_xlim(0, 100)
        self.ax.set_ylim(0, self.H)
        self.ax.axis("off")

    def y(self, top, h):
        return self.H - top - h

    def band(self, x, top, w, h, label, fill="#f6f8f7", label_size=7.2):
        y = self.y(top, h)
        self.ax.add_patch(
            FancyBboxPatch(
                (x, y), w, h,
                boxstyle="round,pad=0,rounding_size=1.1",
                lw=0.9, ls=(0, (3, 2)), ec=GRID, fc=fill, zorder=1,
            )
        )
        self.ax.text(
            x + 1.6, y + h - 1.6, label,
            ha="left", va="top", fontsize=label_size, color=MUTED, fontweight="bold", zorder=3,
        )

    def box(self, x, top, w, h, title, sub=None, fill="#ffffff", edge=ACCENT,
            title_size=8.0, sub_size=6.4, color=INK, bold=True, lw=1.0, subcolor=MUTED):
        y = self.y(top, h)
        self.ax.add_patch(
            FancyBboxPatch(
                (x, y), w, h,
                boxstyle="round,pad=0,rounding_size=0.7",
                lw=lw, ec=edge, fc=fill, zorder=2,
            )
        )
        if sub:
            ty = y + h * 0.568
            self.ax.text(x + w / 2, ty, title, ha="center", va="center",
                         fontsize=title_size, fontweight="bold" if bold else "normal",
                         color=color, zorder=3, linespacing=1.25)
            self.ax.text(x + w / 2, y + h * 0.245, sub, ha="center", va="center",
                         fontsize=sub_size, color=subcolor, zorder=3, linespacing=1.4)
        else:
            self.ax.text(x + w / 2, y + h / 2, title, ha="center", va="center",
                         fontsize=title_size, fontweight="bold" if bold else "normal",
                         color=color, zorder=3, linespacing=1.3)

    def arrow(self, p1, p2, label=None, color=ACCENT, lw=1.0, rad=0.0, ls="-",
              label_size=6.4, label_dy=1.0, label_dx=0.0):
        self.ax.add_patch(
            FancyArrowPatch(
                (p1[0], self.H - p1[1]), (p2[0], self.H - p2[1]),
                arrowstyle="-|>", mutation_scale=8, lw=lw, color=color,
                connectionstyle=f"arc3,rad={rad}", linestyle=ls, zorder=4,
                shrinkA=1.0, shrinkB=2.0,
            )
        )
        if label:
            mx = (p1[0] + p2[0]) / 2 + label_dx
            my = (p1[1] + p2[1]) / 2 + label_dy
            self.ax.text(mx, self.H - my, label, ha="center", va="bottom",
                         fontsize=label_size, color=MUTED, zorder=7,
                         bbox=dict(fc="white", ec="none", pad=0.6))

    def note(self, x, top, text, size=6.5, color=MUTED, ha="left", style="normal"):
        self.ax.text(x, self.H - top, text, ha=ha, va="top", fontsize=size,
                     color=color, style=style, linespacing=1.45)

    def save(self, name):
        path = OUT / name
        self.fig.savefig(path, facecolor="white")
        plt.close(self.fig)
        print("wrote", path.name)


def wrap(text, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= width:
            cur = f"{cur} {w}".strip()
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return "\n".join(lines)


# --------------------------------------------------------------------------- 1. architecture
def fig_architecture():
    c = Canvas(9.0, 92)
    M = 2.0
    W = 96.0

    # presentation
    c.band(M, 1.5, W, 16.5, "PRESENTATION LAYER  —  Next.js App Router (TypeScript, Tailwind, shadcn/ui)")
    cw, cgap = 17.2, 1.85
    for i, (t, s) in enumerate([
        ("Dashboard", "aggregate counts"),
        ("Repositories", "register / upload"),
        ("Scans", "configuration"),
        ("Findings", "evidence chain"),
        ("Patch verify", "diff + sandbox log"),
    ]):
        c.box(M + 2 + i * (cw + cgap), 6.8, cw, 8.6, t, s, title_size=7.6, sub_size=6.1)

    # api
    c.band(M, 21.0, W, 17.0, "API LAYER  —  FastAPI routers, JWT ownership checks, tiered rate limits")
    aw = 14.0
    agap = (W - 4 - 6 * aw) / 5
    for i, (t, s) in enumerate([
        ("repositories", "7 routes"), ("scans", "8 routes"), ("findings", "11 routes"),
        ("patches", "6 routes"), ("audit / research", "17 routes"), ("auth / account", "15 routes"),
    ]):
        c.box(M + 2 + i * (aw + agap), 26.4, aw, 8.8, t, s, title_size=7.0, sub_size=6.0)

    # engine
    c.band(M, 41.5, W, 25.5, "ANALYSIS ENGINE  —  backend/app/analysis  (44 modules, modular monolith)")
    ew, egap = 22.0, (W - 4 - 4 * 22.0) / 3
    for i, (t, s) in enumerate([
        ("Ingestion", "safe ZIP / shallow clone"),
        ("Parsing", "tree-sitter symbols, calls"),
        ("Knowledge graph", "callers, callees, imports"),
        ("Static detectors", "RVX-* rules, ruff/bandit"),
    ]):
        c.box(M + 2 + i * (ew + egap), 47.0, ew, 7.4, t, s, title_size=7.4, sub_size=6.0)
    for i, (t, s) in enumerate([
        ("Context builder", "bounded per-candidate package"),
        ("LLM reasoning", "versioned prompts, strict JSON"),
        ("Evidence engine", "deterministic adjudication"),
        ("Repair generator", "templates first, then LLM"),
    ]):
        c.box(M + 2 + i * (ew + egap), 56.5, ew, 7.4, t, s, title_size=7.4, sub_size=6.0)

    # data
    c.band(M, 70.5, W, 19.5, "DATA AND EXECUTION LAYER")
    c.box(M + 2, 76.0, 29.0, 12.0, "PostgreSQL / SQLite", "SQLAlchemy 2 async models\nscans · findings · evidence · patches",
          title_size=7.4, sub_size=6.0)
    c.box(M + 33.5, 76.0, 29.0, 12.0, "Repository storage", "isolated copy per repository\narchives · sandboxes deleted after use",
          title_size=7.4, sub_size=6.0)
    c.box(M + 65.0, 76.0, 29.0, 12.0, "Docker sandbox runner", "cpu/memory/time limits, no host secrets\npytest · ruff · re-analysis",
          fill=WARN_LIGHT, edge=WARN, title_size=7.4, sub_size=6.0)

    # vertical connectors between layers
    for x in (25.0, 50.0, 75.0):
        c.arrow((x, 18.0), (x, 21.0))
        c.arrow((x, 38.0), (x, 41.5))
    c.arrow((25.0, 67.0), (20.0, 76.0))
    c.arrow((75.0, 67.0), (79.0, 76.0))
    c.arrow((88.0, 67.0), (88.0, 76.0), color=WARN, lw=0.8)
    for x, t, col in ((29.0, "findings", MUTED), (79.0, "patch + run", MUTED)):
        c.ax.text(x, c.H - 68.4, t, fontsize=6.2, color=col, ha="left", va="center",
                  bbox=dict(fc="white", ec="none", pad=0.8), zorder=6)

    c.note(M, 91.4, "Source: docs/architecture.md, backend/app/api/routes (route counts), frontend/src/app (repository evidence).", size=6.1, color=GREY)
    c.save("fig01_architecture.png")


# --------------------------------------------------------------------------- 2. pipeline
def fig_pipeline():
    c = Canvas(9.0, 40)
    M = 2.0
    stages = [
        ("1", "Ingestion", "clone or safe unzip"),
        ("2", "Parsing", "symbols · imports · calls"),
        ("3", "Static analysis", "built-in + ruff / bandit"),
        ("4", "Knowledge graph", "callers · callees"),
        ("5", "LLM reasoning", "per-candidate JSON"),
        ("6", "Evidence validation", "VERIFIED / PROBABLE"),
    ]
    w, gap = 26.0, 9.0
    for i, (n, t, sub) in enumerate(stages):
        row, col = divmod(i, 3)
        x = M + col * (w + gap)
        top = 3.0 + row * 14.0
        c.box(x, top, w, 10.0, t, sub, title_size=7.6, sub_size=6.3)
        cy = c.H - (top + 1.9)
        c.ax.add_patch(plt.Circle((x + 2.4, cy), 1.35, color=ACCENT, zorder=4))
        c.ax.text(x + 2.4, cy - 0.05, n, ha="center", va="center", color="white",
                  fontsize=6.2, fontweight="bold", zorder=5)
        if col < 2:
            c.arrow((x + w, top + 5.0), (x + w + gap, top + 5.0), lw=0.9)
        elif row == 0:
            c.ax.plot([x + w / 2, x + w / 2], [c.H - (top + 10.0), c.H - 14.6],
                      color=ACCENT, lw=0.9, zorder=4)
            c.arrow((x + w / 2 - 0.1, 14.6), (M + w / 2 + 1.0, 14.6), lw=0.9)
            c.ax.plot([M + w / 2 + 1.0, M + w / 2 + 1.0], [c.H - 14.6, c.H - 16.4],
                      color=ACCENT, lw=0.9, zorder=4)
            c.ax.annotate("", xy=(M + w / 2 + 1.0, c.H - 17.0), xytext=(M + w / 2 + 1.0, c.H - 16.5),
                          arrowprops=dict(arrowstyle="-|>", color=ACCENT, lw=0.9), zorder=4)

    c.ax.plot([M, 98], [c.H - 31.0] * 2, color=GRID, lw=0.9, ls=(0, (3, 2)), zorder=1)
    c.box(6.0, 32.0, 40.0, 6.4, "AnalysisRun row per stage", "status · tool · output · timing",
          title_size=6.8, sub_size=5.8)
    c.box(54.0, 32.0, 40.0, 6.4, "scan.summary.reproducibility",
          "analyzer · prompt · model · commit · UTC", title_size=6.8, sub_size=5.8)
    c.arrow((46.0, 35.2), (54.0, 35.2), lw=0.8, color=GREY)
    c.note(M, 40.0, "Failure handling: ingestion and parsing failures abort the scan with a readable status; every later stage degrades "
                    "per run and records why.", size=6.1)
    c.save("fig02_pipeline.png")


# --------------------------------------------------------------------------- 3. evidence chain
def fig_evidence_chain():
    c = Canvas(9.0, 50)
    nodes = [
        ("source_input", "route parameter or request field\nrecords file, line and snippet"),
        ("transformation", "f-string, concatenation, %-format\nrecords the assembling expression"),
        ("sink", "cursor.execute · exec · eval\nrecords the dangerous call site"),
        ("static_analysis", "RVX rule id, severity, confidence\nand the matched structural shape"),
        ("call_relationship", "callers of the enclosing function,\nresolved from the knowledge graph"),
        ("llm_reasoning", "structured assessment of the chain;\nnever a verdict on its own"),
    ]
    top = 5.0
    step = 6.8
    for i, (kind, desc) in enumerate(nodes):
        t = top + i * step
        c.box(3.0, t, 30.0, 5.0, kind, None, title_size=7.0)
        c.ax.text(35.5, c.H - (t + 2.5), desc, ha="left", va="center", fontsize=6.2,
                  color=MUTED, linespacing=1.45)
        if i < len(nodes) - 1:
            c.arrow((18.0, t + 5.2), (18.0, t + step), lw=0.9)
    c.note(3.0, 45.6, "order_index ascends down the chain; each node stores file, line, snippet and structured metadata.",
           size=6.2, style="italic")

    px, pw, ptop = 57.0, 40.0, 5.0
    ph = 5 * step + 3.0
    c.ax.add_patch(FancyBboxPatch((px, c.H - (ptop + ph)), pw, ph,
                                  boxstyle="round,pad=0,rounding_size=1.1", lw=1.0, ec=ACCENT, fc="#f7faf8", zorder=1))
    c.ax.text(px + pw / 2, c.H - (ptop + 2.4), "Adjudication rules (checked in code)", ha="center", va="center",
              fontsize=7.4, fontweight="bold", color=ACCENT, zorder=3)
    rules = [
        ("VERIFIED", "The sink is located and the chain source → transformation → sink is established in the repository itself."),
        ("PROBABLE", "A sink and part of a chain exist, but the path cannot be fully established from the evidence available."),
        ("REJECTED", "Grounding is insufficient. Counted and reported, never presented as a confirmed vulnerability."),
    ]
    yy = ptop + 7.0
    for tag, text in rules:
        c.ax.text(px + 1.8, c.H - yy, tag, fontsize=6.8, fontweight="bold",
                  color=ACCENT if tag != "REJECTED" else WARN, zorder=3)
        c.ax.text(px + 1.8, c.H - (yy + 2.4), wrap(text, 55), fontsize=6.0, color=MUTED, va="top",
                  linespacing=1.45, zorder=3)
        yy += 9.4
    c.note(px + 1.8, ptop + ph - 4.4, "The model may add reasoning and move confidence, but the\nminimum required evidence is asserted by code.",
           size=6.0, style="italic")
    c.save("fig03_evidence_chain.png")


# --------------------------------------------------------------------------- 4. configurations
def fig_configurations():
    c = Canvas(9.0, 42)
    stages = ["Parsing", "Static analysis", "Knowledge graph", "LLM reasoning", "Evidence validation"]
    configs = [
        ("static only", [1, 1, 1, 0, 1]),
        ("model only", [1, 0, 0, 1, 1]),
        ("static + model", [1, 1, 1, 1, 1]),
        ("RepoVeriX full", [1, 1, 1, 1, 1]),
    ]
    left, colw = 27.0, 16.0
    for i, (name, _) in enumerate(configs):
        x = left + colw * i + colw / 2
        c.ax.text(x, c.H - 4.5, name, ha="center", va="center", fontsize=6.8,
                  fontweight="bold", color=ACCENT, rotation=0, linespacing=1.2)
    for r, stage in enumerate(stages):
        top = 8.0 + r * 6.2
        c.ax.add_patch(Rectangle((2, c.H - top - 5.4), 96, 5.4,
                                 facecolor="#f6f8f7" if r % 2 == 0 else "white", edgecolor="none", zorder=1))
        c.ax.text(3.5, c.H - (top + 2.7), stage, fontsize=7.0, color=INK, va="center")
        for i, (name, flags) in enumerate(configs):
            cx = left + colw * i + colw / 2
            cy = c.H - (top + 2.7)
            if flags[r]:
                c.ax.add_patch(plt.Circle((cx, cy), 1.45, color=ACCENT, zorder=3))
                c.ax.plot([cx - 0.6, cx - 0.12, cx + 0.7], [cy, cy - 0.5, cy + 0.7],
                          color="white", lw=1.0, zorder=4, solid_capstyle="round")
            else:
                c.ax.add_patch(plt.Circle((cx, cy), 1.45, facecolor="white", edgecolor=GRID, lw=0.9, zorder=3))
    c.note(2.0, 40.0, "The four configurations let the same repository be audited four ways and compared on RepoVeriX-Bench.",
           size=6.1)
    c.save("fig04_configurations.png")


# --------------------------------------------------------------------------- 5. verification
def fig_verification():
    c = Canvas(9.0, 56)
    c.box(2.0, 4.0, 25.0, 9.0, "Original working copy", "never modified by a repair", title_size=7.2, sub_size=5.9)
    c.box(35.0, 4.0, 29.0, 9.0, "Isolated sandbox copy", "<storage>/<repo>/sandbox/<id>", title_size=7.2, sub_size=5.9)
    c.box(72.0, 4.0, 26.0, 9.0, "Candidate patch", "unified diff, targets checked", title_size=7.2, sub_size=5.9)
    c.arrow((27.0, 8.5), (35.0, 8.5))
    c.arrow((72.0, 8.5), (64.0, 8.5))
    for x, t in ((31.0, "copy"), (68.0, "apply")):
        c.ax.text(x, c.H - 6.9, t, fontsize=6.0, color=MUTED, ha="center", va="bottom", zorder=6)

    steps = [
        ("Apply the patch", "every hunk validated; a mismatch raises a structured patch error"),
        ("Compare against the static baseline", "ruff on changed files; only newly introduced issues fail"),
        ("Run the project test suite", "Docker runner with cpu, memory and wall-clock limits"),
        ("Re-analyse the original finding", "built-in detectors run again on the patched file"),
        ("Persist the verdict and clean up", "verification run, parsed per-test results, sandbox deleted"),
    ]
    for i, (t, s) in enumerate(steps):
        top = 17.0 + i * 7.4
        cy = c.H - (top + 2.2)
        c.ax.add_patch(plt.Circle((5.4, cy), 1.75, color=ACCENT, zorder=4))
        c.ax.text(5.4, cy - 0.05, str(i + 1), color="white", fontsize=6.4, fontweight="bold",
                  ha="center", va="center", zorder=5)
        c.ax.text(9.5, cy + 0.9, t, fontsize=7.4, fontweight="bold", color=INK, va="center")
        c.ax.text(9.5, cy - 1.5, s, fontsize=6.3, color=MUTED, va="center")
        if i < len(steps) - 1:
            c.ax.plot([5.4, 5.4], [cy - 1.9, cy - 5.5], color=GRID, lw=1.0, zorder=1)

    px, pw, ptop = 56.0, 41.0, 17.0
    ph = 5 * 7.4 - 1.4
    c.ax.add_patch(FancyBboxPatch((px, c.H - (ptop + ph)), pw, ph,
                                  boxstyle="round,pad=0,rounding_size=1.1", lw=1.0, ec=ACCENT, fc="#f7faf8", zorder=1))
    c.ax.text(px + pw / 2, c.H - (ptop + 1.2), "Outcome vocabulary", ha="center", va="top",
              fontsize=7.4, fontweight="bold", color=ACCENT)
    for i, (tag, txt) in enumerate([
        ("verified_repair", "applied, tests pass, defect gone"),
        ("repair_failed", "apply or test failure, or defect persists"),
        ("repair_not_verified", "runner unavailable, timeout, internal error"),
    ]):
        y = c.H - (ptop + 4.6 + i * 7.2)
        c.ax.text(px + 1.6, y, tag, fontsize=6.6, fontweight="bold", color=INK)
        c.ax.text(px + 1.6, y - 2.6, txt, fontsize=6.1, color=MUTED)
    c.ax.text(px + 1.6, c.H - (ptop + ph - 2.0),
              "Tests passing alone never declare success:\nthe original rule must also stop firing.",
              fontsize=6.2, color=MUTED, va="bottom", style="italic", linespacing=1.45)
    c.save("fig05_verification.png")


# --------------------------------------------------------------------------- 6. ER diagram
def fig_er():
    c = Canvas(9.0, 92)
    GAP = 2.0

    def height(n):
        return 3.4 + n * 3.15 + 1.4

    boxes = {}

    def stack(col, w, x, specs, top0=2.0):
        top = top0
        for name, fields in specs:
            h = height(len(fields))
            y = c.H - top - h
            c.ax.add_patch(Rectangle((x, y), w, h, facecolor="white", edgecolor=ACCENT, lw=0.9, zorder=3))
            c.ax.add_patch(Rectangle((x, y + h - 3.4), w, 3.4, facecolor=ACCENT, edgecolor=ACCENT, lw=0.9, zorder=4))
            c.ax.text(x + w / 2, y + h - 1.5, name, ha="center", va="center", fontsize=6.6,
                      color="white", fontweight="bold", zorder=5)
            for i, f in enumerate(fields):
                c.ax.text(x + 1.1, y + h - 4.6 - i * 2.62, f, fontsize=5.6, color=MUTED, va="center", zorder=5)
            boxes[name] = dict(x=x, w=w, top=top, bottom=top + h, mid=top + h / 2)
            top += h + GAP

    A, AW = 5.0, 22.0
    B, BW = 36.0, 26.0
    C, CW = 71.0, 23.0

    stack("A", AW, A, [
        ("users", ["id (uuid)", "email — unique", "hashed_password", "plan, status"]),
        ("repositories", ["id (uuid)", "owner_id → users", "source_type", "source_url", "primary_languages"]),
        ("scans", ["id (uuid)", "repository_id", "configuration", "status", "summary (json)"]),
    ])
    stack("B", BW, B, [
        ("analysis_runs", ["id (uuid)", "scan_id", "stage, tool_name", "status, output", "timing"]),
        ("files", ["id (uuid)", "scan_id", "path, language", "sha256, is_test"]),
        ("symbols", ["id (uuid)", "file_id", "kind, name", "qualified_name", "line range"]),
        ("findings", ["id (uuid)", "scan_id", "external_id", "severity, status", "confidence, source"]),
    ])
    stack("C", CW, C, [
        ("evidence", ["id (uuid)", "finding_id", "kind", "file, line, snippet", "order_index"]),
        ("patches", ["id (uuid)", "finding_id", "diff (unified)", "generated_by", "status"]),
        ("verification_runs", ["id (uuid)", "patch_id", "status", "tests_passed", "logs"]),
        ("test_results", ["id (uuid)", "verification_run_id", "test_name", "outcome"]),
    ])

    def R(name, frac=0.5):
        b = boxes[name]
        return (b["x"] + b["w"], c.H - (b["top"] + (b["bottom"] - b["top"]) * frac))

    def L(name, frac=0.5):
        b = boxes[name]
        return (b["x"], c.H - (b["top"] + (b["bottom"] - b["top"]) * frac))

    def down(name, other, frac=0.5):
        b, o = boxes[name], boxes[other]
        x = b["x"] + b["w"] / 2
        return ((x, c.H - b["bottom"]), (x, c.H - o["top"]))

    def link(p1, p2, label="1 : n", lx=0.0, ly=0.0, frac=0.5):
        c.ax.annotate("", xy=p2, xytext=p1,
                      arrowprops=dict(arrowstyle="-|>", color=ACCENT, lw=0.85, shrinkA=1.0, shrinkB=2.2),
                      zorder=2)
        mx = p1[0] + (p2[0] - p1[0]) * frac + lx
        my = p1[1] + (p2[1] - p1[1]) * frac + ly
        c.ax.text(mx, my, label, fontsize=5.4, color=MUTED, ha="center", va="center", zorder=6,
                  bbox=dict(fc="white", ec="none", pad=0.5))

    link(*down("users", "repositories"), ly=0.0)
    link(*down("repositories", "scans"))
    link(R("scans", 0.35), L("analysis_runs", 0.5), ly=1.4)
    link(R("scans", 0.62), L("files", 0.5), ly=1.4)
    link(R("scans", 0.85), L("findings", 0.55), ly=1.6)
    link(*down("files", "symbols"))
    link(R("files", 0.5), L("evidence", 0.5), "1 : n", ly=1.4)
    link(R("findings", 0.5), L("patches", 0.5), "1 : n", ly=1.4)
    link(*down("patches", "verification_runs"))
    link(*down("verification_runs", "test_results"))

    c.note(2.0, 88.5, "Source: docs/database.md and backend/app/db/models.py (30 mapped classes; the core audit chain is shown).",
           size=6.0, color=GREY)
    c.save("fig06_data_model.png")


# --------------------------------------------------------------------------- 7. security
def fig_security():
    c = Canvas(9.0, 54)
    c.ax.add_patch(FancyBboxPatch((2.0, c.H - (2.0 + 46.0)), 43.0, 46.0,
                                  boxstyle="round,pad=0,rounding_size=1.2", lw=1.0, ec=WARN,
                                  fc=WARN_LIGHT, ls=(0, (4, 3))))
    c.ax.text(23.5, c.H - 4.0, "UNTRUSTED DOMAIN", ha="center", va="top", fontsize=7.4,
              fontweight="bold", color=WARN)
    for i, (t, s) in enumerate([
        ("Uploaded archive", "path-traversal members, archive bombs"),
        ("Cloned repository", "arbitrary source text and scripts"),
        ("Repository text in prompts", "injection attempts, embedded keys"),
        ("Candidate patch", "targets outside the sandbox"),
    ]):
        c.box(4.0, 7.0 + i * 10.0, 39.0, 8.2, t, s, fill="#ffffff", edge=WARN,
              title_size=7.0, sub_size=5.9)

    c.ax.add_patch(FancyBboxPatch((51.0, c.H - (2.0 + 46.0)), 47.0, 46.0,
                                  boxstyle="round,pad=0,rounding_size=1.2", lw=1.0, ec=ACCENT, fc="#f7faf8"))
    c.ax.text(74.5, c.H - 4.0, "ENFORCED CONTROLS", ha="center", va="top", fontsize=7.4,
              fontweight="bold", color=ACCENT)
    for i, (t, s) in enumerate([
        ("Archive validation", "magic bytes, size caps, member rejection"),
        ("Read-only host analysis", "source parsed, never executed on the host"),
        ("Isolated execution", "Docker limits, no secrets, no host mounts"),
        ("Prompt hardening", "delimited data sections, secret redaction"),
        ("Object authorisation", "ownership check on every resource route"),
    ]):
        c.box(53.0, 7.0 + i * 8.0, 43.0, 6.4, t, s, fill="#ffffff", title_size=6.9, sub_size=5.8)
    c.arrow((45.0, 25.0), (51.0, 25.0), lw=1.1)
    c.note(2.0, 49.4, "Every crossing of the boundary is guarded: nothing from the untrusted domain is executed, trusted or interpolated into a system instruction.", size=6.3)
    c.save("fig07_security.png")


# --------------------------------------------------------------------------- 8. sandbox
def fig_sandbox():
    c = Canvas(9.0, 44)
    c.ax.add_patch(FancyBboxPatch((2.0, c.H - (2.0 + 42.0)), 96.0, 42.0,
                                  boxstyle="round,pad=0,rounding_size=1.1", lw=0.9, ec=GRID, fc="#fbfcfc"))
    c.ax.text(4.0, c.H - 4.0, "HOST  —  RepoVeriX API process (no repository code executes here)",
              fontsize=7.4, fontweight="bold", color=INK, va="top")
    c.box(5.0, 8.0, 26.0, 15.5, "Background scheduler", "in-process task, cancellable\nruntime.py seam",
          title_size=7.2, sub_size=6.0)
    c.box(35.0, 8.0, 26.0, 15.5, "Repository storage", "sandbox copy is the only\nvolume mounted",
          title_size=7.2, sub_size=6.0)
    c.box(65.0, 8.0, 28.0, 15.5, "Docker daemon", "required for verification;\nabsent → honest error",
          fill=WARN_LIGHT, edge=WARN, title_size=7.2, sub_size=6.0)
    c.ax.add_patch(FancyBboxPatch((14.0, c.H - (27.0 + 10.0)), 72.0, 10.0,
                                  boxstyle="round,pad=0,rounding_size=0.9", lw=1.2, ec=WARN, fc=WARN_LIGHT))
    c.ax.text(50.0, c.H - 29.2, "EPHEMERAL CONTAINER", ha="center", va="center",
              fontsize=7.0, fontweight="bold", color=WARN)
    c.ax.text(50.0, c.H - 33.6, "cpu limit · memory limit · wall-clock timeout · bridge or no network · minimal env · pids cap",
              ha="center", va="center", fontsize=6.2, color=WARN)
    c.arrow((18.0, 23.5), (30.0, 27.0))
    c.arrow((48.0, 23.5), (48.0, 27.0))
    c.arrow((79.0, 23.5), (68.0, 27.0), color=WARN)
    c.ax.text(25.0, c.H - 25.0, "start", fontsize=6.1, color=MUTED, ha="center", va="center",
              bbox=dict(fc="white", ec="none", pad=0.5))
    c.ax.text(50.6, c.H - 25.0, "mount", fontsize=6.1, color=MUTED, ha="left", va="center",
              bbox=dict(fc="white", ec="none", pad=0.5))
    c.ax.text(76.0, c.H - 25.0, "create / destroy", fontsize=6.1, color=WARN, ha="center", va="center",
              bbox=dict(fc="white", ec="none", pad=0.5))
    c.note(2.0, 39.6, "The container is removed after the run; the patched copy never becomes the repository the user keeps.", size=6.2, color=GREY)
    c.save("fig08_sandbox.png")


# --------------------------------------------------------------------------- 9. benchmark
def fig_benchmark():
    c = Canvas(9.0, 34)
    steps = [
        ("Experiment config", "repositories × configurations\nline tolerance"),
        ("Isolated run", "real orchestrator, throwaway\ndatabase, separate storage"),
        ("Ground truth", "seeded defects: file,\nfunction, line, rule"),
        ("Matching", "greedy one-to-one on rule\nand function or line window"),
        ("Metrics", "precision · recall · F1 · FPR\nundefined values render TBD"),
        ("Artifacts", "per-experiment JSON\nand comparison summary"),
    ]
    w = 14.0
    gap = (96.0 - 6 * w) / 5
    for i, (t, s) in enumerate(steps):
        x = 2.0 + i * (w + gap)
        c.box(x, 6.0, w, 14.0, t, s, title_size=7.0, sub_size=5.8)
        if i < len(steps) - 1:
            c.arrow((x + w, 13.0), (x + w + gap, 13.0), lw=0.9)
    c.note(2.0, 23.5,
           "Seeded benchmark repositories (backend/tests/fixtures/repos): vulnerable_app — six defects across five rule\n"
           "families in Python; vulnerable_js — four defects in JavaScript. All credentials are fake and neither repository\n"
           "may ever be deployed.", size=6.5)
    c.note(2.0, 31.6, "Empty cells are not estimated: they remain TBD until a real experiment run produces them.", size=6.4, color=ACCENT)
    c.save("fig09_benchmark.png")


# --------------------------------------------------------------------------- 10. API surface
def fig_api_surface():
    counts = {
        "auth / account security": 15,
        "audit, intel, research": 17,
        "findings": 11,
        "organizations": 10,
        "scans": 8,
        "repositories": 7,
        "websites": 6,
        "patches / verification": 6,
        "oauth": 6,
        "intelligence": 5,
        "billing": 5,
        "feedback, sharing, tokens": 10,
        "automation, webhooks, PR": 8,
        "dashboard, onboarding": 3,
    }
    names = list(counts)[::-1]
    vals = [counts[n] for n in names]
    fig, ax = plt.subplots(figsize=(8.0, 4.3))
    ax.barh(names, vals, color=ACCENT, height=0.62)
    for i, v in enumerate(vals):
        ax.text(v + 0.25, i, str(v), va="center", fontsize=6.9, color=INK)
    ax.set_xlabel("HTTP route declarations per router group", fontsize=7.2, color=MUTED)
    ax.tick_params(labelsize=6.8, colors=INK, length=0)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.grid(axis="x", color="#eef1f0", lw=0.8)
    ax.set_axisbelow(True)
    ax.set_xlim(0, max(vals) + 2.5)
    ax.set_title("112 route declarations across 22 routers", fontsize=7.4, color=MUTED, loc="left")
    fig.savefig(OUT / "fig10_api_surface.png", facecolor="white")
    plt.close(fig)
    print("wrote fig10_api_surface.png")


# --------------------------------------------------------------------------- 11. module sizes
def fig_module_size():
    files = sorted((ROOT / "backend/app/analysis").glob("*.py"))
    sizes = []
    for f in files:
        n = sum(1 for _ in f.open("r", encoding="utf-8", errors="ignore"))
        sizes.append((f.stem, n))
    sizes.sort(key=lambda t: -t[1])
    top = sizes[:15][::-1]
    fig, ax = plt.subplots(figsize=(8.0, 4.6))
    ax.barh([t[0] for t in top], [t[1] for t in top], color=ACCENT, height=0.64)
    for i, (_, v) in enumerate(top):
        ax.text(v + 6, i, str(v), va="center", fontsize=6.6, color=INK)
    ax.set_xlabel("physical lines per analysis module", fontsize=7.2, color=MUTED)
    ax.tick_params(labelsize=6.7, colors=INK, length=0)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.grid(axis="x", color="#eef1f0", lw=0.8)
    ax.set_axisbelow(True)
    total = sum(n for _, n in sizes)
    ax.set_title(f"{len(sizes)} analysis modules, {total:,} lines in total", fontsize=7.4, color=MUTED, loc="left")
    fig.savefig(OUT / "fig11_module_size.png", facecolor="white")
    plt.close(fig)
    print("wrote fig11_module_size.png")


# --------------------------------------------------------------------------- 12. UI map
def fig_ui_map():
    c = Canvas(9.0, 50)
    groups = [
        ("Public", ["/", "/product", "/solutions", "/pricing", "/integrations", "/resources"]),
        ("Docs", ["/docs", "/docs/getting-started", "/docs/concepts", "/docs/api", "/docs/faq"]),
        ("Authentication", ["/auth/sign-in", "/auth/sign-up", "/auth/verify-email",
                            "/auth/forgot-password", "/auth/reset-password"]),
        ("Workspace", ["/dashboard", "/repositories", "/repositories/new", "/repositories/[id]",
                       "/scans", "/scans/new"]),
        ("Findings", ["/findings", "/findings/[id]", "/rules", "/rules/[slug]", "/websites"]),
        ("Settings", ["/settings", "/settings/security", "/settings/team", "/billing", "/help"]),
    ]
    top = 3.0
    for title, routes in groups:
        c.box(2.0, top, 20.0, 6.2, title, None, fill=ACCENT, edge=ACCENT,
              color="white", title_size=6.8)
        x = 24.0
        for r in routes:
            w = max(7.0, min(len(r) * 1.24, 14.6))
            if x + w > 98.0:
                break
            c.box(x, top + 0.3, w, 5.6, r, None, title_size=5.7, bold=False)
            x += w + 1.3
        top += 7.4
    c.note(2.0, top + 0.6, "Source: frontend/src/app route groups — (marketing), (auth) and (app). The full tree holds 40 page routes;", size=5.9, color=GREY)
    c.note(2.0, top + 3.8, "the workspace, scanning, finding, rule and settings routes are listed above.", size=5.9, color=GREY)
    c.save("fig12_ui_map.png")


# --------------------------------------------------------------------------- 13. deployment
def fig_deployment():
    c = Canvas(9.0, 62)
    c.box(2.0, 3.0, 29.0, 11.0, "Browser", "Next.js bundle;\nAPI URL baked at build time", title_size=7.0, sub_size=5.8)
    c.box(36.0, 3.0, 26.0, 11.0, "Frontend hosting", "Vercel, git-linked to main,\nor the bundled image", title_size=7.0, sub_size=5.8)
    c.box(67.0, 3.0, 31.0, 11.0, "Edge / TLS", "Caddy reverse proxy in the\nVPS compose file", title_size=7.0, sub_size=5.8)
    c.arrow((31.0, 8.5), (36.0, 8.5))
    c.arrow((62.0, 8.5), (67.0, 8.5))
    c.ax.text(33.5, c.H - 7.0, "HTTPS", fontsize=5.9, color=MUTED, ha="center", va="bottom")

    c.box(2.0, 18.0, 36.0, 14.0, "API container (FastAPI)",
          "multi-arch image, amd64 and arm64\nAlembic migrations on start\n/health liveness probe",
          fill=ACCENT_LIGHT, title_size=7.0, sub_size=5.8)
    c.box(42.0, 18.0, 25.0, 14.0, "Managed PostgreSQL",
          "pooled endpoint, ssl=require\nmigration chain 001 to 009", title_size=7.0, sub_size=5.8)
    c.arrow((42.0, 26.0), (38.0, 26.0), lw=0.9)
    c.ax.text(40.0, c.H - 24.6, "asyncpg", fontsize=5.9, color=MUTED, ha="center",
              bbox=dict(fc="white", ec="none", pad=0.4))
    c.arrow((49.0, 14.2), (28.0, 18.0), rad=-0.1)
    c.ax.text(35.0, c.H - 16.4, "API calls", fontsize=5.9, color=MUTED, ha="center",
              bbox=dict(fc="white", ec="none", pad=0.4))

    c.box(2.0, 36.0, 36.0, 10.0, "Verification runner", "Docker socket mount, dedicated host only",
          fill=WARN_LIGHT, edge=WARN, title_size=7.0, sub_size=5.8)
    c.box(42.0, 36.0, 25.0, 10.0, "Artifact storage", "local volume, or S3-compatible (fail-closed)", title_size=7.0, sub_size=5.8)
    c.box(71.0, 36.0, 27.0, 10.0, "LLM providers", "OpenAI · Anthropic · Gemini · gateways", title_size=7.0, sub_size=5.8)
    c.arrow((20.0, 32.2), (20.0, 36.0), lw=0.9, color=WARN)
    c.arrow((54.0, 32.2), (54.0, 36.0), lw=0.9)
    c.arrow((84.0, 32.2), (84.0, 36.0), lw=0.9)

    c.box(2.0, 50.0, 36.0, 8.0, "CI and publishing", "GitHub Actions, ruff, pytest, pip-audit, images", title_size=6.9, sub_size=5.7)
    c.box(42.0, 50.0, 25.0, 8.0, "Deployment manifests", "compose, render.yaml, railway.json", title_size=6.9, sub_size=5.7)
    c.box(71.0, 50.0, 27.0, 8.0, "Operator checklist", "docs/MANUAL-SETUP.md, docs/DEPLOY.md", title_size=6.9, sub_size=5.7)
    c.arrow((20.0, 46.2), (20.0, 50.0), lw=0.8, ls=(0, (2, 2)))
    c.note(2.0, 61.0, "Source: docs/DEPLOY.md, docker-compose.vps.yml, render.yaml, railway.json, .github/workflows.", size=5.9, color=GREY)
    c.save("fig13_deployment.png")


# --------------------------------------------------------------------------- 14. test inventory
def fig_test_inventory():
    areas = {
        "production lifecycle & ops": 28,
        "tier workflows": 50,
        "websites & crawl safety": 25,
        "security & hardening": 60,
        "billing & entitlements": 38,
        "auth, OAuth & accounts": 55,
        "teams, sharing & feedback": 35,
        "scans, findings & reports": 31,
        "patches, verify & proof-of-fix": 22,
        "ingest, parsing & detectors": 17,
        "benchmark & metrics": 10,
        "intelligence & PR audit": 31,
    }
    names = list(areas)[::-1]
    vals = [areas[n] for n in names]
    fig, ax = plt.subplots(figsize=(8.0, 4.3))
    ax.barh(names, vals, color=ACCENT, height=0.6)
    for i, v in enumerate(vals):
        ax.text(v + 0.7, i, str(v), va="center", fontsize=6.7, color=INK)
    ax.set_xlabel("test functions declared under backend/tests", fontsize=7.2, color=MUTED)
    ax.tick_params(labelsize=6.7, colors=INK, length=0)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.grid(axis="x", color="#eef1f0", lw=0.8)
    ax.set_axisbelow(True)
    ax.set_xlim(0, max(vals) + 8)
    ax.set_title("544 test functions in 51 test modules (declared, not executed for this report)", fontsize=7.2, color=MUTED, loc="left")
    fig.savefig(OUT / "fig14_test_inventory.png", facecolor="white")
    plt.close(fig)
    print("wrote fig14_test_inventory.png")


# --------------------------------------------------------------------------- 15. repair decision
def fig_repair_decision():
    c = Canvas(9.0, 44)
    c.box(2.0, 3.0, 20.0, 9.0, "Finding", "VERIFIED or PROBABLE", title_size=7.2, sub_size=5.9)
    c.box(26.0, 3.0, 21.0, 9.0, "Template applies?", "shape must match exactly", title_size=7.2, sub_size=5.9)
    c.box(51.0, 3.0, 20.0, 9.0, "Deterministic diff", "no model call, no cost", fill=ACCENT_LIGHT, title_size=7.2, sub_size=5.9)
    c.box(75.0, 3.0, 23.0, 9.0, "LLM repair", "must parse and apply cleanly", title_size=7.2, sub_size=5.9)
    c.box(37.0, 17.0, 26.0, 8.0, "Candidate patch stored", "unified diff, explanation, provenance", title_size=7.2, sub_size=5.9)
    c.box(37.0, 29.0, 26.0, 9.0, "Sandbox verification", "apply · static · tests · re-analysis",
          fill=ACCENT, edge=ACCENT, color="white", title_size=7.2, sub_size=5.6, subcolor="#cfe3d9")
    c.arrow((22.0, 7.5), (26.0, 7.5))
    c.arrow((47.0, 7.5), (51.0, 7.5), "yes", label_dy=0.6)
    c.arrow((47.0, 12.4), (84.5, 12.4), rad=0.18)
    c.ax.text(66.0, c.H - 15.6, "no", fontsize=6.1, color=MUTED, ha="center", va="top")
    c.arrow((60.0, 12.2), (56.0, 17.0), rad=-0.1)
    c.arrow((84.0, 12.2), (60.0, 17.0), rad=0.1)
    c.arrow((50.0, 25.2), (50.0, 29.0), lw=1.1)
    c.note(2.0, 40.0, "A template that no longer matches the source refuses to guess rather than emitting a speculative diff.", size=6.5)
    c.save("fig15_repair_decision.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fig_architecture()
    fig_pipeline()
    fig_evidence_chain()
    fig_configurations()
    fig_verification()
    fig_er()
    fig_security()
    fig_sandbox()
    fig_benchmark()
    fig_api_surface()
    fig_module_size()
    fig_ui_map()
    fig_deployment()
    fig_test_inventory()
    fig_repair_decision()


if __name__ == "__main__":
    main()
