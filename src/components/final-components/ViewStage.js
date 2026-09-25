"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import ATJ_Slider from "@/components/final-components/ATJ_Slider";
import ATJ_Grid from "@/components/final-components/ATJ_Grid";
import NewSpace3dFocus_3 from "@/components/final-components/NewSpace3dFocus_3";
import {
  afterLayout,
  MORPH_MS,
  prefersReduce,
  runMorph,
  waitFor,
} from "@/components/final-components/morphSliderGrid";

/**
 * ViewStage — el escenario persistente.
 *
 * Se monta una sola vez en `_app`, fuera de `getLayout`, así que sobrevive a las
 * navegaciones: la ruta deja de crear y destruir las escenas y pasa a ser un
 * estado. La rejilla conserva su scroll, el slider su posición y la galaxia su
 * contexto WebGL mientras se salta de una a otra.
 *
 * Las tres vistas comparten la lista canónica de `@/data/pieces`, así que la
 * pieza N es la misma en todas y sus APIs (`viewRef`) publican el rectángulo en
 * pantalla de cada una. Slider ↔ rejilla es un morph de dos fases (se recogen
 * al fondo y florecen). Slider ↔ galaxia sigue en fundido.
 */

export const STAGE_VIEWS = { "/": "slider", "/space": "galaxy", "/grid": "grid" };

const MORPH_IN_MS = 1350;    // entrada: la tira se abre en galaxia
const MORPH_OUT_MS = 1050;   // salida: la galaxia se recoge en la tira

/**
 * Morph slider↔galaxia: apagado.
 *
 * Las piezas que viajan pasan por el atlas de la galaxia mientras dura la
 * transición, y con muchas piezas grandes a la vez el pool de texturas a
 * resolución completa no da para todas: se ve un bajón de nitidez en el tramo
 * intermedio. El relevo entre vistas es un fundido hasta que el morph sea
 * DOM↔DOM (slider↔rejilla), donde el problema no existe. El camino de código
 * sigue aquí y se enciende con esta constante.
 */
const ENABLE_GALAXY_MORPH = false;

export const isStageRoute = (path) =>
  Object.prototype.hasOwnProperty.call(STAGE_VIEWS, path || "");

