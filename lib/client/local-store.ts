"use client";

import { useSyncExternalStore } from "react";
import { read, write } from "./storage";

/**
 * A tiny localStorage-backed store usable with useSyncExternalStore. Snapshots are cached so
 * they stay referentially stable between writes, and other tabs stay in sync via "storage" events.
 */
export function createLocalStore<T>(key: string, fallback: T, normalize: (raw: unknown) => T = (r) => r as T) {
  let cache: { raw: string | null; value: T } | null = null;
  const listeners = new Set<() => void>();

  const rawNow = () => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  let memory: T | null = null; // used when storage is unavailable

  function get(): T {
    if (typeof window === "undefined") return fallback;
    const raw = rawNow();
    if (raw === null && memory !== null) return memory;
    if (cache && cache.raw === raw) return cache.value;
    const value = raw === null ? fallback : normalize(read<unknown>(key, fallback));
    cache = { raw, value };
    return value;
  }

  function set(next: T | ((prev: T) => T)) {
    const prev = get();
    const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    if (Object.is(value, prev)) return;
    write(key, value);
    memory = value;
    cache = null;
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, get, () => fallback);
  }

  return { get, set, subscribe, useValue };
}
