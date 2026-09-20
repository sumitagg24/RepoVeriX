import type { Severity } from '@/types/api';

/**
 * Detection rule catalogue.
 *
 * These are the rule IDs the engine actually emits (`backend/app/analysis/
 * detectors.py`) — the same strings that appear in findings, SARIF output and
 * `lib/rules` guidance. Nothing here is a hypothetical rule.
 */
export interface DetectionRule {
  id: string;
  slug: string;
  name: string;
  summary: string;
  language: 'python' | 'javascript';
  category: 'security' | 'reliability';
  severity: Severity;
  confidence: number;
  /** How the detector decides, in its own terms. */
  howItWorks: string[];
  /** Extra context the engine attaches to the evidence chain. */
  contextSignals: string[];
  falsePositives: string;
  fix: string;
  example: { insecure: string; secure: string };
}

export const DETECTION_RULES: DetectionRule[] = [
  {
    id: 'RVX-SQLI-001',
    slug: 'rvx-sqli-001',
    name: 'SQL injection (Python)',
    summary:
      'A SQL query assembled with string interpolation is executed against the database.',
    language: 'python',
    category: 'security',
    severity: 'critical',
    confidence: 0.92,
    howItWorks: [
      'Finds every cursor.execute(…) sink in the parsed file.',
      'Looks backwards for the query string being assembled by an f-string, concatenation or %-format.',
      'Traces the interpolated value: when it originates from a route handler parameter, severity is critical instead of high.',
    ],
    contextSignals: [
      'tainted_from_parameter — the interpolated value traces back to a function parameter',
      'is_route_handler — the containing function is an HTTP endpoint',
    ],
    falsePositives:
      'Queries that interpolate only internal values still match the structural pattern, which is why the finding ships with its evidence chain for review rather than an automatic verdict. A parameterised call is not a match at all.',
    fix: 'Pass the value as a bound parameter instead of building the statement: cursor.execute("SELECT * FROM users WHERE name = ?", (name,)).',
    example: {
      insecure: 'query = f"SELECT * FROM users WHERE name = \'{name}\'"\ncursor.execute(query)',
      secure: 'cursor.execute("SELECT * FROM users WHERE name = ?", (name,))',
    },
  },
  {
    id: 'RVX-SQLI-JS-001',
    slug: 'rvx-sqli-js-001',
    name: 'SQL injection (JavaScript)',
    summary: 'A query built with template literals or concatenation is executed against a database client.',
    language: 'javascript',
    category: 'security',
    severity: 'high',
    confidence: 0.82,
    howItWorks: [
      'Finds dynamic SQL executed against database clients (for example pg Client.query).',
      'Requires a template-literal interpolation or string concatenation building the query nearby.',
      'Emits both the assembly line and the execution line as evidence.',
    ],
    contextSignals: ['Query construction lines included in the evidence chain'],
    falsePositives:
      'Template literals interpolating only constants still match structurally; the evidence chain shows exactly what was interpolated.',
    fix: 'Use placeholders ($1, $2 …) with the value array form of client.query.',
    example: {
      insecure: 'const q = `SELECT * FROM users WHERE email = \'${email}\'`;\nawait client.query(q);',
      secure: 'await client.query("SELECT * FROM users WHERE email = $1", [email]);',
    },
  },
  {
    id: 'RVX-CMDI-001',
    slug: 'rvx-cmdi-001',
    name: 'Command injection (Python)',
    summary:
      'A dynamically built command string is executed via os.system, os.popen or subprocess.',
    language: 'python',
    category: 'security',
    severity: 'high',
    confidence: 0.8,
    howItWorks: [
      'Matches os.system / os.popen and subprocess.call/run/Popen/check_output within a small line window.',
      'Fires when the command is dynamic (interpolation, concatenation, %s) or shell=True appears in the window.',
      'Attaches the sink snippet so the reviewer sees the executed expression.',
    ],
    contextSignals: ['The dynamic-construction pattern that triggered the match'],
    falsePositives:
      'Subprocess calls with constant argument lists do not match — the dynamic-construction requirement keeps static commands out.',
    fix: 'Pass an argument list and disable the shell: subprocess.run(["ping", "-c", "1", host], shell=False).',
    example: {
      insecure: 'os.system(f"ping -c 1 {host}")',
      secure: 'subprocess.run(["ping", "-c", "1", host], shell=False, check=True)',
    },
  },
  {
    id: 'RVX-CMDI-JS-001',
    slug: 'rvx-cmdi-js-001',
    name: 'Command injection (JavaScript)',
    summary: 'A dynamic command string is passed to child_process exec or execSync.',
    language: 'javascript',
    category: 'security',
    severity: 'high',
    confidence: 0.8,
    howItWorks: [
      'Matches exec( / execSync( calls.',
      'Requires a template-literal ${…} interpolation or concatenation nearby — constant commands do not fire.',
    ],
    contextSignals: ['The interpolation pattern found near the sink'],
    falsePositives: 'exec with a fully constant command string is not flagged.',
    fix: 'Use execFile with an argv array instead of exec with a shell string.',
    example: {
      insecure: 'exec(`git log ${branch}`);',
      secure: 'execFile("git", ["log", branch]);',
    },
  },
  {
    id: 'RVX-SECRET-001',
    slug: 'rvx-secret-001',
    name: 'Hardcoded secret (assignment)',
    summary: 'A high-entropy literal is assigned to a secret-like name (api_key, password, token …).',
    language: 'python',
    category: 'security',
    severity: 'high',
    confidence: 0.92,
    howItWorks: [
      'Scans assignments to names matching a secret-like vocabulary.',
      'Computes Shannon entropy of the literal — random-looking strings qualify, dictionary words and placeholders do not.',
      'Filters obvious placeholders so fixtures do not drown real findings.',
    ],
    contextSignals: ['The secret-like name and the flagged line snippet'],
    falsePositives:
      'Realistic fake credentials in test fixtures have real-credential shape and will be flagged, by design. Low-entropy placeholders are skipped.',
    fix: 'Rotate the credential (removing it does not un-leak it), load it from the environment or a secret manager, and purge it from shared history.',
    example: {
      insecure: 'API_KEY = "sk_live_9f3a7c1d84b25e60af17"',
      secure: 'API_KEY = os.environ["API_KEY"]',
    },
  },
  {
    id: 'RVX-SECRET-002',
    slug: 'rvx-secret-002',
    name: 'Hardcoded secret (keyword argument)',
    summary: 'A secret-like value is passed as a keyword argument, e.g. create_app(password="…").',
    language: 'python',
    category: 'security',
    severity: 'high',
    confidence: 0.88,
    howItWorks: [
      'Matches keyword arguments whose name is secret-like and whose value is a high-entropy literal.',
      'De-duplicates against the assignment scan so one value is reported once.',
    ],
    contextSignals: ['The argument name and call-site line'],
    falsePositives: 'Same placeholder and entropy filtering as RVX-SECRET-001.',
    fix: 'Load the value from the environment and pass the handle, not the literal.',
    example: {
      insecure: 'create_app(password="hunter2-hunter2-hunter2-a91c")',
      secure: 'create_app(password=os.environ["DB_PASSWORD"])',
    },
  },
  {
    id: 'RVX-SECRET-JS-001',
    slug: 'rvx-secret-js-001',
    name: 'Hardcoded secret (JavaScript)',
    summary: 'A high-entropy literal is assigned to a secret-like name in JavaScript or TypeScript.',
    language: 'javascript',
    category: 'security',
    severity: 'high',
    confidence: 0.9,
    howItWorks: [
      'Same entropy and placeholder filtering as the Python rule, applied to const/let assignments and object properties.',
    ],
    contextSignals: ['The flagged name and line snippet'],
    falsePositives: 'Placeholder filtering as above.',
    fix: 'Read from process.env or a secret manager, and rotate the exposed value.',
    example: {
      insecure: 'const apiKey = "ak_live_71bd93f0c4ea5582";',
      secure: 'const apiKey = process.env.API_KEY;',
    },
  },
  {
    id: 'RVX-EVAL-001',
    slug: 'rvx-eval-001',
    name: 'Dynamic code execution (Python)',
    summary: 'eval / exec / compile called with a non-constant argument.',
    language: 'python',
    category: 'security',
    severity: 'medium',
    confidence: 0.7,
    howItWorks: [
      'Matches eval( / exec( / compile( calls.',
      'Only fires when the argument is non-constant — interpolated or concatenated. Literal-only calls are allowed.',
    ],
    contextSignals: ['The dynamic argument pattern'],
    falsePositives:
      'eval of a fully constant string is not flagged. Reachability is decided by the attack-path engine, not this rule.',
    fix: 'Use ast.literal_eval for data, an allowlisted evaluator for expressions, or remove the capability entirely.',
    example: {
      insecure: 'result = eval(user_expression)',
      secure: 'result = ast.literal_eval(user_expression)',
    },
  },
  {
    id: 'RVX-EVAL-JS-001',
    slug: 'rvx-eval-js-001',
    name: 'Dynamic code execution (JavaScript)',
    summary: 'eval or new Function invoked with dynamic input.',
    language: 'javascript',
    category: 'security',
    severity: 'medium',
    confidence: 0.7,
    howItWorks: ['Matches eval( and new Function( with non-constant arguments.'],
    contextSignals: ['The dynamic argument pattern'],
    falsePositives: 'Constant-string calls are not flagged.',
    fix: 'Use JSON.parse for data and explicit parsers or lookup maps for logic.',
    example: {
      insecure: 'const config = eval(`(${rawConfig})`);',
      secure: 'const config = JSON.parse(rawConfig);',
    },
  },
  {
    id: 'RVX-CRYPTO-001',
    slug: 'rvx-crypto-001',
    name: 'Weak cryptographic hash',
    summary: 'hashlib.md5 / hashlib.sha1 (or bare md5()/sha1()) is called.',
    language: 'python',
    category: 'security',
    severity: 'low',
    confidence: 0.7,
    howItWorks: [
      'Per-line match of weak hash invocations, with the call snippet attached as sink evidence.',
      'Deliberately low severity: the rule cannot know the intended purpose, so context comes from the evidence engine.',
    ],
    contextSignals: ['Which weak function was called and where'],
    falsePositives:
      'Non-security checksums legitimately use MD5 — low severity reflects that uncertainty instead of overclaiming.',
    fix: 'Use argon2/scrypt/bcrypt for passwords and HMAC-SHA256 for fingerprints and signatures.',
    example: {
      insecure: 'digest = hashlib.md5(password.encode()).hexdigest()',
      secure: 'digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)',
    },
  },
  {
    id: 'RVX-EXCEPT-001',
    slug: 'rvx-except-001',
    name: 'Broad exception handler',
    summary: 'A bare except: or except Exception: clause silently swallows errors.',
    language: 'python',
    category: 'reliability',
    severity: 'low',
    confidence: 0.6,
    howItWorks: [
      'Structural per-line match: except with no named type, or Exception with only pass in the body.',
      'Also feeds the defect-risk lens of the code-health score.',
    ],
    contextSignals: ['The handler snippet including following lines'],
    falsePositives: 'Handlers that name a specific exception and act on it do not match.',
    fix: 'Catch the narrowest type that can actually occur and handle or propagate it explicitly.',
    example: {
      insecure: 'try:\n    payload = json.loads(body)\nexcept Exception:\n    pass',
      secure: 'try:\n    payload = json.loads(body)\nexcept json.JSONDecodeError:\n    raise HTTPException(status_code=400, detail="Malformed payload")',
    },
  },
];

/** Look-up by the rule id the engine stamps into evidence metadata. */
export function getRuleById(id: string | null | undefined): DetectionRule | undefined {
  if (!id) return undefined;
  return DETECTION_RULES.find((rule) => rule.id === id);
}

export function getRule(slug: string): DetectionRule | undefined {
  return DETECTION_RULES.find((rule) => rule.slug === slug);
}

export const RULE_CATEGORIES = Array.from(new Set(DETECTION_RULES.map((r) => r.category)));
export const RULE_LANGUAGES = Array.from(new Set(DETECTION_RULES.map((r) => r.language)));
