"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import ATJ_Slider from "@/components/final-components/ATJ_Slider";
import ATJ_Grid from "@/components/final-components/ATJ_Grid";
import NewSpace3dFocus_2 from "@/components/final-components/NewSpace3dFocus_2";
import { useViewPrefs } from "@/components/final-components/viewPrefs";
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
 * pantalla de cada una.
 *
 * Rutas: solo dos. Slider y rejilla viven juntas en "/" y alternan por estado
 * (`homeView` en viewPrefs), no por navegación: su relevo es un morph DOM↔DOM de
 * dos fases (se recogen al fondo y florecen) que no cruza el router. La galaxia
 * es su propia ruta ("/space") por su contexto WebGL pesado, y su relevo con "/"
 * es un fundido.
 */

export const STAGE_VIEWS = { "/": "home", "/space": "galaxy" };

export const isStageRoute = (path) =>
  Object.prototype.hasOwnProperty.call(STAGE_VIEWS, path || "");

export default function ViewStage() {
  const router = useRouter();
  const { homeView } = useViewPrefs();
  const routeView = STAGE_VIEWS[router.pathname] ?? null;
  // "/" resuelve a slider o rejilla según el estado compartido; "/space" a
  // galaxia. Fuera de las rutas del escenario, nada.
  const view = routeView === "home" ? homeView : routeView;

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

  useEffect(() => {
    const from = prevView.current;
    if (!view || from === view) { setShown(view); return undefined; }

    prevView.current = view;

    // Slider ↔ rejilla: morph DOM↔DOM. Lo dispara el cambio de `homeView` (la
    // pastilla escribe el store), sin pasar por el router.
    if (isDomPair(from, view) && !prefersReduce()) {
      const key = `${from}>${view}`;
      sessionRef.current?.cancel();
      sessionRef.current = beginDomMorph(from, view);
      return () => {
        if (sessionRef.current?.key === key) {
          sessionRef.current.cancel();
          sessionRef.current = null;
        }
      };
    }

    // Hacia/desde galaxia: fundido (lo hace la opacidad de las capas).
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
          <NewSpace3dFocus_2 viewRef={galaxyRef} active={shown === "galaxy"} />
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
