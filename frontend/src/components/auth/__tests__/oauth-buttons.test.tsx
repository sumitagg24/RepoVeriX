import * as React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { OAuthButtons } from '../auth-shell';
import { useOAuthProviders } from '@/hooks/use-platform';
import { oauthService } from '@/services/api';

jest.mock('@/hooks/use-platform', () => ({
  useOAuthProviders: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  oauthService: {
    loginUrl: jest.fn((provider: string) => `http://api.test/api/v1/auth/oauth/${provider}/login`),
    callbackUrl: jest.fn(
      (provider: string) => `http://api.test/api/v1/auth/oauth/${provider}/callback`,
    ),
  },
}));

const mockedUseOAuthProviders = useOAuthProviders as jest.MockedFunction<typeof useOAuthProviders>;
const mockedLoginUrl = oauthService.loginUrl as jest.Mock;
const mockedCallbackUrl = oauthService.callbackUrl as jest.Mock;

type Providers = ReturnType<typeof useOAuthProviders>['data'];

function providerInfo(configured: boolean) {
  return {
    configured,
    allowed: true,
    label: 'Provider',
    display_name: 'Provider',
    supports_signin: true,
    supports_repo_import: true,
  };
}

function mockProviders(overrides: Record<string, boolean> = {}) {
  const names = ['google', 'github', 'gitlab', 'microsoft', 'bitbucket', 'auth0', 'oracle'];
  const data = Object.fromEntries(
    names.map((name) => [name, providerInfo(Boolean(overrides[name]))]),
  ) as Providers;

  mockedUseOAuthProviders.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useOAuthProviders>);
}

function renderButtons() {
  return render(
    <TooltipProvider>
      <OAuthButtons next="/dashboard" />
    </TooltipProvider>,
  );
}

describe('OAuthButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Google, GitHub and GitLab even when none is configured', () => {
    mockProviders();
    renderButtons();

    expect(screen.getByRole('button', { name: /Google sign-in is not configured/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GitHub sign-in is not configured/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GitLab sign-in is not configured/i })).toBeInTheDocument();
    expect(screen.getAllByText('Setup')).toHaveLength(3);
  });

  it('opens setup steps instead of starting a flow that cannot work', () => {
    mockProviders();
    renderButtons();

    fireEvent.click(screen.getByRole('button', { name: /GitHub sign-in is not configured/i }));

    expect(screen.getByText('GitHub sign-in is not set up')).toBeInTheDocument();
    expect(mockedCallbackUrl).toHaveBeenCalledWith('github');
    expect(
      screen.getByText('http://api.test/api/v1/auth/oauth/github/callback'),
    ).toBeInTheDocument();
    expect(mockedLoginUrl).not.toHaveBeenCalled();
  });

  it('starts the real consent flow for a configured provider', () => {
    mockProviders({ github: true });
    renderButtons();

    // A configured provider carries no Setup chip and its accessible name is
    // the action, not the setup explanation.
    expect(screen.getAllByText('Setup')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /GitHub sign-in is not configured/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Continue with GitHub/i }));

    expect(mockedLoginUrl).toHaveBeenCalledWith('github', '/dashboard');
  });

  it('federates a standard provider through Auth0 when that is configured', () => {
    mockProviders({ auth0: true, google: true });
    renderButtons();

    // GitHub and GitLab fall back to Auth0 connections; Google is direct.
    fireEvent.click(screen.getByRole('button', { name: /Continue with GitHub/i }));

    expect(mockedLoginUrl).toHaveBeenCalledWith('auth0', '/dashboard', { connection: 'github' });
  });

  it('shows a retry affordance when provider status cannot be read', () => {
    const refetch = jest.fn();
    mockedUseOAuthProviders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useOAuthProviders>);

    renderButtons();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
    // The three standard buttons stay visible so the page still looks whole.
    expect(screen.getByRole('button', { name: /Google sign-in is not configured/i })).toBeInTheDocument();
  });
});
