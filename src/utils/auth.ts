export type AuthProvider = 'disabled' | 'ory' | 'clerk';

const readAuthProvider = (): AuthProvider => {
  const configured = (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? process.env.AUTH_PROVIDER ?? '').trim().toLowerCase();

  if (configured === 'ory' || configured === 'clerk') {
    return configured;
  }

  if (configured === 'disabled' || configured === 'false' || process.env.AUTH_ENABLED === 'false') {
    return 'disabled';
  }

  return 'disabled';
};

export const AUTH_PROVIDER: AuthProvider = readAuthProvider();
export const AUTH_ENABLED = AUTH_PROVIDER !== 'disabled';
export const ORY_ENABLED = AUTH_PROVIDER === 'ory';
export const CLERK_ENABLED = AUTH_PROVIDER === 'clerk';

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const secretKey = (() => {
  if (typeof window !== 'undefined') {
    return null;
  }
  return process.env.CLERK_SECRET_KEY ?? '';
})();

const isStubKey = (key: string) =>
  key.startsWith('pk_stub_') ||
  key.startsWith('sk_stub_') ||
  key === 'pk_test_dummy' ||
  key === 'sk_test_dummy';

const isValidPublishableKey = (key: string) =>
  key.startsWith('pk_') && key.length > 20 && !isStubKey(key);

const isValidSecretKey = (key: string | null) => {
  if (key == null) {
    return true;
  }
  return key.startsWith('sk_') && key.length > 20 && !isStubKey(key);
};

export const CLERK_RUNTIME_ENABLED =
  CLERK_ENABLED && isValidPublishableKey(publishableKey) && isValidSecretKey(secretKey);

export const getPublishableKey = () => publishableKey;
export const getSignInUrl = () => process.env.NEXT_PUBLIC_SIGN_IN_URL ?? process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? '/sign-in';
export const getSignUpUrl = () => process.env.NEXT_PUBLIC_SIGN_UP_URL ?? process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? '/sign-in';
export const getOryBaseUrl = () => process.env.NEXT_PUBLIC_ORY_SDK_URL ?? process.env.ORY_SDK_URL ?? '';
export const getOryLoginUrl = () => process.env.NEXT_PUBLIC_ORY_LOGIN_URL ?? '/self-service/login/browser';
