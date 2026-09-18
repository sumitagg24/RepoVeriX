/**
 * Frequently asked questions.
 *
 * Answers describe what the backend actually does. The same list feeds the
 * visible questions and the FAQPage structured data, so the two cannot disagree.
 */
export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    question: 'What makes a RepoVeriX finding different from a scanner warning?',
    answer:
      'Every finding carries an ordered evidence chain: where untrusted input enters, how it is transformed, and which sink it reaches, plus the static rule that matched. Findings whose claims cannot be grounded are recorded as probable or rejected instead of being shown as facts.',
  },
  {
    question: 'How is a repair marked verified?',
    answer:
      'The candidate patch is applied to an isolated copy of the repository in a sandbox with CPU, memory and time limits. Dependencies resolve, the recorded checks run, and the outcome is stored with its exit codes. When those checks pass the repair is recorded as verified; otherwise it is recorded as failed or not verifiable, and the finding keeps the refutation.',
  },
  {
    question: 'Is my source code executed on your host?',
    answer:
      'No. Repository code is parsed and analysed statically. Anything that executes runs only inside the isolated sandbox, with controlled networking and no host secrets exposed. Likely secrets are redacted before any model call.',
  },
  {
    question: 'Which languages are supported today?',
    answer:
      'Python, JavaScript and TypeScript. Parsing is built on tree-sitter, which is extensible, but only those three languages are parsed and analysed today, so they are the only ones claimed.',
  },
  {
    question: 'Which scan configurations exist?',
    answer:
      'Four: static only, model only, static plus model, and the full RepoVeriX pipeline with evidence validation. They exist so the same repository can be compared across approaches. Configurations that call a model need a plan with model reasoning enabled.',
  },
  {
    question: 'Do static-only scans need an external model provider?',
    answer:
      'No. The deterministic detectors run without any model calls, so static-only scans work on a deployment with no provider keys configured at all.',
  },
  {
    question: 'What happens when I reach a plan limit?',
    answer:
      'The API refuses the action with an explanatory reason, and the interface names what was hit: repositories, scans, candidate fixes or verifications. Nothing already scanned or verified is removed, and the reason stays visible on the screen that was blocked.',
  },
  {
    question: 'Can I export results into other tools?',
    answer:
      'Yes. A scan can be downloaded as JSON or Markdown, and as SARIF 2.1.0, which GitHub code scanning and most IDEs can read. Report links can be shared with an expiry you choose and revoked later.',
  },
  {
    question: 'How do teams share access?',
    answer:
      'Create an organization, add existing accounts by email with a member, admin or owner role, and attach repositories to it. Members then see the organization dashboard and security center for the repositories that were attached.',
  },
  {
    question: 'Where does the reported risk come from?',
    answer:
      'Deterministic detectors, model reasoning, and evidence validation where the plan enables them. The scan detail page lists each analysis stage with its own status and output, so you can see which stage produced what.',
  },
  {
    question: 'Is there a CI integration or a pull-request bot?',
    answer:
      'Not yet. RepoVeriX audits repositories on demand today, and CI or pull-request automation is planned work. It is not listed as an integration because the backend does not expose it.',
  },
  {
    question: 'Does an empty result mean the repository is safe?',
    answer:
      'No, and the product says so on the pages where that could be misread. A scan reports what the configured stages found in the files they can parse. Absence of findings is not a statement about the repository as a whole.',
  },
];
