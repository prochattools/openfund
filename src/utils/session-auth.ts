import { AUTH_PROVIDER, getOryBaseUrl } from './auth';

export const AUTH_SESSION_COOKIE_NAMES = ['ory_kratos_session', 'ory_session'] as const;

const ORY_WHOAMI_PATH = '/sessions/whoami';

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isProductionAuthEnforced = () => process.env.NODE_ENV === 'production';

export const hasAuthSessionCookie = (cookieHeader: string | null | undefined): boolean => {
  if (!isNonEmptyString(cookieHeader)) {
    return false;
  }

  return cookieHeader.split(';').some((part) => {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    const name = rawName?.trim();
    const value = rawValueParts.join('=').trim();

    if (!name || !value) {
      return false;
    }

    return AUTH_SESSION_COOKIE_NAMES.includes(name as typeof AUTH_SESSION_COOKIE_NAMES[number]);
  });
};

export const hasAuthSessionCookieFromStore = (
  cookieStore: { get: (name: string) => { value?: string } | undefined } | null | undefined,
): boolean => AUTH_SESSION_COOKIE_NAMES.some((cookieName) => isNonEmptyString(cookieStore?.get(cookieName)?.value));

export const isProductionSessionAuthenticated = async (cookieHeader: string | null | undefined): Promise<boolean> => {
  if (!isProductionAuthEnforced()) {
    return true;
  }

  if (!hasAuthSessionCookie(cookieHeader)) {
    return false;
  }

  if (AUTH_PROVIDER !== 'ory') {
    return true;
  }

  const oryBaseUrl = getOryBaseUrl().trim();
  if (!oryBaseUrl) {
    return false;
  }

  try {
    const response = await fetch(new URL(ORY_WHOAMI_PATH, oryBaseUrl), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        cookie: cookieHeader ?? '',
      },
      cache: 'no-store',
    });

    return response.ok;
  } catch {
    return false;
  }
};