export default function ViewStage() {
  const router = useRouter();
  const view = STAGE_VIEWS[router.pathname] ?? null;

  const sliderRef = useRef(null);
  const galaxyRef = useRef(null);
  const gridRef = useRef(null);
  const flyRef = useRef(null);

  // Solo cliente: el escenario no aporta nada al HTML del servidor y, si se
  // renderiza allí, cualquier desajuste de hidratación se queda pegado —React
  // no reparchea atributos— y las capas se quedan en un estado imposible.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Las vistas pesadas se montan la primera vez que se piden y ya no se vuelven
  // a montar. Fuera de las rutas del escenario no se monta nada: no queremos
  // dos contextos WebGL vivos (p. ej. en /ring).
  const [galaxyReady, setGalaxyReady] = useState(false);
  const [gridReady, setGridReady] = useState(false);

  useEffect(() => {
    if (view === "galaxy") setGalaxyReady(true);
    if (view === "grid") setGridReady(true);
    if (galaxyReady && gridReady) return undefined;
    // Si no, se precargan en cuanto el navegador está ocioso: la home no paga
    // su arranque, pero para cuando alguien pulsa la pastilla ya están listas.
    // La rejilla trae además la primera pantalla de miniaturas (~600 KB), que
    // es justo lo que hace que entrar en ella sea instantáneo.
    const warm = () => { setGalaxyReady(true); setGridReady(true); };
    if (typeof requestIdleCallback !== "function") {
      const t = setTimeout(warm, 2500);
      return () => clearTimeout(t);
    }
    const id = requestIdleCallback(warm, { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }, [view, galaxyReady, gridReady]);

  // `shown` es la capa que se ve, y puede ir por detrás de la ruta: en un morph
  // de salida esperamos a que las piezas lleguen a su destino antes de ceder la
  // capa. Si cambiáramos al llegar la ruta, se vería el salto.
  const [shown, setShown] = useState(view);
  const [instant, setInstant] = useState(false);
  const prevView = useRef(view);
  const sessionRef = useRef(null);
  const beginRef = useRef(null);

  const isDomPair = (a, b) =>
    (a === "slider" && b === "grid") || (a === "grid" && b === "slider");

  const beginDomMorph = (from, to) => {
    if (to === "grid") setGridReady(true);

    let cancelled = false;
    let handle = null;
    const srcRef = from === "slider" ? sliderRef : gridRef;
    const dstRef = to === "slider" ? sliderRef : gridRef;
    const key = `${from}>${to}`;

    const finish = () => {
      srcRef.current?.setGhost?.(false);
      dstRef.current?.setGhost?.(false);
      setInstant(false);
      if (sessionRef.current?.key === key) sessionRef.current = null;
    };

    const fallback = () => {
      if (cancelled) return;
      cancelled = true;
      handle?.kill();
      finish();
      setShown(to);
    };

    setInstant(true);

    (async () => {
      const ready = await waitFor(() => dstRef.current?.getFlyers && srcRef.current?.getFlyers);
      if (cancelled) return;
      if (!ready) { fallback(); return; }

      const active = srcRef.current.getActive?.();
      if (active && dstRef.current.goTo) {
        dstRef.current.goTo(active.index, { duration: 0, behavior: "auto" });
      }
      await afterLayout();
      if (cancelled) return;

      const fromFlyers = srcRef.current.getFlyers();
      const toFlyers = dstRef.current.getFlyers();
      if (!fromFlyers?.size && !toFlyers?.size) { fallback(); return; }

      srcRef.current.setGhost?.(true);
      dstRef.current.setGhost?.(true);
      setShown(to);

      handle = runMorph({
        fromFlyers,
        toFlyers,
        layer: flyRef.current,
        onComplete: () => {
          if (cancelled) return;
          cancelled = true;
          clearTimeout(guard);
          dstRef.current?.setGhost?.(false);
          requestAnimationFrame(() => {
            handle?.kill();
            srcRef.current?.setGhost?.(false);
            setInstant(false);
            if (sessionRef.current?.key === key) sessionRef.current = null;
          });
        },
      });
    })();

    const guard = setTimeout(fallback, MORPH_MS + 500);
    return {
      key,
      cancel() {
        cancelled = true;
        clearTimeout(guard);
        handle?.kill();
        finish();
      },
    };
  };
  beginRef.current = beginDomMorph;

  // La pastilla dispara el morph al click, 620 ms antes del router.push.
  useEffect(() => {
    const onWill = (e) => {
      const href = (e.detail?.href || "").replace(/\/$/, "") || "/";
      const next = STAGE_VIEWS[href];
      if (next === "grid") setGridReady(true);
      if (next === "galaxy") setGalaxyReady(true);
      const from = prevView.current;
      if (!isDomPair(from, next) || prefersReduce()) return;
      if (sessionRef.current?.key === `${from}>${next}`) return;
      sessionRef.current?.cancel();
      prevView.current = next;
      sessionRef.current = beginRef.current(from, next);
    };
    window.addEventListener("atj:view-will-change", onWill);
    return () => window.removeEventListener("atj:view-will-change", onWill);
  }, []);

  useEffect(() => {
    const from = prevView.current;
    if (!view || from === view) { setShown(view); return undefined; }

    // Slider ↔ rejilla ya puede ir en marcha (click de la pastilla).
    const key = `${from}>${view}`;
    if (sessionRef.current?.key === key) {
      prevView.current = view;
      return undefined;
    }

    prevView.current = view;

    if (isDomPair(from, view) && !prefersReduce()) {
      sessionRef.current?.cancel();
      sessionRef.current = beginDomMorph(from, view);
      return () => {
        if (sessionRef.current?.key === key) {
          sessionRef.current.cancel();
          sessionRef.current = null;
        }
      };
    }

    if (ENABLE_GALAXY_MORPH) {
      const galaxy = galaxyRef.current;
      const slider = sliderRef.current;
      const rects = slider?.getRects?.();

      // Galaxia → slider: la galaxia lleva las piezas a los rectángulos del
      // slider y solo entonces se cambia de capa.
      if (from === "galaxy" && view === "slider" && galaxy?.morphOut && rects?.size) {
        let cancelled = false;
        setInstant(true);
        const done = () => {
          if (cancelled) return;
          cancelled = true;
          setShown("slider");
          setInstant(false);
        };
        // Carrera contra un plazo: la promesa depende del tween, y el tween del
        // rAF. Con la pestaña de fondo el reloj se para y la vista se quedaría
        // colgada en la galaxia con la ruta ya en el slider.
        const guard = setTimeout(done, MORPH_OUT_MS + 400);
        galaxy.morphOut(rects, MORPH_OUT_MS / 1000).then(() => {
          clearTimeout(guard);
          done();
        });
        return () => { cancelled = true; clearTimeout(guard); };
      }

      // Slider → galaxia: se cede la capa ya, y la galaxia continúa el
      // movimiento desde donde el slider lo dejó.
      if (from === "slider" && view === "galaxy" && galaxy?.morphIn && rects?.size) {
        setInstant(true);
        setShown("galaxy");
        galaxy.morphIn(rects, MORPH_IN_MS / 1000);
        const t = setTimeout(() => setInstant(false), MORPH_IN_MS + 300);
        return () => clearTimeout(t);
      }
    }

    setShown(view);
    return undefined;
  }, [view]);

  if (!mounted || !view) return null;

  return (
    <div className="stage" data-instant={instant ? "true" : "false"}>
      {/* Las capas se renderizan siempre y lo condicional es su contenido:
          insertar una capa hermana hacía que React dejara de actualizar el
          `data-on` de la otra, y las dos se quedaban encendidas. */}
      <div className="stage__layer" data-on={shown === "slider" ? "true" : "false"}>
        <ATJ_Slider viewRef={sliderRef} active={shown === "slider" && !instant} />
      </div>

      <div className="stage__layer" data-on={shown === "galaxy" ? "true" : "false"}>
        {galaxyReady && (
          <NewSpace3dFocus_3 viewRef={galaxyRef} active={shown === "galaxy"} />
        )}
      </div>

      <div className="stage__layer" data-on={shown === "grid" ? "true" : "false"}>
        {gridReady && <ATJ_Grid viewRef={gridRef} active={shown === "grid" && !instant} />}
      </div>

      <div className="stage__fly" ref={flyRef} aria-hidden="true" />

      <style>{`
        .stage {
          position: fixed;
          inset: 0;
          z-index: 0;
        }
        /* La capa inactiva se queda montada y medible —un morph necesita leer
           sus rectángulos— pero sin pintar ni recibir clics. */
        .stage__layer {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 320ms ease;
        }
        .stage__layer[data-on="true"] {
          opacity: 1;
          pointer-events: auto;
        }
        /* En un morph el relevo es instantáneo: la pieza ya viaja dentro de la
           vista de destino, y un fundido la dibujaría dos veces. */
        .stage[data-instant="true"] .stage__layer { transition: none; }
        .stage[data-instant="true"] { pointer-events: none; }

        .stage__fly {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }
        .stage__flyer {
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          object-fit: cover;
          will-change: transform, opacity;
          backface-visibility: hidden;
          pointer-events: none;
          user-select: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .stage__layer { transition: none; }
        }
      `}</style>
    </div>
  );
}
