import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (class merging utility)', () => {
  it('returns a single class name unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('merges multiple class names', () => {
    expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2');
  });

  it('resolves Tailwind conflicts — later class wins', () => {
    // twMerge: p-4 wins over p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('resolves conflicting text colours', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles conditional classes via clsx', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active');
  });

  it('handles object syntax from clsx', () => {
    expect(cn({ 'font-bold': true, 'font-normal': false })).toBe('font-bold');
  });

  it('handles arrays from clsx', () => {
    expect(cn(['flex', 'gap-1'])).toBe('flex gap-1');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 0 as any, 'b')).toBe('a b');
  });

  it('returns empty string when no classes provided', () => {
    expect(cn()).toBe('');
  });

  it('handles className prop pattern', () => {
    const variant = 'destructive';
    expect(
      cn(
        'inline-flex items-center rounded',
        variant === 'destructive' ? 'bg-red-500 text-white' : 'bg-gray-200',
      )
    ).toBe('inline-flex items-center rounded bg-red-500 text-white');
  });
});
