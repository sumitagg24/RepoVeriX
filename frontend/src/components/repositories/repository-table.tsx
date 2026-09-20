import * as React from 'react';
import Link from 'next/link';
import { GitBranch } from 'lucide-react';

import { ProviderBadge, RepoStateBadge } from '@/components/ui/badge';
import { Table, TableFrame, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { languageList } from '@/lib/domain';
import { absoluteTime, relativeTime } from '@/lib/dates';
import type { Repository, Scan } from '@/types/api';

/**
 * Connected repositories.
 *
 * The row answers four questions a person actually has: what is this repository,
 * did the import finish, when was it last looked at, and how much is sitting in
 * it. Provider identity is a chip with the provider's own name rather than a
 * logo-only glyph, so it survives greyscale and screen readers.
 */
export function RepositoryTable({
  repositories,
  latestScanFor,
  openFindingsFor,
}: {
  repositories: Repository[];
  latestScanFor?: (repositoryId: string) => Scan | undefined;
  openFindingsFor?: (repositoryId: string) => string | undefined;
}) {
  return (
    <TableFrame label="Repositories">
      <Table minWidth="min-w-[880px]">
        <THead>
          <TR>
            <TH>Repository</TH>
            <TH width="10rem">Provider</TH>
            <TH width="11rem">Connection</TH>
            <TH width="14rem">Last scan</TH>
            <TH width="12rem">Risk</TH>
            <TH width="6rem" align="right">
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {repositories.map((repository) => {
            const latest = latestScanFor?.(repository.id);
            const risk = openFindingsFor?.(repository.id);
            const languages = languageList(repository.primary_languages);
            return (
              <TR key={repository.id} className="align-top">
                <TD>
                  <Link
                    href={`/repositories/${repository.id}`}
                    className="text-[13.5px] font-medium text-ink transition-colors hover:text-accent"
                  >
                    {repository.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <GitBranch className="size-3" aria-hidden="true" />
                      {repository.default_branch}
                    </span>
                    {languages.length > 0 ? <span>{languages.join(', ')}</span> : null}
                  </div>
                </TD>
                <TD>
                  <ProviderBadge provider={repository.source_type} />
                </TD>
                <TD>
                  <RepoStateBadge state={repository.status} />
                  <p className="mt-1.5 text-[11.5px] text-faint" title={absoluteTime(repository.updated_at)}>
                    Updated {relativeTime(repository.updated_at)}
                  </p>
                </TD>
                <TD>
                  {latest ? (
                    <>
                      <Link
                        href={`/scans/${latest.id}`}
                        className="text-[13px] text-ink transition-colors hover:text-accent"
                      >
                        {latest.configuration}
                      </Link>
                      <p className="mt-1 text-[11.5px] text-faint" title={absoluteTime(latest.created_at)}>
                        {latest.status} · {relativeTime(latest.created_at)}
                      </p>
                    </>
                  ) : (
                    <span className="text-[13px] text-muted">Never scanned</span>
                  )}
                </TD>
                <TD>
                  {risk ? (
                    <Link
                      href={`/findings?repository=${repository.id}`}
                      className="text-[13px] text-ink transition-colors hover:text-accent"
                    >
                      {risk}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-faint">No summary yet</span>
                  )}
                </TD>
                <TD align="right">
                  <Link
                    href={`/repositories/${repository.id}`}
                    className="text-[13px] text-accent"
                  >
                    Detail
                  </Link>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableFrame>
  );
}
