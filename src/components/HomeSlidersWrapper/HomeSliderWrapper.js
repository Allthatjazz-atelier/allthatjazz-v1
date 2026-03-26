"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import FinalSlider4 from "@/components/final/FinalSlider4";
import RingSlider4 from "@/components/ring/RingSLider4";

const STORAGE_KEY = "atj-home-slider-mode";

const HomeSliderContext = createContext(null);

export function useHomeSlider() {
  return useContext(HomeSliderContext);
}

function readStoredMode() {
  if (typeof window === "undefined") return "final";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "ring" || v === "final") return v;
  } catch {
    /* ignore */
  }
  return "final";
}

export function HomeSliderProvider({ children }) {
  const [mode, setModeState] = useState("final");

  useLayoutEffect(() => {
    setModeState(readStoredMode());
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === "final" ? "ring" : "final";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, toggleMode }),
    [mode, setMode, toggleMode]
  );

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.atjHeroMode = mode;
  }, [mode]);

  return (
    <HomeSliderContext.Provider value={value}>
      {children}
    </HomeSliderContext.Provider>
  );
}

/**
 * Apila FinalSlider4 y RingSlider4 a pantalla completa y anima el cambio con
 * opacidad + desenfoque (misma familia visual que un crossfade “shader-like”
 * sin capturar los canvas a texturas).
 */
export default function HomeSliderWrapper() {
  const ctx = useHomeSlider();
  const mode = ctx?.mode ?? "final";

  const finalWrapRef = useRef(null);
  const ringWrapRef = useRef(null);
  const mountedRef = useRef(false);
  const busy = useRef(false);

  useLayoutEffect(() => {
    const finalEl = finalWrapRef.current;
    const ringEl = ringWrapRef.current;
    if (!finalEl || !ringEl) return;

    const showFinal = mode === "final";

    if (!mountedRef.current) {
      mountedRef.current = true;
      gsap.set(finalEl, {
        opacity: showFinal ? 1 : 0,
        filter: "blur(0px)",
        zIndex: showFinal ? 10 : 4,
        pointerEvents: showFinal ? "auto" : "none",
      });
      gsap.set(ringEl, {
        opacity: showFinal ? 0 : 1,
        filter: "blur(0px)",
        zIndex: showFinal ? 4 : 10,
        pointerEvents: showFinal ? "none" : "auto",
      });
      return;
    }

    if (busy.current) return;
    busy.current = true;

    const outgoing = showFinal ? ringEl : finalEl;
    const incoming = showFinal ? finalEl : ringEl;

    gsap.set(incoming, { zIndex: 12 });
    gsap.set(outgoing, { zIndex: 8 });

    const tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      onComplete: () => {
        busy.current = false;
        gsap.set(outgoing, {
          pointerEvents: "none",
          zIndex: 4,
          filter: "blur(0px)",
        });
        gsap.set(incoming, {
          pointerEvents: "auto",
          zIndex: 10,
          filter: "blur(0px)",
        });
      },
    });

    tl.to(outgoing, { opacity: 0, filter: "blur(14px)", duration: 0.55 }, 0);
    tl.fromTo(
      incoming,
      { opacity: 0, filter: "blur(12px)" },
      { opacity: 1, filter: "blur(0px)", duration: 0.72 },
      0.08
    );
  }, [mode]);

  return (
    <div
      className="relative h-full w-full min-h-screen"
      aria-hidden={false}
    >
      <div
        ref={finalWrapRef}
        className="pointer-events-auto"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10,
          willChange: "opacity, filter",
        }}
      >
        <FinalSlider4 />
      </div>
      <div
        ref={ringWrapRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 4,
          pointerEvents: "none",
          willChange: "opacity, filter",
        }}
      >
        <RingSlider4 />
      </div>
    </div>
  );
}
