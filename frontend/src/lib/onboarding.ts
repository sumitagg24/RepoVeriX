/**
 * sessionStorage flag set right before the user leaves for an OAuth provider
 * during onboarding. The OAuth callback reads it to return to the wizard
 * instead of the repositories import dialog. Cleared as soon as it is used.
 */
export const ONBOARDING_CONNECT_FLAG = 'repoverix-onboarding-connect';
