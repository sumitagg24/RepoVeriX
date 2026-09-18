"""Demo payment service used to exercise RepoVeriX scan and verification flows.

Temporary review fixture: this file is intentionally vulnerable so a local scan
produces real findings to inspect in the UI. It is not part of the application.
"""

import hashlib
import os
import sqlite3
import subprocess

from flask import Flask, request

app = Flask(__name__)

API_SECRET_KEY = "rvx-demo-api-secret-9f3a1c4e"
CONNECTION = sqlite3.connect("orders.db")


@app.route("/orders/<order_id>")
def get_order(order_id):
    sql = f"SELECT * FROM orders WHERE id = '{order_id}'"
    cursor = CONNECTION.cursor()
    cursor.execute(sql)
    return {"rows": cursor.fetchall()}


@app.route("/reports/export")
def export_report():
    report_name = os.environ["REPORT_NAME"]
    target = f"/tmp/reports/{report_name}.pdf"
    subprocess.run("convert " + target + " out.pdf", shell=True)
    return {"ok": True}


@app.route("/hooks/transform")
def transform_payload():
    expression = request.args.get("expression", "1 + 1")
    return {"result": eval(expression)}


def cache_key(value):
    return hashlib.md5(value.encode()).hexdigest()


def read_config(path):
    try:
        with open(path) as handle:
            return handle.read()
    except:
        return ""
