import * as React from 'react';
import {
  siDocker,
  siGit,
  siGithub,
  siGitlab,
  siGoogle,
  siJavascript,
  siPython,
} from 'simple-icons';

/**
 * What RepoVeriX works with today.
 *
 * Real brand marks, rendered inline as SVG so there is no third-party request
 * and no broken image, with a single colour so they read on both themes. The
 * marks carry no captions: the role of each one is stated in the list beside the
 * wall, where it can be a sentence instead of a label.
 */
const MARKS = [
  { icon: siGithub, role: 'GitHub' },
  { icon: siGitlab, role: 'GitLab' },
  { icon: siGoogle, role: 'Google' },
  { icon: siGit, role: 'Git' },
  { icon: siPython, role: 'Python' },
  { icon: siJavascript, role: 'JavaScript' },
  { icon: siDocker, role: 'Docker' },
] as const;

export function IntegrationWall() {
  return (
    <ul className="grid grid-cols-3 items-center gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-7">
      {MARKS.map(({ icon, role }) => (
        <li key={role} className="flex items-center justify-center">
          <svg
            role="img"
            aria-label={role}
            viewBox="0 0 24 24"
            className="h-8 w-8 fill-neutral-500 transition-colors duration-200 hover:fill-ink"
          >
            <path d={icon.path} />
          </svg>
        </li>
      ))}
    </ul>
  );
}

/**
 * The same seven names, said out loud.
 *
 * A logo wall tells a reader who already recognises the mark what it means and
 * tells everyone else nothing, so the roles are written out. Each line maps to
 * something the product really does.
 */
export const INTEGRATION_ROLES = [
  { name: 'GitHub', role: 'OAuth sign-in and repository import, when the deployment has an OAuth app.' },
  { name: 'GitLab', role: 'The same OAuth flow, for GitLab-hosted repositories.' },
  { name: 'Google', role: 'Sign-in only. It is not an import source.' },
  { name: 'Git', role: 'Any HTTPS Git URL, with an optional branch.' },
  { name: 'Python', role: 'Parsed by the detectors and the repository-intelligence pass.' },
  { name: 'JavaScript', role: 'Parsed by the detectors and the repository-intelligence pass.' },
  { name: 'Docker', role: 'Required on the deployment for sandboxed verification runs.' },
] as const;
