import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Clerk deployment configuration', () => {
  it('builds the client in disabled-auth mode without embedding Clerk secrets', () => {
    const workflow = read('.github/workflows/dokploy.yml');

    expect(workflow).toContain('NEXT_PUBLIC_AUTH_PROVIDER=disabled');
    expect(workflow).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}');
    expect(workflow).not.toContain('CLERK_SECRET_KEY=${{ secrets');
  });

  it('passes the disabled auth provider and only the publishable Clerk key into the Dockerfile', () => {
    const dockerfile = read('Dockerfile');

    expect(dockerfile).toContain('ARG NEXT_PUBLIC_AUTH_PROVIDER=disabled');
    expect(dockerfile).toContain('ENV NEXT_PUBLIC_AUTH_PROVIDER=$NEXT_PUBLIC_AUTH_PROVIDER');
    expect(dockerfile).toContain('ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(dockerfile).toContain('ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(dockerfile).not.toContain('ARG CLERK_SECRET_KEY');
    expect(dockerfile).not.toContain('ENV CLERK_SECRET_KEY=');
  });

  it('keeps Dokploy on the latest image while verifying the exact commit SHA', () => {
    const workflow = read('.github/workflows/dokploy.yml');

    expect(workflow).toContain('DOKPLOY_EXPECTED_IMAGE: ghcr.io/${{ github.repository }}:latest');
    expect(workflow).toContain('EXPECTED_BUILD_SHA: ${{ github.sha }}');
  });

  it('exposes readiness booleans without credential or workspace values', () => {
    const route = read('src/app/api/deployment-info/route.ts');

    expect(route).toContain('authProvider');
    expect(route).toContain('clerkPublishableKeyConfigured');
    expect(route).toContain('clerkSecretConfigured');
    expect(route).toContain('workspaceConfigured');
    expect(route).not.toContain('process.env.CLERK_SECRET_KEY ?? null');
    expect(route).not.toContain('process.env.DEFAULT_WORKSPACE_ID ?? null');
  });
});
