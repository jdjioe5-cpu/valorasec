import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/lib/hooks/use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should not update debounced value before delay elapsed', () => {
    const { result, rerender } = renderHook(({ val, delay }) => useDebounce(val, delay), {
      initialProps: { val: 'first', delay: 300 },
    });

    rerender({ val: 'second', delay: 300 });

    // Advance 100ms - should still be old value
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('first');

    // Advance another 100ms (total 200ms) - still old value
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('first');
  });

  it('should update debounced value after specified delay elapsed', () => {
    const { result, rerender } = renderHook(({ val, delay }) => useDebounce(val, delay), {
      initialProps: { val: 'first', delay: 300 },
    });

    rerender({ val: 'updated', delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid successive changes', () => {
    const { result, rerender } = renderHook(({ val, delay }) => useDebounce(val, delay), {
      initialProps: { val: 'a', delay: 300 },
    });

    rerender({ val: 'b', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Rapid change before 300ms
    rerender({ val: 'c', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Total 400ms passed since first change, but only 200ms since 'c'
    expect(result.current).toBe('a');

    // Complete the remaining 100ms for 'c'
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
  });

  it('should handle number and object types properly', () => {
    const obj1 = { count: 1 };
    const obj2 = { count: 2 };
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 200), {
      initialProps: { val: obj1 },
    });

    expect(result.current).toEqual({ count: 1 });

    rerender({ val: obj2 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toEqual({ count: 2 });
  });
});
