import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Como useState, pero el valor se guarda en localStorage y se rehidrata al
 * recargar. Para objetos se hace un merge superficial con `initial`, así
 * agregar campos nuevos no rompe los datos ya guardados de un usuario.
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
      /* almacenamiento lleno o no disponible: seguimos sin persistir */
    }
  }, [key, value]);

  return [value, setValue];
}
