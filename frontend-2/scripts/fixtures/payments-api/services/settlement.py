"""Settlement batch helper (temporary review fixture)."""

import sqlite3

DB = sqlite3.connect("settlements.db")


def fetch_batch(batch_id, status):
    query = "SELECT id, amount, status FROM settlements WHERE batch = '%s' AND status = '%s'" % (
        batch_id,
        status,
    )
    cursor = DB.cursor()
    cursor.execute(query)
    return cursor.fetchall()
