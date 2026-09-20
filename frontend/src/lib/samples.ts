/**
 * Sample records.
 *
 * The public pages show the real interface, which means they need rows to show
 * it with. These are those rows: they are labelled as sample data everywhere
 * they appear, they use the rule ids the engine actually emits, and they are
 * deliberately not presented as customer data or as a benchmark result.
 *
 * Nothing here is read by the authenticated application. The workspace renders
 * live API data only.
 */
export interface SampleFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  rule: string;
  path: string;
  line: number;
  verdict: 'verified' | 'probable' | 'rejected';
}

export const SAMPLE_FINDINGS: readonly SampleFinding[] = [
  {
    severity: 'critical',
    title: 'Request value reaches a database execution sink',
    rule: 'RVX-SQLI-001',
    path: 'app/search.py:43',
    line: 43,
    verdict: 'verified',
  },
  {
    severity: 'high',
    title: 'Command assembled from request data and executed',
    rule: 'RVX-CMDI-001',
    path: 'tools/render.py:88',
    line: 88,
    verdict: 'verified',
  },
  {
    severity: 'high',
    title: 'Credential literal assigned to a secret-like name',
    rule: 'RVX-SECRET-001',
    path: 'config/settings.py:12',
    line: 12,
    verdict: 'probable',
  },
  {
    severity: 'medium',
    title: 'Dynamic code execution on a non-constant argument',
    rule: 'RVX-EVAL-001',
    path: 'plugins/loader.py:31',
    line: 31,
    verdict: 'rejected',
  },
];

/** The repository used in sample surfaces, matching the fixture in scripts/. */
export const SAMPLE_REPOSITORY = {
  name: 'payments-api',
  branch: 'main',
  provider: 'github',
  files: 214,
  languages: ['Python', 'JavaScript'],
} as const;

/** A four-step walkthrough used by the marketing demo. */
export const DEMO_STEPS = [
  {
    id: 'connect',
    label: 'Connect',
    title: 'Point RepoVeriX at the repository',
    body: 'Import through GitHub or GitLab, a Git URL, an archive link or a ZIP upload. The import stores a snapshot, so nothing is written back.',
  },
  {
    id: 'scan',
    label: 'Scan',
    title: 'Detection runs in stages',
    body: 'Deterministic detectors run first, then model reasoning on the configurations that include it, then evidence validation decides the verdict.',
  },
  {
    id: 'finding',
    label: 'Read',
    title: 'A finding arrives with its chain',
    body: 'Source, transformation and sink, each with the file and the lines that prove it. The claim is readable before the code is.',
  },
  {
    id: 'verify',
    label: 'Verify',
    title: 'The repair is executed, not assumed',
    body: 'A candidate diff is applied to a copy of the snapshot and run. The recorded checks and exit codes are what makes a repair verified.',
  },
] as const;
