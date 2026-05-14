import React, { ReactNode } from "react";
import { CLERK_RUNTIME_ENABLED } from "@/utils/auth";

type UseUserResponse = {
  isSignedIn: boolean;
  isLoaded: boolean;
  user?: unknown;
};

type ClerkClientExports = {
  ClerkProvider: (props: { children: ReactNode } & Record<string, unknown>) => JSX.Element;
  useUser: () => UseUserResponse;
  useClerk: () => {
    signOut: (props?: Record<string, unknown>) => Promise<void> | void;
    openUserProfile?: () => void;
  };
  SignIn: (props: Record<string, unknown>) => JSX.Element | null;
  SignUp: (props: Record<string, unknown>) => JSX.Element | null;
};

const createStubExports = (): ClerkClientExports => ({
  ClerkProvider: ({ children }: { children: ReactNode } & Record<string, unknown>) => <>{children}</>,
  useUser: () => ({
    isLoaded: true,
    isSignedIn: false,
  }),
  useClerk: () => ({
    signOut: async () => undefined,
    openUserProfile: () => undefined,
  }),
  SignIn: () => null,
  SignUp: () => null,
});

let exportsObject: ClerkClientExports = createStubExports();

if (CLERK_RUNTIME_ENABLED) {
  exportsObject = require("@clerk/nextjs");
}

export const ClerkProvider = exportsObject.ClerkProvider;
export const useUser = exportsObject.useUser;
export const useClerk = exportsObject.useClerk;
export const SignIn = exportsObject.SignIn;
export const SignUp = exportsObject.SignUp;
