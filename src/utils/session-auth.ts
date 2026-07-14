import { verifyToken } from '@clerk/backend';
import { CLERK_SERVER_ENABLED } from './auth';

export const AUTH_SESSION_COOKIE_NAMES = ['__session'] as const;

export type VerifiedClerkSession = {
  clerkUserId: string;
};

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isProductionAuthEnforced = () => process.env.NODE_ENV === 'production';

const readCookie = (cookieHeader: string | null | undefined, name: string): string | null => {
  if (!isNonEmptyString(cookieHeader)) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value || null;
  }

  return null;
};

export const getClerkSessionToken = (cookieHeader: string | null | undefined): string | null =>
  readCookie(cookieHeader, '__session');

export const hasAuthSessionCookie = (cookieHeader: string | null | undefined): boolean =>
  Boolean(getClerkSessionToken(cookieHeader));

export const hasAuthSessionCookieFromStore = (
  cookieStore: { get: (name: string) => { value?: string } | undefined } | null | undefined,
): boolean => Boolean(cookieStore?.get('__session')?.value?.trim());

export const verifyClerkSession = async (
  cookieHeader: string | null | undefined,
): Promise<VerifiedClerkSession | null> => {
  if (!CLERK_SERVER_ENABLED) return null;

  const token = getClerkSessionToken(cookieHeader);
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!token || !secretKey) return null;

  try {
    const claims = await verifyToken(token, { secretKey });
    return typeof claims.sub === 'string' && claims.sub.trim()
      ? { clerkUserId: claims.sub }
      : null;
  } catch {
    return null;
  }
};

export const isProductionSessionAuthenticated = async (
  cookieHeader: string | null | undefined,
): Promise<boolean> => {
  if (!isProductionAuthEnforced() && !CLERK_SERVER_ENABLED) return true;
  return Boolean(await verifyClerkSession(cookieHeader));
};
