export const isProductionAuthBypassEnabled = (): boolean => {
  return process.env.ALLOW_PRODUCTION_AUTH_BYPASS === 'true';
};

export const canUseProductionAuthBypass = (): boolean => {
  if (process.env.NODE_ENV !== 'production') return false;
  if (!isProductionAuthBypassEnabled()) return false;

  const userId = process.env.DEFAULT_USER_ID?.trim();
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID?.trim();

  return Boolean(userId && workspaceId);
};
