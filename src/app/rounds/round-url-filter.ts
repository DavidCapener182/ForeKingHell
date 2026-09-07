"use client";
import { useSearchParams } from "next/navigation";
export function useRoundUrlFilter<T extends string>(key: string, fallback: T) {
  const params = useSearchParams();
  const value = (params.get(key) ?? fallback) as T;
  const setValue = (next: T | ((current: T) => T)) => {
    const url = new URL(window.location.href);
    const result =
      typeof next === "function" ? next((url.searchParams.get(key) ?? fallback) as T) : next;
    if (result === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, result);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  return [value, setValue] as const;
}
