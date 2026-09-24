"use client";

import { useEffect, useRef } from "react";
import Router from "next/router";
import gsap from "gsap";
import { isStageRoute } from "@/components/final-components/ViewStage";

/**
 * Tapa de ruta sin readback WebGL.
 *
 * Antes: drawImage del canvas de escena a un <canvas> 2D a pantalla completa
 * (flush síncrono de GPU) + blur CSS. Eso clavaba el chrome (gooey/pills).
 *
 * Ahora: plano blanco que cubre el hueco unmount→mount. El menú (z 9999)
 * sigue encima. Revelamos cuando la escena dispara `atj-scene-ready`
 * o al alcanzar MAX_WAIT.
 */

const MIN_HOLD = 180;
const MAX_WAIT = 850;
const REVEAL_DURATION = 0.45;

export default function RouteTransition() {
  const overlayRef = useRef(null);
  const activeRef = useRef(false);
  const cleanupRevealRef = useRef(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const hideOverlay = () => {
      activeRef.current = false;
      gsap.set(overlay, { display: "none", opacity: 0 });
    };

    const startReveal = () => {
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

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            gsap.killTweensOf(overlay);
            gsap.to(overlay, {
              opacity: 0,
              duration: REVEAL_DURATION,
              ease: "power2.out",
              onComplete: hideOverlay,
            });
          });
        });
      };

      const onReady = () => {
        const elapsed = performance.now() - startedAt;
        setTimeout(doReveal, Math.max(0, MIN_HOLD - elapsed));
      };

      window.addEventListener("atj-scene-ready", onReady, { once: true });
      maxTimer = setTimeout(doReveal, MAX_WAIT);

      cleanupRevealRef.current = () => {
        window.removeEventListener("atj-scene-ready", onReady);
        clearTimeout(maxTimer);
      };
    };

    const onStart = (url) => {
      // Entre las rutas del escenario la escena no se desmonta: no hay hueco
      // que tapar, y el plano blanco se comería el fundido entre vistas.
      const to = (url || "").split("?")[0].replace(/\/$/, "") || "/";
      if (isStageRoute(Router.pathname) && isStageRoute(to)) return;
      if (activeRef.current) return;
      activeRef.current = true;
      gsap.killTweensOf(overlay);
      gsap.set(overlay, { display: "block", opacity: 1 });
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
    <div
      ref={overlayRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--atj-bg)",
        zIndex: 1300,
        pointerEvents: "none",
        display: "none",
        opacity: 0,
      }}
    />
  );
}
