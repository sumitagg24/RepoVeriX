"""Architecture smells evidence tests: every smell carries metric, threshold,
actual measured value, explanation, and affected files/symbols — all
deterministic, none LLM-derived."""

from app.analysis import archsmells
from app.analysis.parsing import parse_source


def _detect(files: dict[str, str]):
    parsed = {}
    for path, source in files.items():
        parsed[path] = parse_source(source, "python", path)
    return archsmells.detect_smells(parsed)


REQUIRED = {
    "smell",
    "severity",
    "modules",
    "metric",
    "threshold",
    "actual",
    "explanation",
    "affected_files",
    "affected_symbols",
    "detail",
    "remediation",
}


def test_every_smell_has_evidence_fields():
    files = {"lib/core.py": "def serve(): pass\n"}
    for i in range(9):
        files[f"mod{i}.py"] = "import lib.core\n\ndef f():\n    return lib.core.serve()\n"
    result = _detect(files)
    assert result["smells"], "expected hub-module smell from 9 importers"
    for smell in result["smells"]:
        assert REQUIRED <= set(smell), smell.keys()


def test_hub_module_metric_values():
    files = {"lib/core.py": "def serve(): pass\n"}
    for i in range(9):
        files[f"mod{i}.py"] = "import lib.core\n\ndef f():\n    return lib.core.serve()\n"
    result = _detect(files)
    hub = next(s for s in result["smells"] if s["smell"] == "hub_module")
    assert hub["actual"] == 9
    assert hub["threshold"] == 6
    assert "fan-in" in hub["metric"]
    assert hub["affected_files"] == ["lib"]


def test_cycle_metric_values():
    result = _detect(
        {
            "a.py": "import b\n\ndef a():\n    return b.b2()\n",
            "b.py": "import a\n\ndef b2():\n    return a.a()\n",
        }
    )
    cycle = next(s for s in result["smells"] if s["smell"] == "dependency_cycle")
    assert cycle["threshold"] == 2
    assert cycle["actual"] == 2
    assert cycle["affected_symbols"], "expected symbols resolved from the cycle modules"
    assert "cycle" in cycle["explanation"].lower()


def test_no_smells_is_empty():
    result = _detect({"single.py": "def f():\n    return 1\n"})
    assert result["smell_count"] == 0
    assert result["smells"] == []
    assert {"module_count", "edge_count", "smell_count", "by_type", "smells"} <= set(result)
