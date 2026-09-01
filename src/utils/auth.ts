import {
  canUseProductionAuthBypass,
  getConfiguredAuthProvider,
} from './production-auth-bypass';

export { isValidWorkspaceId } from './production-auth-bypass';

export type AuthProvider = 'disabled' | 'clerk';

const configuredProvider = getConfiguredAuthProvider();

const isProduction = process.env.NODE_ENV === 'production';

const readAuthProvider = (): AuthProvider => {
  if (configuredProvider === 'disabled') {
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
