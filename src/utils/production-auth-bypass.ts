export type ConfiguredAuthProvider = '' | 'disabled' | 'clerk';

const WORKSPACE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidWorkspaceId = (value: string | null | undefined): boolean => {
  const normalized = value?.trim();
  return Boolean(normalized && WORKSPACE_ID_PATTERN.test(normalized));
};

/**
 * Resolve both provider settings together so a public Clerk setting can never
 * be masked by a conflicting server-side legacy value.
 */
export const getConfiguredAuthProvider = (): ConfiguredAuthProvider => {
  const providers = [process.env.AUTH_PROVIDER, process.env.NEXT_PUBLIC_AUTH_PROVIDER]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  if (providers.length === 0) return '';
  if (providers.includes('clerk')) return 'clerk';
  if (providers.every((provider) => provider === 'disabled' || provider === 'false')) {
    return 'disabled';
  }

  // Unknown or conflicting values fail closed into Clerk mode.
  return 'clerk';
};

/**
 * The single effective production bypass predicate used by every auth path.
 * A raw flag is never sufficient to authenticate a production request.
 */
export const isProductionAuthBypassEnabled = (): boolean => {
  if (process.env.NODE_ENV !== 'production') return false;
  if (getConfiguredAuthProvider() !== 'disabled') return false;
  if (process.env.ALLOW_PRODUCTION_AUTH_BYPASS !== 'true') return false;

  const userId = process.env.DEFAULT_USER_ID?.trim();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID?.trim();

  return Boolean(userId && isValidWorkspaceId(workspaceId));
};

export const canUseProductionAuthBypass = (): boolean => isProductionAuthBypassEnabled();
