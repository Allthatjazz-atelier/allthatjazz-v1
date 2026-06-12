"use client";

import { useEffect, useRef } from "react";
import Router from "next/router";
import gsap from "gsap";

/**
 * Transición de ruta por captura ("capture-and-blit" ligera).
 *
 * Patrón (sin abrir un nuevo contexto WebGL):
 *   1. En `routeChangeStart` congelamos la escena saliente: rasterizamos su canvas
 *      WebGL a un <canvas> 2D sobre fondo blanco (igual que el About — evita que
 *      zonas alpha=0 dejen pasar negro) y lo mostramos a pantalla completa.
 *   2. La ruta cambia por debajo del overlay: la escena saliente se desmonta y la
 *      entrante monta + carga su media sin que se vea el hueco.
 *   3. Cuando la escena entrante está lista, desvanecemos el overlay con blur.
 *
 * El overlay vive POR DEBAJO del menú/footer (z 9999) para que la chrome
 * "allthatjazz" + reloj sigan visibles durante el morph (shell persistente).
 *
 * Lectura de "listo": escuchamos un evento opcional `atj-scene-ready` que cada
 * escena puede emitir cuando pinta su primer frame real; si no llega, revelamos
 * igualmente al alcanzar MAX_WAIT. Así funciona hoy y mejora solo si más adelante
 * cableas el evento en las escenas (paso 2b).
 */

// Canvas de escena conocidos (mismo contrato que getHeroCaptureCanvas en el menú).
const SCENE_CANVAS_SELECTORS = [
  "[data-aqua-canvas='true']",
  "[data-ring-canvas='true']",
  "[data-space3d-canvas='true']",
];

const MIN_HOLD = 220; // ms mínimos mostrando el frame congelado (evita un flash instantáneo)
const MAX_WAIT = 850; // ms máximos antes de revelar aunque no llegue atj-scene-ready
const REVEAL_DURATION = 0.7;

function findSceneCanvas() {
  for (const sel of SCENE_CANVAS_SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.width > 0 && el.height > 0) return el;
  }
  return null;
}

export default function RouteTransition() {
  const overlayRef = useRef(null);
  const activeRef = useRef(false);
  const cleanupRevealRef = useRef(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");

    // Congela la escena saliente dibujándola sobre blanco.
    const freezeOutgoing = () => {
      const src = findSceneCanvas();
      if (!src) return false;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      overlay.width = Math.round(w * dpr);
      overlay.height = Math.round(h * dpr);
      overlay.style.width = `${w}px`;
      overlay.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      try {
        ctx.drawImage(src, 0, 0, w, h);
      } catch {
        return false;
      }
      return true;
    };

    const hideOverlay = () => {
      activeRef.current = false;
      gsap.set(overlay, { display: "none", opacity: 0, filter: "blur(0px)" });
    };

    const startReveal = () => {
      // Limpia un reveal anterior si lo hubiera.
      if (cleanupRevealRef.current) cleanupRevealRef.current();

      const startedAt = performance.now();
      let revealed = false;
      let maxTimer = 0;

      const doReveal = () => {
        if (revealed) return;
        revealed = true;
        window.removeEventListener("atj-scene-ready", onReady);
        clearTimeout(maxTimer);
        cleanupRevealRef.current = null;

        // Dos RAF para asegurar que la escena entrante ya pintó al menos un frame.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            gsap.killTweensOf(overlay);
            gsap.to(overlay, {
              opacity: 0,
              filter: "blur(16px)",
              duration: REVEAL_DURATION,
              ease: "power2.inOut",
              onComplete: hideOverlay,
            });
          });
        });
      };

      const onReady = () => {
        const elapsed = performance.now() - startedAt;
        const wait = Math.max(0, MIN_HOLD - elapsed);
        setTimeout(doReveal, wait);
      };

      window.addEventListener("atj-scene-ready", onReady, { once: true });
      maxTimer = setTimeout(doReveal, MAX_WAIT);

      cleanupRevealRef.current = () => {
        window.removeEventListener("atj-scene-ready", onReady);
        clearTimeout(maxTimer);
      };
    };

    const onStart = () => {
      if (activeRef.current) return;
      if (!freezeOutgoing()) return; // sin escena que congelar → corte directo
      activeRef.current = true;
      gsap.killTweensOf(overlay);
      gsap.set(overlay, { display: "block", opacity: 1, filter: "blur(0px)" });
    };

    const onComplete = () => {
      if (!activeRef.current) return;
      startReveal();
    };

    const onError = () => {
      if (cleanupRevealRef.current) cleanupRevealRef.current();
      cleanupRevealRef.current = null;
      gsap.killTweensOf(overlay);
      hideOverlay();
    };

    // Suscripción ÚNICA al singleton Router (sus `events` son estables). Con deps []
    // el efecto NO se desmonta en cada navegación, así que los timers de revelado
    // programados en routeChangeComplete sobreviven hasta dispararse. (Con [router]
    // el cleanup se ejecutaba al completar la ruta y cancelaba el revelado → overlay
    // congelado para siempre.)
    Router.events.on("routeChangeStart", onStart);
    Router.events.on("routeChangeComplete", onComplete);
    Router.events.on("routeChangeError", onError);

    return () => {
      Router.events.off("routeChangeStart", onStart);
      Router.events.off("routeChangeComplete", onComplete);
      Router.events.off("routeChangeError", onError);
      if (cleanupRevealRef.current) cleanupRevealRef.current();
    };
  }, []);

  return (
    <canvas
      ref={overlayRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1300, // por encima de las escenas y del About, por debajo del menú (9999)
        pointerEvents: "none",
        display: "none",
        opacity: 0,
        willChange: "opacity, filter",
      }}
    />
  );
}
