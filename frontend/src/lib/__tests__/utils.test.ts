import { safeRedirectPath } from '../utils';

describe('safeRedirectPath', () => {
  it('keeps same-origin paths, including query and hash', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('/repositories?tab=github')).toBe('/repositories?tab=github');
    expect(safeRedirectPath('/findings/abc#evidence')).toBe('/findings/abc#evidence');
  });

  it('falls back when no path was supplied', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
    expect(safeRedirectPath(undefined)).toBe('/dashboard');
    expect(safeRedirectPath('')).toBe('/dashboard');
    expect(safeRedirectPath('', '/onboarding')).toBe('/onboarding');
  });

  it('rejects absolute URLs and protocol-relative paths', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/dashboard');
    expect(safeRedirectPath('//evil.example/path')).toBe('/dashboard');
    expect(safeRedirectPath('/\\evil.example')).toBe('/dashboard');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
  });

  it('rejects header-splitting and backslash tricks', () => {
    expect(safeRedirectPath('/ok\nLocation: https://evil.example')).toBe('/dashboard');
    expect(safeRedirectPath('/a\\b')).toBe('/dashboard');
  });
});
