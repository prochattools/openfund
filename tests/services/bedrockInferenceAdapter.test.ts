import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DisabledBedrockInferenceAdapter,
} from '../../server/services/bedrockInferenceAdapter';
import type {
  InferenceAdapter,
  InferenceInvocationIdentity,
  ProviderDisabledInferenceResult,
} from '../../server/services/bedrockInferenceAdapter';

const identity: InferenceInvocationIdentity = {
  workspaceId: 'workspace-1',
  targetTransactionId: 'transaction-1',
};

function assertInvocationIdentityTypeContract(): void {
  const valid: InferenceInvocationIdentity = {
    workspaceId: 'workspace',
    targetTransactionId: 'transaction',
  };
  void valid;

  // @ts-expect-error workspaceId is required
  const missingWorkspace: InferenceInvocationIdentity = {
    targetTransactionId: 'transaction',
  };

  // @ts-expect-error targetTransactionId is required
  const missingTarget: InferenceInvocationIdentity = {
    workspaceId: 'workspace',
  };

  void missingWorkspace;
  void missingTarget;
}

void assertInvocationIdentityTypeContract;

describe('Program Phase 5.1 DisabledBedrockInferenceAdapter', () => {
  it('is constructible with no arguments', () => {
    const adapter = new DisabledBedrockInferenceAdapter();
    expect(adapter).toBeInstanceOf(DisabledBedrockInferenceAdapter);
  });

  it('returns the exact PROVIDER_DISABLED abstention object', async () => {
    const adapter = new DisabledBedrockInferenceAdapter();
    const result = await adapter.infer(identity);

    expect(result).toEqual({ abstained: true, reason: 'PROVIDER_DISABLED' });
  });

  it('produces deeply equal output on repeated identical invocations', async () => {
    const adapter = new DisabledBedrockInferenceAdapter();
    const first = await adapter.infer(identity);
    const second = await adapter.infer(identity);

    expect(first).toEqual(second);
  });

  it('returns the same disabled result for different valid workspace and transaction identities', async () => {
    const adapter = new DisabledBedrockInferenceAdapter();
    const result1 = await adapter.infer({ workspaceId: 'workspace-a', targetTransactionId: 'tx-a' });
    const result2 = await adapter.infer({ workspaceId: 'workspace-b', targetTransactionId: 'tx-b' });

    expect(result1).toEqual({ abstained: true, reason: 'PROVIDER_DISABLED' });
    expect(result2).toEqual({ abstained: true, reason: 'PROVIDER_DISABLED' });
  });

  it('does not echo workspaceId or targetTransactionId in the result', async () => {
    const adapter = new DisabledBedrockInferenceAdapter();
    const result = await adapter.infer(identity);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('workspace-1');
    expect(serialized).not.toContain('transaction-1');
  });

  it('does not echo arbitrary input values in serialized output', async () => {
    const sentinel = 'phase5-disabled-adapter-sentinel';
    const adapter = new DisabledBedrockInferenceAdapter();
    const result = await adapter.infer({
      workspaceId: sentinel,
      targetTransactionId: sentinel,
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(sentinel);
  });

  it('never calls globalThis.fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const adapter = new DisabledBedrockInferenceAdapter();
      await adapter.infer(identity);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('has no mutable call history or provider client state', () => {
    const adapter = new DisabledBedrockInferenceAdapter();
    const keys = Object.keys(adapter);
    expect(keys).toHaveLength(0);
  });

  describe('TypeScript compile-time contract assertions', () => {
    it('a valid identity with both fields satisfies the interface at runtime', async () => {
      const adapter: InferenceAdapter = new DisabledBedrockInferenceAdapter();
      const validIdentity: InferenceInvocationIdentity = {
        workspaceId: 'workspace-compile',
        targetTransactionId: 'transaction-compile',
      };
      const result: ProviderDisabledInferenceResult = await adapter.infer(validIdentity);
      expect(result.abstained).toBe(true);
      expect(result.reason).toBe('PROVIDER_DISABLED');
    });

    it('assertInvocationIdentityTypeContract is a side-effect-free function reference', () => {
      expect(typeof assertInvocationIdentityTypeContract).toBe('function');
    });
  });

  describe('Structural safety checks', () => {
    it('the adapter source file contains none of the prohibited terms', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'server/services/bedrockInferenceAdapter.ts'),
        'utf8',
      );

      expect(source).not.toContain('process.env');
      expect(source).not.toContain('@aws-sdk');
      expect(source).not.toContain('aws-sdk');
      expect(source).not.toContain('fetch(');
      expect(source).not.toMatch(/\bhttp\b/);
      expect(source).not.toMatch(/\bhttps\b/);
      expect(source).not.toContain('axios');
      expect(source).not.toMatch(/\bprisma\b/i);
    });

    it('no existing source file imports bedrockInferenceAdapter', () => {
      const projectRoot = process.cwd();
      const dirsToSearch = ['server', 'src', 'lib'];
      const adapterBasename = 'bedrockInferenceAdapter';

      for (const dir of dirsToSearch) {
        const dirPath = path.join(projectRoot, dir);
        if (!fs.existsSync(dirPath)) continue;
        const files = collectTsFiles(dirPath);
        for (const file of files) {
          if (file.endsWith('bedrockInferenceAdapter.ts')) continue;
          const content = fs.readFileSync(file, 'utf8');
          expect(content, `${file} must not import ${adapterBasename}`).not.toContain(adapterBasename);
        }
      }
    });
  });
});

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}
