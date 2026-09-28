"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import ATJ_Slider from "@/components/final-components/ATJ_Slider";
import ATJ_Grid from "@/components/final-components/ATJ_Grid";
import NewSpace3dFocus_2 from "@/components/final-components/NewSpace3dFocus_2";
import { useViewPrefs } from "@/components/final-components/viewPrefs";
import {
  afterLayout,
  beginMorph,
  MORPH_MS,
  prefersReduce,
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
  // Recogida ya arrancada en el click, a la espera de que el efecto de `view`
  // la reclame y le enganche el destino.
  const pendingRef = useRef(null);

  const isDomPair = (a, b) =>
    (a === "slider" && b === "grid") || (a === "grid" && b === "slider");

  // ── Pre-arranque: la mitad del gesto que ya se puede empezar ───────────────
  // La pastilla avisa ANTES de escribir el store, así que aquí el origen sigue
  // montado, medible y sin tocar, y estamos en el frame del dedo. Se mide y se
  // lanza la recogida ya; el destino —que es lo lento: montar la rejilla,
  // desplazarla a la pieza activa y volver a medir— se engancha después.
  // Mismo patrón que `atj:density-will-change` usa para el FLIP de densidad.
  useEffect(() => {
    const onWill = (e) => {
      const to = e.detail?.to === "grid" ? "grid" : e.detail?.to === "slider" ? "slider" : null;
      const from = prevView.current;
      if (!to || !isDomPair(from, to) || prefersReduce()) return;
      // Con un morph vivo o uno ya pre-arrancado, el relevo lo resuelve el
      // efecto (que sabe cancelar el anterior); adelantarse aquí dejaría dos
      // sesiones fantasma peleando por el mismo `ghost`.
      if (pendingRef.current || sessionRef.current) return;

      const src = (from === "slider" ? sliderRef : gridRef).current;
      if (!src?.getFlyers) return;
      if (to === "grid") setGridReady(true);

      const fromFlyers = src.getFlyers();
      if (!fromFlyers?.size) return;

      // La pieza activa se apunta ahora: después de esconder el origen, la
      // rejilla la busca midiendo cajas y el slider ya podría haberse movido.
      const active = src.getActive?.() || null;

      // Y el destino se alinea YA, en este mismo frame. Es trabajo adelantado,
      // pero sobre todo es lo que hace utilizable la pista: sus rectángulos
      // dicen qué piezas van a verse, y sin alinearlo primero dicen las que se
      // ven AHORA —otras— y la pista no sirve para nada.
      const dst = (to === "slider" ? sliderRef : gridRef).current;
      if (active && dst?.goTo) dst.goTo(active.index, { duration: 0, behavior: "auto" });

      const handle = beginMorph({
        fromFlyers,
        toHint: dst?.getFlyers?.() || null,
        layer: flyRef.current,
      });
      if (!handle) return;

      src.setGhost?.(true);
      setInstant(true);

      const key = `${from}>${to}`;
      // Red de seguridad por si el cambio de estado no llegara nunca (un
      // `setHomeView` que resulta ser un no-op): esto se quedaría volando sobre
      // un escenario escondido. Holgada a propósito —el efecto tarda un frame—
      // porque los dos fallos no cuestan lo mismo: quedarse corto aborta un
      // gesto bueno y se ve reiniciar, y el caso que cubre no llega por la
      // interfaz (las pastillas ya ignoran el click en la vista activa).
      const claim = setTimeout(() => {
        if (pendingRef.current?.key !== key) return;
        pendingRef.current = null;
        handle.kill();
        src.setGhost?.(false);
        setInstant(false);
      }, 800);

      pendingRef.current = { key, handle, fromFlyers, active, claim };
    };
    window.addEventListener("atj:view-will-change", onWill);
    return () => window.removeEventListener("atj:view-will-change", onWill);
  }, []);

  const beginDomMorph = (from, to, seed) => {
    if (to === "grid") setGridReady(true);

    let cancelled = false;
    const srcRef = from === "slider" ? sliderRef : gridRef;
    const dstRef = to === "slider" ? sliderRef : gridRef;
    const key = `${from}>${to}`;

    // La pastilla pudo arrancar ya la recogida. Si es así se continúa esa; si no
    // —cambio programático, o el aviso no llegó— se arranca aquí y lo único que
    // se pierde es la ventaja de haber empezado antes.
    const pre = pendingRef.current?.key === key ? pendingRef.current : null;
    if (pre) clearTimeout(pre.claim);
    pendingRef.current = null;
    let handle = pre?.handle || null;

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

      // Sin pre-arranque hay que medir el origen aquí — y antes de tocar el
      // destino, porque moverlo puede reflotar la maquetación de los dos. Si
      // venimos de un relevo en caliente, el origen son las piezas donde las
      // dejó el gesto anterior, no la vista.
      if (!handle) {
        const fromFlyers = seed?.fromFlyers || srcRef.current.getFlyers();
        if (!fromFlyers?.size) { fallback(); return; }
        handle = beginMorph({
          fromFlyers,
          toHint: dstRef.current.getFlyers?.() || null,
          layer: flyRef.current,
        });
        if (!handle) { fallback(); return; }
        srcRef.current.setGhost?.(true);
      }

      const active = pre?.active || srcRef.current.getActive?.();
      if (active && dstRef.current.goTo) {
        dstRef.current.goTo(active.index, { duration: 0, behavior: "auto" });
      }
      await afterLayout();
      if (cancelled) return;

      const toFlyers = dstRef.current.getFlyers();
      dstRef.current.setGhost?.(true);
      setShown(to);

      handle.land(toFlyers, () => {
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
      });
    })();

    const guard = setTimeout(fallback, MORPH_MS + 500);
    return {
      key,
      // Relevo en caliente: se fotografía lo que va en vuelo y se cede. A
      // diferencia de `cancel()`, aquí NO se levantan los fantasmas — eso es lo
      // que hace que no parpadee: el escenario sigue escondido y el gesto nuevo
      // recrea los clones exactamente donde estaban los viejos.
      handover() {
        if (cancelled) return null;
        const snap = handle?.snapshot?.();
        cancelled = true;
        clearTimeout(guard);
        handle?.kill();
        if (sessionRef.current?.key === key) sessionRef.current = null;
        return snap?.size ? { fromFlyers: snap } : null;
      },
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

    // Slider ↔ rejilla: morph DOM↔DOM, sin pasar por el router. Su recogida
    // suele venir ya lanzada desde el click (ver el pre-arranque de arriba);
    // aquí se le engancha el destino, o se hace el gesto entero si no la hubo.
    if (isDomPair(from, view) && !prefersReduce()) {
      const key = `${from}>${view}`;
      // Cambiar de idea a media transición no tira lo que hay volando: se hereda
      // donde está y el gesto nuevo sale de ahí. Antes se cancelaba —los clones
      // desaparecían, la vista de destino asomaba un instante y el morph
      // arrancaba de cero—, y ese parpadeo es justo lo que delata que son dos
      // animaciones y no una.
      const seed = sessionRef.current?.handover?.() || null;
      sessionRef.current?.cancel();
      sessionRef.current = beginDomMorph(from, view, seed);
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
