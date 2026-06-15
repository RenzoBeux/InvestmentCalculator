import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Like useState, but the value is saved to localStorage and rehydrated on
 * reload. For objects a shallow merge with `initial` is performed, so that
 * adding new fields doesn't break a user's already-saved data.
 */
export function usePersistedState<T>(
  key: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      if (
        initial &&
        typeof initial === "object" &&
        !Array.isArray(initial) &&
        parsed &&
        typeof parsed === "object"
      ) {
        return { ...initial, ...parsed };
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable: continue without persisting */
    }
  }, [key, value]);

  return [value, setValue];
}
