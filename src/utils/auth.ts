export type AuthProvider = 'disabled' | 'clerk';

const configuredProvider = (process.env.AUTH_PROVIDER ?? process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? '')
  .trim()
  .toLowerCase();

const isProduction = process.env.NODE_ENV === 'production';

const canUseProductionAuthBypass = (): boolean => {
  if (!isProduction) return false;
  if (process.env.ALLOW_PRODUCTION_AUTH_BYPASS !== 'true') return false;

  const userId = process.env.DEFAULT_USER_ID?.trim();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID?.trim();

  return Boolean(userId && workspaceId);
};

const readAuthProvider = (): AuthProvider => {
  if ((configuredProvider === 'disabled' || configuredProvider === 'false')) {
    if (!isProduction) return 'disabled';
    if (canUseProductionAuthBypass()) return 'disabled';
  }

  if (!isProduction && !configuredProvider && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return 'disabled';
  }

  // Clerk is the only supported provider. Unknown and legacy provider values
  // fail closed into Clerk mode instead of selecting an alternate trust path.
  return 'clerk';
};

export const AUTH_PROVIDER: AuthProvider = readAuthProvider();
export const AUTH_ENABLED = AUTH_PROVIDER === 'clerk';
export const CLERK_ENABLED = AUTH_PROVIDER === 'clerk';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const secretKey = typeof window === 'undefined' ? process.env.CLERK_SECRET_KEY ?? '' : null;

const isStubKey = (key: string) =>
  key.startsWith('pk_stub_') ||
  key.startsWith('sk_stub_') ||
  key === 'pk_test_dummy' ||
  key === 'sk_test_dummy';

export const isValidPublishableKey = (key: string) =>
  key.startsWith('pk_') && key.length > 20 && !isStubKey(key);

export const isValidSecretKey = (key: string | null | undefined) =>
  typeof key === 'string' && key.startsWith('sk_') && key.length > 20 && !isStubKey(key);

const WORKSPACE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidWorkspaceId = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return Boolean(normalized && WORKSPACE_ID_PATTERN.test(normalized));
};

export const CLERK_SERVER_ENABLED =
  CLERK_ENABLED && isValidSecretKey(process.env.CLERK_SECRET_KEY);

export const CLERK_RUNTIME_ENABLED =
  CLERK_ENABLED &&
  isValidPublishableKey(publishableKey);

export const getPublishableKey = () => publishableKey;
export const getSignInUrl = () =>
  process.env.NEXT_PUBLIC_SIGN_IN_URL ?? process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in';
export const getSignUpUrl = () =>
  process.env.NEXT_PUBLIC_SIGN_UP_URL ?? process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-in';
