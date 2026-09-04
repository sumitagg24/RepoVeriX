"""RepoVeriX analysis engine.

Owns everything between "repository bytes on disk" and "persisted findings":
ingestion helpers, parsing, static analysis, the repository knowledge layer,
LLM reasoning, evidence construction/validation and the scan orchestrator.
"""
