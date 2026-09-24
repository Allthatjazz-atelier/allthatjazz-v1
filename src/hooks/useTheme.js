/**
 * useTheme.js
 *
 * Fuente única del tema activo. Los valores de color viven en `globals.css`
 * (`:root` y `.dark`); aquí solo se decide cuál está puesto y se avisa a quien
 * no puede leer CSS por su cuenta —los shaders y los canvas 2D.
 *
 *   import { useTheme, readThemeColor, onThemeChange } from "@/hooks/useTheme";
 *
 *   const { theme, toggle } = useTheme();            // en React
 *   renderer.setClearColor(readThemeColor("--atj-bg"));
 *   const off = onThemeChange(({ theme }) => { ... }); // en escenas imperativas
 */

import { useCallback, useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "atj:theme";
export const THEME_EVENT = "atj:theme-change";

const normalize = (value) => (value === "dark" ? "dark" : "light");

export function getTheme() {
  if (typeof document === "undefined") return "light";
  return normalize(document.documentElement.dataset.atjTheme);
}

export function setTheme(next) {
  if (typeof document === "undefined") return "light";

  const theme = normalize(next);
  const root = document.documentElement;

  root.dataset.atjTheme = theme;
  root.classList.toggle("dark", theme === "dark");

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Modo privado o storage lleno: el tema sigue vivo en esta sesión.
  }

  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
  return theme;
}

export function toggleTheme() {
  return setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function onThemeChange(fn) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => fn(e.detail ?? { theme: getTheme() });
  window.addEventListener(THEME_EVENT, handler);
  return () => window.removeEventListener(THEME_EVENT, handler);
}

/**
 * Lee un token de color resuelto. El navegador ya ha aplicado la cascada
 * cuando `setTheme` vuelve, así que llamar aquí justo después del cambio
 * devuelve el valor nuevo.
 */
export function readThemeColor(token, fallback = "#ffffff") {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
}

export function useTheme() {
  const [theme, setThemeState] = useState("light");

  // El script de `_document` ya fijó la clase antes del primer paint; esto solo
  // sincroniza el estado de React sin provocar mismatch de hidratación.
  useEffect(() => {
    setThemeState(getTheme());
    return onThemeChange(({ theme: next }) => setThemeState(next));
  }, []);

  const set = useCallback((next) => setTheme(next), []);
  const toggle = useCallback(() => toggleTheme(), []);

  return { theme, setTheme: set, toggle };
}
