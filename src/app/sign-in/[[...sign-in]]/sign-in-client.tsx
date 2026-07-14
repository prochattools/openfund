"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SignIn } from "@/utils/clerkClient";

const DEFAULT_REDIRECT = "/ledger";

export const getSafeSignInRedirect = (value: string | null | undefined): string => {
  if (!value) return DEFAULT_REDIRECT;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) {
      return DEFAULT_REDIRECT;
    }
    return decoded;
  } catch {
    return DEFAULT_REDIRECT;
  }
};

export default function SignInClient() {
  const searchParams = useSearchParams();

  const redirectUrl = useMemo(() => getSafeSignInRedirect(searchParams?.get("redirect_url")), [searchParams]);

  return <SignIn forceRedirectUrl={redirectUrl} />;
}
