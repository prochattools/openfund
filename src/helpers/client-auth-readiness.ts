export const isFinanceSessionReady = ({
  authEnabled,
  isLoaded,
  isSignedIn,
}: {
  authEnabled: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
}): boolean => !authEnabled || (isLoaded && isSignedIn);
