/**
 * Vulnerability-class content for the /vulnerabilities hub.
 *
 * Every entry describes a class the RepoVeriX engine genuinely detects
 * (backend/app/analysis/detectors.py) and every code sample is taken from the
 * real test fixtures (backend/tests/fixtures/repos/) — vulnerable code and the
 * fixed variant the verification pipeline actually runs against. No invented
 * examples, no invented rules.
 */

export interface CodeSample {
  caption: string;
  language: string;
  code: string;
  /** File the sample comes from, relative to the fixture repository. */
  source: string;
}

export interface VulnFaq {
  q: string;
  a: string;
}

export interface VulnerabilityClass {
  slug: string;
  name: string;
  title: string;
  description: string;
  cwe: string;
  cweName: string;
  owasp: string;
  severity: string;
  /** Rule IDs that detect this class. */
  rules: string[];
  languages: string[];
  /** How the deterministic detector works (no LLM involved). */
  detection: string[];
  /** Evidence chain the engine records for a finding. */
  evidenceKinds: string[];
  /** Counterexample conditions that refute a candidate finding. */
  counterexamples: string[];
  fixSteps: string[];
  vulnerableSample: CodeSample;
  fixedSample: CodeSample;
  faqs: VulnFaq[];
}

export const VULNERABILITY_CLASSES: VulnerabilityClass[] = [
  {
    slug: 'sql-injection',
    name: 'SQL injection',
    title: 'SQL injection: how it happens and how a scanner can prove it',
    description:
      'How string-built SQL queries become injectable, what evidence proves a real SQL injection path, and how RepoVeriX detects, validates and helps fix them in Python and JavaScript code.',
    cwe: 'CWE-89',
    cweName: 'Improper Neutralization of Special Elements used in an SQL Command',
    owasp: 'A03:2021 — Injection',
    severity: 'critical (when input reaches the query from an HTTP route) / high',
    rules: ['RVX-SQLI-001', 'RVX-SQLI-JS-001'],
    languages: ['Python', 'JavaScript / TypeScript'],
    detection: [
      'The parser resolves every SQL execution sink — cursor.execute(...) in Python, client.query(...) for database clients in JavaScript.',
      'Backwards from the sink, the detector looks for the query string being built with an f-string, %-formatting, concatenation, or a template literal.',
      'If the interpolated value originates from a function parameter of an HTTP route handler, severity is raised to critical; otherwise it stays high with reduced confidence.',
      'The emitted finding carries a two-node evidence chain: the line where the query string was assembled (transformation) and the line where it executed (sink).',
    ],
    evidenceKinds: ['transformation (query built)', 'sink (query executed)'],
    counterexamples: [
      'The sink uses a parameterized/bound form — cursor.execute(sql, (param,)) — so the interpolated value never becomes SQL syntax. RepoVeriX records the sanitizer call and line as a counterexample proof.',
      'The value passes through a typed coercion (int(), uuid handling) before reaching the query construction.',
    ],
    fixSteps: [
      'Replace string-built SQL with a parameterized query: cursor.execute("SELECT * FROM users WHERE name = ?", (name,)) in Python, or parameterized placeholders ($1, $2 …) for pg in JavaScript.',
      'Never assemble table or column names from user input — map allowed identifiers server-side.',
      'Re-scan: the same detector must now report the finding gone, and the counterexample check should record the parameterization as proof.',
    ],
    vulnerableSample: {
      caption: 'The route handler interpolates the name parameter straight into SQL.',
      language: 'python',
      source: 'vulnerable_app/app.py',
      code: `@router.route("/search")
def search_users(name):
    conn, cursor = get_db()
    query = f"SELECT * FROM users WHERE name = '{name}'"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return rows`,
    },
    fixedSample: {
      caption: 'The fixed fixture parameterizes the same query — the value can no longer change the SQL structure.',
      language: 'python',
      source: 'vulnerable_app/fixed_app.py',
      code: `@router.route("/search")
def search_users(name):
    """Search users by name using a parameterized query."""
    conn, cursor = get_db()
    cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
    rows = cursor.fetchall()
    conn.close()
    return rows`,
    },
    faqs: [
      {
        q: 'How does RepoVeriX decide a SQL injection is critical instead of high?',
        a: 'Deterministically: if the interpolated value is traceable to a parameter of a function that is registered as an HTTP route handler, the finding is critical with 0.92 confidence. If the tainted-source trace cannot be established, it stays high at 0.75 confidence and the message says so explicitly.',
      },
      {
        q: 'Can the scanner reject a SQL injection finding on its own?',
        a: 'Yes. The counterexample validator inspects the code between the source and the sink; if the sink argument is produced by a parameterized call or a recognized sanitizer, the candidate finding is refuted and the sanitizer line is recorded as proof-of-absence.',
      },
      {
        q: 'Does the same rule work for JavaScript?',
        a: 'Yes — RVX-SQLI-JS-001 applies the same source→transformation→sink logic to template-literal or concatenated queries executed against database clients such as pg.',
      },
    ],
  },
  {
    slug: 'command-injection',
    name: 'Command injection',
    title: 'Command injection: detection, evidence and verified fixes',
    description:
      'How dynamically built shell commands turn user input into arbitrary code execution, what evidence proves the path, and the concrete fixes (argument lists, shell=False) that verified repair applies.',
    cwe: 'CWE-78',
    cweName: 'Improper Neutralization of Special Elements used in an OS Command',
    owasp: 'A03:2021 — Injection',
    severity: 'high',
    rules: ['RVX-CMDI-001', 'RVX-CMDI-JS-001'],
    languages: ['Python', 'JavaScript / TypeScript'],
    detection: [
      'Python: the detector flags os.system / os.popen calls and subprocess calls where the command is built dynamically (f-string, concatenation, %-formatting) or shell=True is in scope.',
      'JavaScript: child_process exec / execSync calls whose command contains a template-literal interpolation or concatenation within the surrounding lines.',
      'Each finding carries the sink line plus a code snippet, so a reviewer sees the exact executed expression — not a rule name and a guess.',
    ],
    evidenceKinds: ['sink (shell executed with dynamic content)'],
    counterexamples: [
      'The command is a constant string with no interpolation in the sink window — nothing dynamic reaches the shell.',
      'The call is an argument-list form (subprocess.run([...], shell=False)) where input becomes an argv element, not shell syntax.',
    ],
    fixSteps: [
      'Prefer argument lists: subprocess.run(["ping", "-c", "1", hostname], shell=False, timeout=10) — this is exactly what the fixed fixture does.',
      'In JavaScript prefer execFile with an argv array over exec with a shell command string.',
      'If a shell is unavoidable, validate against a strict allowlist before interpolation and keep the sink away from route handlers.',
    ],
    vulnerableSample: {
      caption: 'The hostname from the request lands inside a shell command string.',
      language: 'python',
      source: 'vulnerable_app/app.py',
      code: `@router.route("/admin")
def run_report(hostname):
    """Ping a host supplied by the caller (command injection demo)."""
    command = f"ping -c 1 {hostname}"
    subprocess.call(command, shell=True)
    return "ok"`,
    },
    fixedSample: {
      caption: 'The fixed fixture passes an argv list and disables the shell.',
      language: 'python',
      source: 'vulnerable_app/fixed_app.py',
      code: `@router.route("/admin")
def run_report(hostname):
    """Ping a host using an argument list — no shell interpolation."""
    subprocess.run(["ping", "-c", "1", hostname], shell=False, timeout=10)
    return "ok"`,
    },
    faqs: [
      {
        q: 'Why does RepoVeriX treat argument lists as a fix rather than a mitigation?',
        a: 'Because the detector is structural: with shell=False and an argv list there is no string that the shell can parse, so the injection sink the rule matches no longer exists. The verification pipeline re-runs the detector on the patched code to confirm the finding is gone before any fix is called verified.',
      },
      {
        q: 'What is the difference between the Python and JavaScript rules?',
        a: 'RVX-CMDI-001 matches os.system/os.popen/subprocess patterns with dynamic command construction in Python; RVX-CMDI-JS-001 matches child_process exec/execSync with interpolated commands. Both emit the same evidence model and go through the same counterexample validation.',
      },
    ],
  },
  {
    slug: 'dynamic-code-execution',
    name: 'Dynamic code execution',
    title: 'eval and dynamic code execution: why scanners flag it and what to ship instead',
    description:
      'eval, exec and new Function turn strings into code. How RepoVeriX detects dynamic execution with dynamic input, when the finding is refuted, and the safe replacements.',
    cwe: 'CWE-95',
    cweName: 'Improper Neutralization of Special Elements used in a Command ("Code Injection")',
    owasp: 'A03:2021 — Injection',
    severity: 'medium',
    rules: ['RVX-EVAL-001', 'RVX-EVAL-JS-001'],
    languages: ['Python', 'JavaScript / TypeScript'],
    detection: [
      'Python: eval / exec / compile called with a non-constant argument — the detector allows literal-only calls and flags anything interpolated or concatenated.',
      'JavaScript: eval or new Function invoked with dynamic input.',
      'Severity is medium with 0.7 confidence by design: dynamic execution is dangerous but not automatically attacker-reachable — the attack-path engine decides reachability separately.',
    ],
    evidenceKinds: ['sink (dynamic code executed with non-constant argument)'],
    counterexamples: [
      'The argument is a compile-time constant string — the call cannot execute foreign code.',
      'The expression path is dead (unreachable from any entry point) — the attack-path engine reports it as PROBABLE rather than VERIFIED, never claiming exploitability without a complete path.',
    ],
    fixSteps: [
      'Replace eval with a real parser: ast.literal_eval for data literals in Python, JSON.parse in JavaScript.',
      'If the input must be an expression, parse it to an AST and evaluate an allowlisted subset — never hand the raw string to eval.',
      'The fixed fixture simply refuses: arbitrary expression evaluation is disabled and raises ValueError.',
    ],
    vulnerableSample: {
      caption: 'A request parameter becomes executable code.',
      language: 'python',
      source: 'vulnerable_app/app.py',
      code: `@router.route("/score")
def score(expression):
    """Evaluate a caller-supplied expression (unsafe eval demo)."""
    return eval(expression)`,
    },
    fixedSample: {
      caption: 'The fixed fixture removes the dynamic execution entirely.',
      language: 'python',
      source: 'vulnerable_app/fixed_app.py',
      code: `@router.route("/score")
def score(expression):
    """Refuse to evaluate arbitrary expressions."""
    raise ValueError("expression evaluation is disabled")`,
    },
    faqs: [
      {
        q: 'Is every eval a vulnerability?',
        a: 'No — and RepoVeriX does not claim that. The rule only fires when the argument is non-constant, and the attack-path engine then determines whether untrusted input actually reaches it. Paths that cannot be completed are labelled PROBABLE, never VERIFIED.',
      },
      {
        q: 'What replaces eval for arithmetic or expressions?',
        a: 'Parse the input to an AST and evaluate an explicit allowlist of node types (Python ast.literal_eval for literals, or a small expression parser). The verification pipeline will re-run the detector and confirm the sink is gone before certifying the fix.',
      },
    ],
  },
  {
    slug: 'hardcoded-secrets',
    name: 'Hardcoded secrets',
    title: 'Hardcoded secrets and API keys: detection without false-positive noise',
    description:
      'How entropy analysis and placeholder filtering tell real credentials apart from test dummies, what evidence a secret finding carries, and the correct remediation (rotate, do not just delete).',
    cwe: 'CWE-798',
    cweName: 'Use of Hard-coded Credentials',
    owasp: 'A07:2021 — Identification and Authentication Failures',
    severity: 'high',
    rules: ['RVX-SECRET-001', 'RVX-SECRET-002', 'RVX-SECRET-JS-001'],
    languages: ['Python', 'JavaScript / TypeScript'],
    detection: [
      'Assignments to secret-like names (api_key, password, secret, token …) whose literal has high Shannon entropy — random-looking strings, not "changeme".',
      'Keyword arguments that pass secret-like values (create_app(password="…")).',
      'Placeholder filtering: obvious dummies (example, placeholder, xxx…) are skipped so test fixtures with fake keys do not drown real ones — the demo fixtures themselves rely on this.',
    ],
    evidenceKinds: ['source_input (secret literal with its line and snippet)'],
    counterexamples: [
      'The value is a recognized placeholder or low-entropy string — not treated as a credential.',
      'The name is secret-like but the value is loaded from the environment at runtime (os.environ / process.env), which the detector does not flag.',
    ],
    fixSteps: [
      'Rotate the credential first — removing the line does not un-leak a key that is already in git history.',
      'Load the value from environment or a secret manager at runtime.',
      'Purge the history if the repository is shared (git filter-repo or equivalent) and force-rotate anything the key could reach.',
    ],
    vulnerableSample: {
      caption: 'A high-entropy literal assigned to a secret-like module constant.',
      language: 'python',
      source: 'vulnerable_app/app.py',
      code: `DEMO_API_KEY = "sk-demo-4f2b9c1e7d6a8f3b2c5d9e1a7f4b8c2d6e0a3f1b"`,
    },
    fixedSample: {
      caption: 'The value moves to the environment; the literal disappears from source.',
      language: 'python',
      source: 'vulnerable_app/fixed_app.py',
      code: `DEMO_API_KEY = os.environ["DEMO_API_KEY"]  # loaded at runtime, never in source`,
    },
    faqs: [
      {
        q: 'Why does the demo fixture’s fake key still get flagged?',
        a: 'It has the shape and entropy of a real credential — which is exactly the point of the fixture. Placeholder filtering skips obvious dummies like "xxx" or "changeme", but a realistic fake is meant to be caught. Every credential in the shipped fixtures is fake and labelled as such.',
      },
      {
        q: 'I deleted the secret — why does the finding matter?',
        a: 'Git history still contains it. RepoVeriX’s vulnerability-history mining (blame-based introducing-commit analysis) is built for exactly this: it identifies the commit that added the pattern so you know how far back the exposure reaches. Rotate first, delete second.',
      },
    ],
  },
  {
    slug: 'weak-cryptography',
    name: 'Weak cryptography',
    title: 'MD5 and SHA1 for security purposes: detection and the real fix',
    description:
      'Why MD5/SHA1 fail for passwords and signatures, how the deterministic rule detects them, and the keyed-hash fix the verified pipeline tests against.',
    cwe: 'CWE-327',
    cweName: 'Use of a Broken or Risky Cryptographic Algorithm',
    owasp: 'A02:2021 — Cryptographic Failures',
    severity: 'low',
    rules: ['RVX-CRYPTO-001'],
    languages: ['Python', 'JavaScript / TypeScript'],
    detection: [
      'Python: hashlib.md5 / hashlib.sha1 (or bare md5()/sha1() calls) matched per line with the call snippet attached.',
      'JavaScript: crypto.createHash("md5") / "sha1" patterns.',
      'Severity is low deliberately: the rule cannot know the purpose. A non-security checksum with MD5 is fine; a password hash is not. Context arrives from the LLM layer and the evidence engine, never from the rule alone.',
    ],
    evidenceKinds: ['sink (weak hash invoked)'],
    counterexamples: [
      'The hash is used for a non-security purpose in an unreachable path — the attack-path engine will not upgrade the finding without a complete path from an entry point.',
    ],
    fixSteps: [
      'For passwords use a memory-hard KDF (argon2, scrypt, bcrypt) — never a bare hash, even SHA-256.',
      'For fingerprints/signatures use HMAC-SHA256 with a randomly generated key. The fixed fixture does exactly this: hashlib.sha256(secrets.token_bytes(16) + token).',
      'Re-scan: the rule must report the MD5/SHA1 call gone for the fix to be verified.',
    ],
    vulnerableSample: {
      caption: 'A security-relevant token fingerprint built with MD5.',
      language: 'python',
      source: 'vulnerable_app/app.py',
      code: `def fingerprint(token):
    """Create a fingerprint for a token (weak hash demo)."""
    return hashlib.md5(token.encode("utf-8")).hexdigest()`,
    },
    fixedSample: {
      caption: 'The fixed fixture uses a keyed, collision-resistant construction.',
      language: 'python',
      source: 'vulnerable_app/fixed_app.py',
      code: `def fingerprint(token):
    """Create a fingerprint using a keyed, collision-resistant HMAC."""
    digest = hashlib.sha256(secrets.token_bytes(16) + token.encode("utf-8")).hexdigest()
    return digest`,
    },
    faqs: [
      {
        q: 'Why is the severity only low when MD5 is broken?',
        a: 'The deterministic rule reports what it can prove: a weak-hash call exists. Whether it is security-relevant depends on how the output is used — that judgment comes from the evidence engine and LLM reasoning layer, which can raise the severity, but the rule itself never inflates what it cannot show.',
      },
      {
        q: 'Is SHA-256 enough for passwords?',
        a: 'No. Fast hashes are brute-forceable at GPU speeds. Use argon2, scrypt or bcrypt for password storage; keyed hashes like HMAC-SHA256 are for fingerprints and signatures.',
      },
    ],
  },
  {
    slug: 'broad-exception-handling',
    name: 'Broad exception handling',
    title: 'Bare except and silent failure: the reliability defect scanners miss',
    description:
      'Bare except: pass hides real faults and breaks error handling. How RepoVeriX detects it deterministically and why it feeds the defect-risk lens of the code-health score.',
    cwe: 'CWE-703',
    cweName: 'Improper Check or Handling of Exceptional Conditions',
    owasp: 'A05:2021 — Security Misconfiguration (error handling)',
    severity: 'low',
    rules: ['RVX-EXCEPT-001'],
    languages: ['Python'],
    detection: [
      'A per-line structural match: except: or except Exception: with only pass/… in the body.',
      'The finding is categorized reliability, not security — the rule reports what it proves.',
      'The same detector feeds the defect-risk lens of the per-file health score, so silently-swallowing modules drag the file’s 1–10 health rating down.',
    ],
    evidenceKinds: ['sink (broad handler without meaningful handling, with snippet)'],
    counterexamples: [
      'The handler names a specific exception and takes a real action (log, re-raise, fallback) — not a match.',
    ],
    fixSteps: [
      'Catch the narrowest exception type the code can actually raise.',
      'Handle or propagate — log-and-continue only when continuation is genuinely safe, and say so in a comment.',
      'Re-scan: the detector must report the broad handler gone.',
    ],
    vulnerableSample: {
      caption: 'A discount calculation that swallows every error and returns the price unchanged.',
      language: 'python',
      source: 'vulnerable_app/app.py',
      code: `def apply_discount(price, discount_code):
    valid_codes = {"SAVE10": 0.10, "SAVE20": 0.20}
    if discount_code not in valid_codes:
        return price
    try:
        return price * (1 - valid_codes[discount_code])
    except Exception:
        pass
    return price`,
    },
    fixedSample: {
      caption: 'The fixed fixture removes the silent handler — the lookup either works or the caller sees the error.',
      language: 'python',
      source: 'vulnerable_app/fixed_app.py',
      code: `def apply_discount(price, discount_code):
    valid_codes = {"SAVE10": 0.10, "SAVE20": 0.20}
    if discount_code not in valid_codes:
        return price
    return price * (1 - valid_codes[discount_code])`,
    },
    faqs: [
      {
        q: 'Is bare except a security issue?',
        a: 'Usually not directly — which is why RepoVeriX files it under reliability. But silent failure around security-relevant code (auth checks, validation) can mask attacks, and the LLM reasoning layer can flag that context when the evidence supports it.',
      },
      {
        q: 'How does this affect my code-health score?',
        a: 'Each hit costs the file’s defect-risk lens 1.1 points on the 1–10 scale, alongside eleven other deterministic detectors (complexity, duplication, nesting, test adjacency and more). The score is computed from the AST — never from model opinion.',
      },
    ],
  },
];

export function getVulnerability(slug: string): VulnerabilityClass | undefined {
  return VULNERABILITY_CLASSES.find((v) => v.slug === slug);
}
