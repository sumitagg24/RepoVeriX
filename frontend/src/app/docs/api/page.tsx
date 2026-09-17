import type { Metadata } from 'next';
import { H1, H2, P, C, Ul, Li, Callout, DocTable } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'API reference',
  description: 'RepoVeriX REST API: authentication, repositories, scans, findings, evidence, reports and SARIF export.',
  alternates: { canonical: '/docs/api' },
};

export default function DocsApiPage() {
  return (
    <>
      <H1>API reference</H1>
      <P lead>
        Base path <C>/api/v1</C> (configurable via <C>REPOVERIX_API_PREFIX</C>). Every endpoint
        except auth requires <C>Authorization: Bearer &lt;token&gt;</C>. The live interactive
        reference (OpenAPI/Swagger) is served by the backend itself at <C>/docs</C> — run the
        backend and open <C>http://127.0.0.1:8000/docs</C>.
      </P>

      <H2>Auth</H2>
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">POST</C>, <C key="2">/auth/signup</C>, 'Create account → {access_token, token_type}.'],
          [<C key="3">POST</C>, <C key="4">/auth/login</C>, 'Login → access token.'],
          [<C key="5">GET</C>, <C key="6">/auth/me</C>, 'Current user (profile + plan).'],
          [<C key="7">GET</C>, <C key="8">/auth/oauth/{'{provider}'}/callback</C>, 'OAuth callback for GitHub / Google / GitLab.'],
        ]}
      />

      <H2>Repositories</H2>
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">POST</C>, <C key="2">/repositories</C>, 'Register a git repository (GitHub/GitLab/any git URL).'],
          [<C key="3">POST</C>, <C key="4">/repositories/oauth</C>, 'Import from a connected OAuth provider.'],
          [<C key="5">POST</C>, <C key="6">/repositories/archive</C>, 'Import from an archive URL (incl. S3 presigned links).'],
          [<C key="7">POST</C>, <C key="8">/repositories/zip</C>, 'Multipart upload (name + .zip); archive validated & stored.'],
          [<C key="9">GET</C>, <C key="10">/repositories</C>, 'List owned repositories.'],
          [<C key="11">GET</C>, <C key="12">/repositories/{'{id}'}</C>, 'Repository detail.'],
          [<C key="13">DELETE</C>, <C key="14">/repositories/{'{id}'}</C>, 'Delete repository + stored files (204).'],
        ]}
      />

      <H2>Scans</H2>
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">POST</C>, <C key="2">/scans</C>, 'Start scan {repository_id, configuration} → 201 (background execution).'],
          [<C key="3">GET</C>, <C key="4">/scans</C>, 'List scans (filter by repository_id).'],
          [<C key="5">GET</C>, <C key="6">/scans/{'{id}'}</C>, 'Scan detail incl. analysis_runs per pipeline stage.'],
          [<C key="7">GET</C>, <C key="8">/scans/{'{id}'}/findings</C>, 'Findings (filters: severity, status).'],
          [<C key="9">GET</C>, <C key="10">/scans/{'{id}'}/report</C>, 'Full audit report (JSON or downloadable Markdown).'],
          [<C key="11">GET</C>, <C key="12">/scans/{'{id}'}/sarif</C>, 'SARIF 2.1.0 export (REJECTED findings excluded).'],
          [<C key="13">GET</C>, <C key="14">/scans/{'{id}'}/dedup</C>, 'Duplicate-finding / root-cause clusters.'],
          [<C key="15">POST</C>, <C key="16">/scans/{'{id}'}/cancel</C>, 'Cooperatively cancel a pending/running scan.'],
        ]}
      />
      <P>
        Scan <C>configuration</C> ∈ <C>static_only</C> | <C>llm_only</C> | <C>static_llm</C> |{' '}
        <C>repoverix</C>.
      </P>

      <H2>Findings, validation &amp; repair</H2>
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">GET</C>, <C key="2">/findings</C>, 'List (filters: scan_id, repository_id, category, severity, status).'],
          [<C key="3">GET</C>, <C key="4">/findings/{'{id}'}</C>, 'Finding + evidence + patches.'],
          [<C key="5">GET</C>, <C key="6">/findings/scan/{'{scan_id}'}/summary</C>, 'Aggregated counts by severity/status/category.'],
          [<C key="7">POST</C>, <C key="8">/findings/{'{id}'}/validate</C>, 'Counterexample validation battery → VERIFIED / PROBABLE / REJECTED with evidence.'],
          [<C key="9">POST</C>, <C key="10">/findings/{'{id}'}/generate-fix</C>, 'Create a candidate patch (template or LLM).'],
          [<C key="11">POST</C>, <C key="12">/findings/{'{id}'}/generate-test</C>, 'Generate a reproduction test for the defect.'],
          [<C key="13">POST</C>, <C key="14">/findings/generated-tests/{'{test_id}'}/run</C>, 'Run the test in the sandbox (optionally against a patched copy).'],
          [<C key="15">GET</C>, <C key="16">/findings/{'{id}'}/impact</C>, 'Finding impact analysis.'],
          [<C key="17">GET</C>, <C key="18">/findings/{'{id}'}/proof-of-fix</C>, 'Consolidated Proof of Fix record + decision.'],
          [<C key="19">POST</C>, <C key="20">/findings/{'{id}'}/chat</C>, 'Finding-scoped grounded Q&A.'],
        ]}
      />

      <H2>Patches &amp; verification</H2>
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">GET</C>, <C key="2">/patches</C>, 'List (filters: finding_id, scan_id, status).'],
          [<C key="3">GET</C>, <C key="4">/patches/{'{id}'}</C>, 'Patch detail incl. diff.'],
          [<C key="5">GET</C>, <C key="6">/patches/{'{id}'}/quality</C>, 'Deterministic patch quality score.'],
          [<C key="7">GET</C>, <C key="8">/patches/{'{id}'}/verifications</C>, 'Verification runs for the patch.'],
          [<C key="9">POST</C>, <C key="10">/patches/{'{id}'}/verify</C>, 'Run sandbox verification (201; 409 if one is pending/running).'],
          [<C key="11">GET</C>, <C key="12">/patches/verification/{'{verification_id}'}</C>, 'Verification run detail incl. per-test results.'],
        ]}
      />
      <P>
        Verification statuses: <C>pending</C>, <C>running</C>, <C>verified_repair</C>,{' '}
        <C>repair_failed</C>, <C>repair_not_verified</C>. Patch statuses: <C>candidate</C>,{' '}
        <C>applied</C>, <C>verified</C>, <C>failed</C>, <C>not_verified</C>.
      </P>

      <H2>Change audit &amp; PR auditing</H2>
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">POST</C>, <C key="2">/repositories/{'{repo_id}'}/change-audit</C>, 'Impact/risk analysis of a diff or base→head refs → 0–100 score + factors.'],
          [<C key="3">GET</C>, <C key="4">/repositories/{'{repo_id}'}/change-audits</C>, 'Change audit history.'],
          [<C key="5">GET</C>, <C key="6">/repositories/{'{repo_id}'}/change-audits/{'{audit_id}'}</C>, 'Change audit detail.'],
          [<C key="7">POST</C>, <C key="8">/repositories/{'{repo_id}'}/explain-change</C>, 'Commit/change explanation (evidence-referenced).'],
          [<C key="9">GET</C>, <C key="10">/repositories/{'{repo_id}'}/evidence-graph</C>, 'Queryable evidence/knowledge graph.'],
          [<C key="11">GET</C>, <C key="12">/repositories/{'{repo_id}'}/attack-paths</C>, 'Attack-path analysis for the repository.'],
          [<C key="13">GET</C>, <C key="14">/repositories/{'{repo_id}'}/dependency-reachability</C>, 'Dependency vulnerability reachability statuses.'],
          [<C key="15">GET</C>, <C key="16">/repositories/{'{repo_id}'}/regression</C>, 'Cross-scan regression comparison.'],
        ]}
      />
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">GET</C>, <C key="2">/repositories/{'{repo_id}'}/pull-requests</C>, 'List audited PRs for a repository.'],
          [<C key="3">POST</C>, <C key="4">/repositories/{'{repo_id}'}/pull-requests/analyze</C>, 'Fetch + analyze a GitHub PR → structured review (no posting).'],
          [<C key="5">POST</C>, <C key="6">/repositories/{'{repo_id}'}/pull-requests/{'{audit_id}'}/post</C>, 'Explicitly post the review as PR comments.'],
        ]}
      />

      <H2>Intelligence &amp; research</H2>
      <DocTable
        head={['Method', 'Path', 'Description']}
        rows={[
          [<C key="1">GET</C>, <C key="2">/repositories/{'{repo_id}'}/intelligence</C>, 'Wiki + architecture + git analytics + health payload.'],
          [<C key="3">POST</C>, <C key="4">/repositories/{'{repo_id}'}/query</C>, 'Grounded natural-language repository query.'],
          [<C key="5">GET</C>, <C key="6">/repositories/{'{repo_id}'}/architecture-smells</C>, 'Architecture smell list with metric/threshold/actual evidence.'],
          [<C key="6">GET</C>, <C key="7">/repositories/{'{repo_id}'}/health-timeline</C>, 'Recorded health snapshots over time.'],
          [<C key="8">GET</C>, <C key="9">/repositories/{'{repo_id}'}/multi-agent</C>, 'Five-agent consensus analysis.'],
          [<C key="10">GET</C>, <C key="11">/repositories/{'{repo_id}'}/self-improvement</C>, 'Rule/prompt selection analysis.'],
          [<C key="12">GET</C>, <C key="13">/repositories/{'{repo_id}'}/vuln-mining</C>, 'Historical vulnerability pattern mining.'],
          [<C key="14">GET</C>, <C key="15">/repositories/{'{repo_id}'}/risk-model</C>, 'Predictive defect-risk model output.'],
        ]}
      />
      <P>
        Dashboard aggregates: <C>GET /dashboard/summary</C>. Plan/billing: routes under{' '}
        <C>/billing</C>. Learning rules: <C>GET /learning/…</C> (self-improvement research).
      </P>

      <H2>Errors &amp; conventions</H2>
      <Ul>
        <Li>Errors return RFC 7807-style bodies with a stable <C>code</C> (e.g. <C>llm_invalid_json</C>) plus a human <C>detail</C> — never stack traces or internal paths.</Li>
        <Li>List endpoints paginate and filter by query params where documented in Swagger.</Li>
        <Li>Long-running work (scans, verification runs) is executed in the background; poll the resource until its status leaves <C>pending</C>/<C>running</C>.</Li>
      </Ul>
      <Callout kind="info">
        All feature paths above are implemented by the engines described in the{' '}
        <a href="/docs/features" className="font-medium text-primary underline-offset-4 hover:underline">
          Feature guide
        </a>
        . The Swagger UI at <C>/docs</C> is the authoritative, always-current reference.
      </Callout>
    </>
  );
}
