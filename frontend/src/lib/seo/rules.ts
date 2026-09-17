/**
 * Detection-rule registry for the /detections hub — one page per rule ID the
 * engine actually emits (backend/app/analysis/detectors.py). Descriptions,
 * confidence values and severities mirror the detector source exactly.
 */

export interface RuleFaq {
  q: string;
  a: string;
}

export interface DetectionRule {
  id: string;
  slug: string;
  name: string;
  summary: string;
  language: 'python' | 'javascript';
  category: string;
  severity: string;
  confidence: string;
  /** Deterministic matching logic, in the detector's own terms. */
  howItWorks: string[];
  /** What extra["tainted_from_parameter"] / reachability adds. */
  contextSignals: string[];
  falsePositives: string;
  fix: string;
  vulnSlug: string;
  faqs: RuleFaq[];
}

export const DETECTION_RULES: DetectionRule[] = [
  {
    id: 'RVX-SQLI-001',
    slug: 'rvx-sqli-001',
    name: 'SQL injection (Python)',
    summary:
      'A SQL query is built with string interpolation (f-string, concatenation, %-formatting) and executed against the database.',
    language: 'python',
    category: 'security',
    severity: 'critical when the value is traceable to an HTTP route parameter, otherwise high',
    confidence: '0.92 with a tainted route parameter, 0.75 without',
    howItWorks: [
      'Finds every cursor.execute(...) sink in the parsed file.',
      'Looks backwards for the query string being assembled by an f-string, concatenation or %-format.',
      'Traces the interpolated value: if it originates from a function parameter of a registered route handler, the finding is critical.',
    ],
    contextSignals: [
      'is_route_handler — whether the containing function is an HTTP endpoint',
      'tainted_from_parameter — whether the interpolated value traces to a function parameter',
    ],
    falsePositives:
      'Queries that interpolate only internal, non-user values still match the structural pattern — which is why the finding ships with its evidence chain for review instead of an automatic verdict. The counterexample validator refutes candidates where the sink uses a parameterized call.',
    fix: 'Use parameterized queries: cursor.execute("SELECT * FROM users WHERE name = ?", (name,)). See the SQL injection class page for the full before/after from the fixture repository.',
    vulnSlug: 'sql-injection',
    faqs: [
      {
        q: 'Does RVX-SQLI-001 fire on parameterized queries?',
        a: 'No. The rule matches string-built SQL that is executed. A parameterized call — cursor.execute(sql, (param,)) — is not a string-built sink, and if a candidate is raised the counterexample validator records the parameterization as proof-of-absence.',
      },
    ],
  },
  {
    id: 'RVX-SQLI-JS-001',
    slug: 'rvx-sqli-js-001',
    name: 'SQL injection (JavaScript)',
    summary:
      'A SQL query built with template literals or concatenation is executed against a database client.',
    language: 'javascript',
    category: 'security',
    severity: 'high',
    confidence: '0.82',
    howItWorks: [
      'Finds dynamic SQL executed against database clients (e.g. pg Client.query).',
      'Requires a template-literal interpolation or string concatenation building the query within the surrounding lines.',
      'Emits both the assembly line (transformation) and the execution line (sink) as evidence.',
    ],
    contextSignals: ['Query construction lines included in the evidence chain'],
    falsePositives:
      'Template literals that interpolate only trusted constants still match structurally; the evidence chain shows the reviewer exactly what was interpolated so the verdict is fast.',
    fix: 'Use parameterized placeholders ($1, $2 …) with the value array form of client.query. See the SQL injection class page.',
    vulnSlug: 'sql-injection',
    faqs: [
      {
        q: 'Which JavaScript database clients are covered?',
        a: 'The rule matches query execution against database client objects generally — the shipped fixture exercises pg. The attack-path engine classifies any executed query sink the same way regardless of driver.',
      },
    ],
  },
  {
    id: 'RVX-CMDI-001',
    slug: 'rvx-cmdi-001',
    name: 'Command injection (Python)',
    summary:
      'A command built dynamically (f-string, concatenation, %s, or shell=True in scope) is executed via os.system, os.popen or subprocess.',
    language: 'python',
    category: 'security',
    severity: 'high',
    confidence: '0.8',
    howItWorks: [
      'Matches os.system / os.popen calls and subprocess.call/run/Popen/check_output within a small line window.',
      'Fires when the command is dynamic (interpolation, concatenation, %s) or shell=True appears in the window.',
      'Attaches the sink snippet so the reviewer sees the exact executed expression.',
    ],
    contextSignals: ['The dynamic-construction pattern that triggered the match'],
    falsePositives:
      'subprocess calls with constant argv lists do not match — the dynamic-construction requirement keeps static commands out.',
    fix: 'Pass an argument list and disable the shell: subprocess.run(["ping", "-c", "1", host], shell=False). The fixture’s fixed variant demonstrates exactly this.',
    vulnSlug: 'command-injection',
    faqs: [
      {
        q: 'Why does shell=True matter to the rule?',
        a: 'With shell=True the string is parsed by a shell, so any interpolated metacharacter becomes command syntax. The detector treats its presence in the window as an aggravating signal even when the command string itself looks static.',
      },
    ],
  },
  {
    id: 'RVX-CMDI-JS-001',
    slug: 'rvx-cmdi-js-001',
    name: 'Command injection (JavaScript)',
    summary: 'A dynamic command string is passed to child_process exec or execSync.',
    language: 'javascript',
    category: 'security',
    severity: 'high',
    confidence: '0.8',
    howItWorks: [
      'Matches exec( / execSync( calls.',
      'Requires a template-literal ${...} interpolation or string concatenation in the surrounding lines — constant commands do not fire.',
    ],
    contextSignals: ['The interpolation pattern found near the sink'],
    falsePositives: 'exec with a fully constant command string is not flagged.',
    fix: 'Use execFile with an argv array instead of exec with a shell string.',
    vulnSlug: 'command-injection',
    faqs: [
      {
        q: 'What about spawn?',
        a: 'spawn with an argv array and no shell option does not construct a shell command string, so it is not a match for this rule — matching the actual exploitability difference.',
      },
    ],
  },
  {
    id: 'RVX-SECRET-001',
    slug: 'rvx-secret-001',
    name: 'Hardcoded secret (assignment)',
    summary:
      'A high-entropy literal is assigned to a secret-like name (api_key, password, secret, token …).',
    language: 'python',
    category: 'security',
    severity: 'high',
    confidence: '0.92',
    howItWorks: [
      'Scans assignments to names matching a secret-like vocabulary.',
      'Computes Shannon entropy of the literal — random-looking strings qualify, dictionary words and placeholders do not.',
      'Filters obvious placeholders (example, placeholder, xxx…) to keep test fixtures from drowning real findings.',
    ],
    contextSignals: ['The secret-like name and the flagged line’s snippet'],
    falsePositives:
      'Realistic fake credentials in test fixtures have real-credential shape and will be flagged — by design. Low-entropy or placeholder values are skipped.',
    fix: 'Rotate the credential (removal does not un-leak it), move the value to environment/secret-manager loading, and purge history if the repo is shared.',
    vulnSlug: 'hardcoded-secrets',
    faqs: [
      {
        q: 'Why entropy instead of a fixed pattern list?',
        a: 'Key formats change; randomness does not. Entropy matching catches sk_live_…, AKIA…, private PEM blocks and whatever comes next, while placeholder filtering keeps the noise down.',
      },
    ],
  },
  {
    id: 'RVX-SECRET-002',
    slug: 'rvx-secret-002',
    name: 'Hardcoded secret (keyword argument)',
    summary: 'A secret-like value is passed as a keyword argument, e.g. create_app(password="…").',
    language: 'python',
    category: 'security',
    severity: 'high',
    confidence: '0.88',
    howItWorks: [
      'Matches keyword arguments whose name is secret-like and whose value is a high-entropy literal.',
      'De-duplicates against the assignment scan so one value is not reported twice.',
    ],
    contextSignals: ['The argument name and call-site line'],
    falsePositives: 'Same placeholder/entropy filtering as RVX-SECRET-001.',
    fix: 'Load from environment and pass the handle, not the literal.',
    vulnSlug: 'hardcoded-secrets',
    faqs: [],
  },
  {
    id: 'RVX-SECRET-JS-001',
    slug: 'rvx-secret-js-001',
    name: 'Hardcoded secret (JavaScript)',
    summary: 'A high-entropy literal assigned to a secret-like name in JavaScript/TypeScript.',
    language: 'javascript',
    category: 'security',
    severity: 'high',
    confidence: '0.9',
    howItWorks: [
      'Same entropy + placeholder filtering as the Python rule, applied to const/let assignments and object properties.',
    ],
    contextSignals: ['The flagged name and line snippet'],
    falsePositives: 'Placeholder filtering as above.',
    fix: 'Move to process.env / a secret manager and rotate.',
    vulnSlug: 'hardcoded-secrets',
    faqs: [],
  },
  {
    id: 'RVX-EVAL-001',
    slug: 'rvx-eval-001',
    name: 'Dynamic code execution (Python)',
    summary: 'eval / exec / compile called with a non-constant argument.',
    language: 'python',
    category: 'security',
    severity: 'medium',
    confidence: '0.7',
    howItWorks: [
      'Matches eval( / exec( / compile( calls.',
      'Only fires when the argument is non-constant — interpolated or concatenated. Literal-only calls are allowed.',
    ],
    contextSignals: ['The dynamic argument pattern'],
    falsePositives:
      'eval of a fully constant string is not flagged. Reachability (whether untrusted input can arrive) is decided by the attack-path engine, not this rule.',
    fix: 'ast.literal_eval for data, an allowlisted AST evaluator for expressions, or remove the capability — the fixture’s fix refuses arbitrary evaluation outright.',
    vulnSlug: 'dynamic-code-execution',
    faqs: [],
  },
  {
    id: 'RVX-EVAL-JS-001',
    slug: 'rvx-eval-js-001',
    name: 'Dynamic code execution (JavaScript)',
    summary: 'eval or new Function invoked with dynamic input.',
    language: 'javascript',
    category: 'security',
    severity: 'medium',
    confidence: '0.7',
    howItWorks: ['Matches eval( and new Function( with non-constant arguments.'],
    contextSignals: ['The dynamic argument pattern'],
    falsePositives: 'Constant-string calls are not flagged.',
    fix: 'JSON.parse for data; explicit parsers or maps for logic.',
    vulnSlug: 'dynamic-code-execution',
    faqs: [],
  },
  {
    id: 'RVX-CRYPTO-001',
    slug: 'rvx-crypto-001',
    name: 'Weak cryptographic hash',
    summary: 'hashlib.md5 / hashlib.sha1 (or bare md5()/sha1()) is called.',
    language: 'python',
    category: 'security',
    severity: 'low',
    confidence: '0.7',
    howItWorks: [
      'Per-line match of weak hash invocations with the call snippet attached as sink evidence.',
      'Deliberately low severity: the rule cannot know the purpose; context comes from the LLM layer and evidence engine.',
    ],
    contextSignals: ['Which weak function was called and where'],
    falsePositives:
      'Non-security checksums legitimately use MD5 — the low severity reflects that uncertainty instead of overclaiming.',
    fix: 'argon2/scrypt/bcrypt for passwords; HMAC-SHA256 for fingerprints and signatures.',
    vulnSlug: 'weak-cryptography',
    faqs: [],
  },
  {
    id: 'RVX-EXCEPT-001',
    slug: 'rvx-except-001',
    name: 'Broad exception handler',
    summary: 'A bare except: or except Exception: clause silently swallows errors.',
    language: 'python',
    category: 'reliability',
    severity: 'low',
    confidence: '0.6',
    howItWorks: [
      'Structural per-line match: except with no named type, or Exception with only pass/… in the body.',
      'Also feeds the defect-risk lens of the code-health score (1.1 point penalty per hit).',
    ],
    contextSignals: ['The handler snippet including following lines'],
    falsePositives: 'Handlers that name a specific exception and act on it do not match.',
    fix: 'Catch the narrowest type and handle or propagate explicitly.',
    vulnSlug: 'broad-exception-handling',
    faqs: [],
  },
];

export function getRule(slug: string): DetectionRule | undefined {
  return DETECTION_RULES.find((r) => r.slug === slug);
}
