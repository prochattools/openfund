'use client';

import { useEffect, useTransition } from "react";
import type { FC, ReactNode } from "react";
import { ClerkProvider } from "@/utils/clerkClient";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { Tooltip } from "react-tooltip";
import { LedgerProvider } from "@/context/ledger-context";
import {
  CLERK_RUNTIME_ENABLED,
  getPublishableKey,
  getSignInUrl,
  getSignUpUrl,
} from "@/utils/auth";
import { useRouter } from "next/navigation";
import { AUTH_PROVIDER } from "@/utils/auth";

declare global {
  interface Window {
    __clerk_internal_invalidateCachePromise?: () => void;
    __unstable__onBeforeSetActive?: () => Promise<void>;
  }
}

const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="light"
    enableSystem={false}
    disableTransitionOnChange
  >
    <LedgerProvider>
      <div className="min-h-screen bg-[#f5f1ea]">
        {AUTH_PROVIDER === 'disabled' && (
          <div className="fixed top-0 left-0 right-0 bg-amber-100 text-amber-900 px-4 py-2 text-sm text-center z-50 border-b border-amber-200 pointer-events-none">
            Tijdelijke testmodus: authenticatie is uitgeschakeld.
          </div>
        )}
        <div className={AUTH_PROVIDER === 'disabled' ? 'pt-10' : ''}>{children}</div>
      </div>
    </LedgerProvider>

    <Toaster
      position="bottom-center"
      toastOptions={{
        duration: 3000,
        className: "text-sm bg-[#251f1a] text-[#fbf8f2]",
      }}
    />

    <Tooltip id="tooltip" className="z-[60] !opacity-100 max-w-sm shadow-lg" />
  </ThemeProvider>
);

export function Providers({ children }: { children: ReactNode }) {
  if (!CLERK_RUNTIME_ENABLED) {
    return <AppProviders>{children}</AppProviders>;
  }

  return (
    <ClerkProvider
      publishableKey={getPublishableKey()}
      signInUrl={getSignInUrl()}
      signUpUrl={getSignUpUrl()}
      fallbackRedirectUrl="/"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <ClerkCacheRefreshPatch />
      <AppProviders>{children}</AppProviders>
    </ClerkProvider>
  );
}

const ClerkCacheRefreshPatch: FC = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!CLERK_RUNTIME_ENABLED || typeof window === "undefined") {
      return;
    }

    const previous = window.__unstable__onBeforeSetActive;
    const patched = () =>
      new Promise<void>((resolve) => {
        window.__clerk_internal_invalidateCachePromise = resolve;
        startTransition(() => {
          router.refresh();
        });
      });

    window.__unstable__onBeforeSetActive = patched;

    return () => {
      if (typeof window === "undefined") {
        return;
      }
      window.__unstable__onBeforeSetActive = previous;
    };
  }, [router, startTransition]);

  useEffect(() => {
    if (!CLERK_RUNTIME_ENABLED || typeof window === "undefined") {
      return;
    }
    if (!isPending) {
      window.__clerk_internal_invalidateCachePromise?.();
      window.__clerk_internal_invalidateCachePromise = undefined;
    }
  }, [isPending]);

  return null;
};
