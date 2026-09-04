// Demo API server — INTENTIONALLY VULNERABLE (RepoVeriX demo fixture).
// All credentials are fake. Do not deploy.
'use strict';

const express = require('express');

const { Client } = require('pg');
const { exec } = require('child_process');

const app = express();
const client = new Client({ connectionString: process.env.DATABASE_URL });

const STRIPE_SECRET = 'sk-demo-7f3a9c2e4b8d1f6a5c3e9b7d2f4a8c6e0b1d3f5a';

app.get('/search', async (req, res) => {
  const name = req.query.name;
  const query = `SELECT * FROM users WHERE name = '${name}'`;
  const result = await client.query(query);
  res.json(result.rows);
});

app.get('/ping', (req, res) => {
  const host = req.query.host;
  exec(`ping -c 1 ${host}`, (err, stdout) => {
    res.send(stdout || err.message);
  });
});

app.get('/eval', (req, res) => {
  const expr = req.query.expr;
  res.json({ result: eval(expr) });
});

function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(token).digest('hex');
}

module.exports = { app, hashToken, STRIPE_SECRET };
