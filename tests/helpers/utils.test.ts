import { describe, expect, it } from 'vitest';
import { cn } from '../../src/helpers/utils';

describe('shared UI helper utilities', () => {
  it('joins plain and conditional class names', () => {
    expect(cn('rounded-xl', false && 'hidden', null, undefined, { 'bg-white': true, 'text-red-500': false })).toBe('rounded-xl bg-white');
  });

  it('resolves conflicting Tailwind classes with the latest class winning', () => {
    expect(cn('px-2 py-2 text-sm', 'px-4 text-lg')).toBe('py-2 px-4 text-lg');
  });
});
