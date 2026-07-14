import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Clerk deployment configuration', () => {
  it('validates the public build key before Docker execution', () => {
    const workflow = read('.github/workflows/dokploy.yml');

    expect(workflow).toContain('Validate Clerk build configuration');
    expect(workflow).toContain('CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}');
    expect(workflow).toContain('pk_(live|test)_[A-Za-z0-9_-]{10,}');
    expect(workflow).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}');
    expect(workflow).not.toContain('CLERK_SECRET_KEY=${{ secrets');
  });

  it('passes only the publishable key into the image build', () => {
    const dockerfile = read('Dockerfile');

    expect(dockerfile).toContain('ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(dockerfile).toContain('ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(dockerfile).not.toContain('ARG CLERK_SECRET_KEY');
    expect(dockerfile).not.toContain('ENV CLERK_SECRET_KEY=');
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
