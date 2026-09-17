/**
 * Sample-repository pages for /vulnerable-repos — grounded in the real test
 * fixtures shipped in backend/tests/fixtures/repos/. Routes, seeded defects
 * and file inventories are read from the fixture source, so every claim on
 * these pages describes what a scan of the repository actually produces.
 */

export interface FindingClass {
  name: string;
  vulnSlug: string;
  where: string;
  detail: string;
}

export interface SampleRepo {
  slug: string;
  name: string;
  stack: string;
  summary: string;
  /** Files in the fixture, relative to the repo root. */
  files: { path: string; purpose: string }[];
  endpoints: { route: string; handler: string; note: string }[];
  findingClasses: FindingClass[];
  /** What the fixed counterpart changes (vulnerable_app only). */
  fixedCounterpart?: string;
  hasTests: boolean;
}

export const SAMPLE_REPOS: SampleRepo[] = [
  {
    slug: 'vulnerable-app',
    name: 'vulnerable_app',
    stack: 'Python · Flask-style router · 96-line app + fixed counterpart + tests',
    summary:
      'A deliberately vulnerable Python app shipped as a RepoVeriX test fixture: six seeded defect classes, a fixed_app.py counterpart for comparison, and a test suite the repair verifier runs.',
    files: [
      { path: 'app.py', purpose: 'The vulnerable application: 4 routes + helpers' },
      { path: 'fixed_app.py', purpose: 'The same app with every defect fixed — the diff the verifier reproduces' },
      { path: 'tests/test_app.py', purpose: 'Test suite the proof-of-fix pipeline executes in the sandbox' },
      { path: 'requirements.txt', purpose: 'Dependencies installed inside the isolated verification environment' },
      { path: 'README.md', purpose: 'Declares the fixture is intentionally vulnerable; all credentials fake' },
    ],
    endpoints: [
      { route: 'GET /search', handler: 'search_users', note: 'SQL injection — name is interpolated into the query string' },
      { route: 'GET /users', handler: 'list_users_using_helper', note: 'SQL injection reached through a helper — tests inter-procedural tracing' },
      { route: 'GET /admin', handler: 'run_report', note: 'Command injection — subprocess call with shell=True' },
      { route: 'GET /score', handler: 'score', note: 'Dynamic code execution — eval() of the expression parameter' },
    ],
    findingClasses: [
      {
        name: 'SQL injection',
        vulnSlug: 'sql-injection',
        where: 'search_users (app.py) via build_query',
        detail:
          'The query is assembled with an f-string in build_query and executed in the route handler — the /users variant exercises detection through a helper function, not just the direct call.',
      },
      {
        name: 'Command injection',
        vulnSlug: 'command-injection',
        where: 'run_report (app.py)',
        detail:
          'A subprocess call builds a shell command from the hostname parameter with shell=True — the classic OS command injection sink.',
      },
      {
        name: 'Dynamic code execution',
        vulnSlug: 'dynamic-code-execution',
        where: 'score (app.py)',
        detail:
          'eval() runs the expression parameter directly — arbitrary code execution from a route parameter.',
      },
      {
        name: 'Hardcoded secrets',
        vulnSlug: 'hardcoded-secrets',
        where: 'module constant DEMO_API_KEY (app.py)',
        detail:
          'A fake Stripe-style API key (sk-demo-…) assigned to a module constant — detected by pattern, flagged critical-by-convention for demo material, marked fake in the README.',
      },
      {
        name: 'Weak cryptography',
        vulnSlug: 'weak-cryptography',
        where: 'fingerprint (app.py)',
        detail:
          'hashlib.md5 for token fingerprinting — a broken hash for any security purpose.',
      },
      {
        name: 'Broad exception handling',
        vulnSlug: 'broad-exception-handling',
        where: 'apply_discount (app.py)',
        detail:
          'A bare except Exception that swallows failures — the same function also carries a seeded logic boundary bug, so a scan surfaces both the security smell and the correctness defect.',
      },
    ],
    fixedCounterpart:
      'fixed_app.py parameterizes the queries, drops shell=True, removes eval, moves the key to an environment variable, switches to SHA-256 and narrows the exception handling — the exact patch the proof-of-fix pipeline re-derives and verifies by running tests/test_app.py.',
    hasTests: true,
  },
  {
    slug: 'vulnerable-js',
    name: 'vulnerable_js',
    stack: 'Node.js · Express · single 39-line server module',
    summary:
      'A deliberately vulnerable Node/Express API fixture: unsanitized SQL, OS command injection, eval of user input and a fake Stripe secret — the JavaScript half of the benchmark dataset.',
    files: [
      { path: 'src/server.js', purpose: 'The vulnerable Express server: 3 routes + helper' },
      { path: 'package.json', purpose: 'Manifest the sandbox installs inside the isolated verification environment' },
    ],
    endpoints: [
      { route: 'GET /search', handler: 'async route handler', note: 'SQL injection — template literal interpolated into client.query' },
      { route: 'GET /ping', handler: 'route handler', note: 'Command injection — exec() with the host query parameter' },
      { route: 'GET /eval', handler: 'route handler', note: 'Dynamic code execution — eval() of the expr parameter' },
    ],
    findingClasses: [
      {
        name: 'SQL injection',
        vulnSlug: 'sql-injection',
        where: 'GET /search (src/server.js)',
        detail:
          'A template literal builds the query from req.query.name and passes it straight to client.query — the JavaScript counterpart of the Python rule, matched by RVX-SQLI-JS-001.',
      },
      {
        name: 'Command injection',
        vulnSlug: 'command-injection',
        where: 'GET /ping (src/server.js)',
        detail:
          'child_process.exec interpolates the host parameter into a shell command — matched by RVX-CMDI-JS-001.',
      },
      {
        name: 'Dynamic code execution',
        vulnSlug: 'dynamic-code-execution',
        where: 'GET /eval (src/server.js)',
        detail:
          'eval(expr) on a request parameter — matched by RVX-EVAL-JS-001.',
      },
      {
        name: 'Weak cryptography',
        vulnSlug: 'weak-cryptography',
        where: 'hashToken (src/server.js)',
        detail:
          'crypto.createHash("md5") for token hashing — matched by RVX-CRYPTO-001.',
      },
    ],
    hasTests: false,
  },
];

export function getSampleRepo(slug: string): SampleRepo | undefined {
  return SAMPLE_REPOS.find((r) => r.slug === slug);
}
