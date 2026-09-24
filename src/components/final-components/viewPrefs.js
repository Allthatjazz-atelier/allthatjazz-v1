"use client";

import { useSyncExternalStore } from "react";

/**
 * viewPrefs — preferencias de vista compartidas entre el escenario y el navbar.
 *
 * La densidad de la rejilla la fija el usuario desde las pills, que viven en el
 * navbar (dentro de `getLayout`), mientras que la rejilla vive en el escenario
 * (fuera). Son dos árboles de React hermanos: un contexto tendría que envolver
 * la aplicación entera y volver a renderizarla al cambiar de densidad. Un store
 * externo diminuto deja el cambio en los dos únicos componentes que lo miran.
 *
 * La escalera de columnas la publica la propia rejilla, que es quien conoce sus
 * puntos de ruptura: en escritorio es 12·8·6·3, pero en un móvil esas cifras no
 * significan nada y allí son 4·3·2. El navbar solo pinta lo que le digan.
 */

const DEFAULT_LADDER = [12, 8, 6, 3];
/** Nivel de arranque: 8 columnas, el segundo escalón. */
const DEFAULT_LEVEL = 1;

let snapshot = { level: DEFAULT_LEVEL, ladder: DEFAULT_LADDER };
const subscribers = new Set();

const emit = () => {
  subscribers.forEach((fn) => fn());
};

const subscribe = (fn) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

/** Nivel de densidad activo: 0 es el más denso. */
export const getDensityLevel = () => snapshot.level;

export const setDensityLevel = (next) => {
  const level = Math.max(0, Math.min(snapshot.ladder.length - 1, Number(next) || 0));
  if (level === snapshot.level) return;
  snapshot = { ...snapshot, level };
  emit();
};

/** La rejilla publica su escalera al montar y al cambiar de punto de ruptura. */
export const setDensityLadder = (ladder) => {
  if (!Array.isArray(ladder) || !ladder.length) return;
  if (ladder.length === snapshot.ladder.length && ladder.every((c, i) => c === snapshot.ladder[i])) return;
  // El nivel se conserva por posición: cambiar de punto de ruptura no debe
  // saltar de densidad, solo traducir 12·8·6·3 a lo que quepa en esa pantalla.
  snapshot = { ladder, level: Math.min(snapshot.level, ladder.length - 1) };
  emit();
};

/** Columnas que toca pintar ahora mismo. */
export const getColumns = () => snapshot.ladder[snapshot.level] ?? DEFAULT_LADDER[DEFAULT_LEVEL];

// El snapshot es el mismo objeto hasta que algo cambia: useSyncExternalStore
// compara por identidad y devolver un literal nuevo en cada lectura lo dejaría
// en bucle.
export const useViewPrefs = () =>
  useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
