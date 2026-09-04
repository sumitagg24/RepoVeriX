"""Unit tests for the tree-sitter parser abstraction."""

import pytest

from app.analysis.models import AnalysisError
from app.analysis.parsing import parse_source

PY_SNIPPET = '''\
"""Module docstring."""
import os
import json as js
from datetime import datetime
from . import utils
from ..pkg import helper, other as alt

def foo(x):
    """Doc."""
    return bar(x) + 1

class Greeter:
    greeting = "hello"

    def greet(self, name):
        return utils.say(self.greeting, name)

def top_level():
    return datetime.now()
'''


JS_SNIPPET = """\
import express from "express";
import { Client } from "pg";
import helper from "./lib/helper";

export function ping(host) {
  return helper.pingHost(host);
}

const arrow = (x) => x + 1;

export class UserService {
  constructor(db) {
    this.db = db;
  }

  findByEmail(email) {
    return this.db.query(email);
  }
}
"""


def test_parse_python_symbols():
    pf = parse_source(PY_SNIPPET, "python", "pkg/mod.py")
    kinds = {(s.kind, s.name) for s in pf.symbols}
    assert ("function", "foo") in kinds
    assert ("method", "greet") in kinds
    assert ("function", "top_level") in kinds
    assert ("class", "Greeter") in kinds

    foo = next(s for s in pf.symbols if s.name == "foo")
    assert foo.line_start >= 1
    assert foo.line_end >= foo.line_start

    greet = next(s for s in pf.symbols if s.name == "greet")
    assert greet.qualified_name.startswith("pkg.mod:")


def test_parse_python_imports_and_calls():
    pf = parse_source(PY_SNIPPET, "python", "pkg/mod.py")
    modules = {i.module for i in pf.imports}
    assert "os" in modules
    assert ".utils" in modules
    assert "..pkg" in modules
    assert {"datetime", "js", "alt"} <= {n for i in pf.imports for n in i.imported_names}

    calls = {(c.caller.split(":")[-1], c.callee) for c in pf.calls}
    assert ("foo", "bar") in calls
    assert ("Greeter.greet", "say") in calls


def test_parse_js_symbols_imports():
    pf = parse_source(JS_SNIPPET, "typescript", "src/api.ts")
    names = {s.name for s in pf.symbols if s.kind != "class"}
    assert "ping" in names
    assert "arrow" in names
    assert "findByEmail" in names

    mods = {i.module for i in pf.imports}
    assert "express" in mods
    assert "pg" in mods
    assert "./lib/helper" in mods


def test_unsupported_language_raises():
    with pytest.raises(AnalysisError):
        parse_source("x = 1", "ruby", "x.rb")
