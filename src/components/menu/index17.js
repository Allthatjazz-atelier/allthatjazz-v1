"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import AboutSection7 from "../about/index7";
import NavAndClock from "../navigation/NavAndClock";

export default function HeaderFooter17({ children, heroMode }) {
  const [modalState, setModalState] = useState("closed");

  // ── Contrato de escena activa ─────────────────────────────────────────────
  // Como shell persistente (getLayout), HeaderFooter17 sobrevive al cambio de
  // ruta y los hijos (la escena) se intercambian debajo. Cada ruta declara su
  // `heroMode` ("final" | "ring" | "space") para que otras capas (p. ej.
  // RouteTransition) sepan qué canvas de escena está activo.
  useEffect(() => {
    if (!heroMode || typeof document === "undefined") return;
    document.documentElement.dataset.atjHeroMode = heroMode;
  }, [heroMode]);

  const h1Ref        = useRef(null);
  const blurLayerRef = useRef(null);
  const contentRef   = useRef(null);
  const animRef      = useRef(false);
  const breathRef    = useRef(null);
  const hoveredRef   = useRef(false);
  const svgStateRef  = useRef({ scale: 0, blur: 0, glow: 0, freq: 0.008 });
  const mainTweenRef = useRef(null);
  const mobileTimerRef = useRef(null);
  // Flag para saber si pulseMobile está corriendo — applyHover(false) lo respeta
  const mobileActiveRef = useRef(false);

  // ── Helper SVG update ────────────────────────────────────────────────────
  const getSvgEls = () => ({
    turb: document.getElementById("atj-turb"),
    disp: document.getElementById("atj-disp"),
    blur: document.getElementById("atj-blur"),
    glow: document.getElementById("atj-glow"),
    el:   h1Ref.current,
  });

  const makeUpdate = (els, s) => () => {
    els.disp.setAttribute("scale",         s.scale.toFixed(3));
    els.blur.setAttribute("stdDeviation",  s.blur.toFixed(3));
    els.glow.setAttribute("stdDeviation",  s.glow.toFixed(3));
    els.turb.setAttribute("baseFrequency", `${s.freq.toFixed(4)} ${(s.freq * 1.6).toFixed(4)}`);
  };

  // ── Desktop hover ────────────────────────────────────────────────────────
  const applyHover = useCallback((on) => {
    if (animRef.current) return;
    // En móvil con pulso activo, no interferir
    if (mobileActiveRef.current) return;

    hoveredRef.current = on;
    const els = getSvgEls();
    if (!els.turb || !els.disp || !els.blur || !els.glow || !els.el) return;

    if (mainTweenRef.current) { mainTweenRef.current.kill(); mainTweenRef.current = null; }
    if (breathRef.current)    { breathRef.current.kill();    breathRef.current    = null; }

    const s = svgStateRef.current;
    const update = makeUpdate(els, s);

    if (on) {
      els.el.style.filter = "url(#atj-filter)";
      mainTweenRef.current = gsap.to(s, {
        scale: 9, blur: 0.45, glow: 3.5, freq: 0.012,
        duration: 1.1, ease: "sine.out",
        onUpdate: update,
        onComplete() {
          if (!hoveredRef.current) return;
          breathRef.current = gsap.to(s, {
            scale: 7, glow: 2, freq: 0.008,
            duration: 2.8, ease: "sine.inOut",
            yoyo: true, repeat: -1,
            onUpdate: update,
          });
        },
      });
    } else {
      mainTweenRef.current = gsap.to(s, {
        scale: 0, blur: 0, glow: 0, freq: 0.008,
        duration: 0.5, ease: "sine.inOut",
        onUpdate: update,
        onComplete() {
          if (hoveredRef.current) return;
          els.el.style.filter = "none";
          s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
          update();
        },
      });
    }
  }, []);

  // ── Móvil: pulso de 3s — independiente del modal ─────────────────────────
  const pulseMobile = useCallback(() => {
    const els = getSvgEls();
    if (!els.turb || !els.disp || !els.blur || !els.glow || !els.el) return;

    // Reiniciar timer si ya había uno — cada toque reinicia los 3s
    if (mobileTimerRef.current) clearTimeout(mobileTimerRef.current);
    if (mainTweenRef.current)   { mainTweenRef.current.kill(); mainTweenRef.current = null; }
    if (breathRef.current)      { breathRef.current.kill();    breathRef.current    = null; }

    mobileActiveRef.current = true;

    const s = svgStateRef.current;
    s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
    els.el.style.filter = "url(#atj-filter)";

    const update = makeUpdate(els, s);

    // Entrada
    mainTweenRef.current = gsap.to(s, {
      scale: 10, blur: 0.5, glow: 4, freq: 0.013,
      duration: 0.9, ease: "sine.out",
      onUpdate: update,
      onComplete() {
        // Respiración continua mientras dura el timer
        breathRef.current = gsap.to(s, {
          scale: 6, glow: 2, freq: 0.009,
          duration: 1.2, ease: "sine.inOut",
          yoyo: true, repeat: -1,
          onUpdate: update,
        });
      },
    });

    // Salida después de 3s
    mobileTimerRef.current = setTimeout(() => {
      if (breathRef.current)  { breathRef.current.kill();  breathRef.current  = null; }
      if (mainTweenRef.current) { mainTweenRef.current.kill(); mainTweenRef.current = null; }
      gsap.to(s, {
        scale: 0, blur: 0, glow: 0, freq: 0.008,
        duration: 0.7, ease: "sine.inOut",
        onUpdate: update,
        onComplete() {
          els.el.style.filter = "none";
          s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
          update();
          mobileActiveRef.current = false;
        },
      });
    }, 3000);
  }, []);

  // ── Visibilidad ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) applyHover(false); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [applyHover]);

  // ── Scramble ──────────────────────────────────────────────────────────────
  // Se repite hasta que la primera pieza puede verse (`atj:content-ready`).
  // Un tope evita quedarse en bucle si esa señal no llega.
  const words = ["allthatjazz","すべてのジャズ","όλοαυτότζαζ","वह सभी जाज है","allthatjazz"];
  useEffect(() => {
    if (!h1Ref.current) return;
    const el    = h1Ref.current;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789あいうえお漢字العربيةРусскийΑλφάβητοไทย";
    const rand  = () => chars[Math.floor(Math.random() * chars.length)];
    let intervalId = 0;
    let stopped = false;
    let ready = false;
    const onReady = () => { ready = true; };
    window.addEventListener("atj:content-ready", onReady);
    const cap = setTimeout(onReady, 12000);
    const scramble = (word) => new Promise(res => {
      const letters = word.split(""), out = Array(letters.length).fill(""); let it = 0;
      intervalId = setInterval(() => {
        it++;
        for (let i = 0; i < letters.length; i++) out[i] = it < 7 ? rand() : letters[i];
        el.textContent = out.join("");
        if (it >= 15 || stopped) { clearInterval(intervalId); res(); }
      }, 40);
    });
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      el.textContent = "allthatjazz";
      await pause(800);
      if (stopped) return;

      // Activar efecto SVG durante el scramble
      hoveredRef.current = true;
      const turbS = document.getElementById("atj-turb");
      const dispS = document.getElementById("atj-disp");
      const blurS = document.getElementById("atj-blur");
      const glowS = document.getElementById("atj-glow");
      if (turbS && dispS && blurS && glowS) {
        el.style.filter = "url(#atj-filter)";
        const s = svgStateRef.current;
        s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
        const upd = () => {
          dispS.setAttribute("scale",         s.scale.toFixed(3));
          blurS.setAttribute("stdDeviation",  s.blur.toFixed(3));
          glowS.setAttribute("stdDeviation",  s.glow.toFixed(3));
          turbS.setAttribute("baseFrequency", `${s.freq.toFixed(4)} ${(s.freq * 1.6).toFixed(4)}`);
        };
        // Entrada suave
        mainTweenRef.current = gsap.to(s, {
          scale: 9, blur: 0.45, glow: 3.5, freq: 0.012,
          duration: 1.1, ease: "sine.out",
          onUpdate: upd,
          onComplete() {
            // Respiración continua durante el scramble
            breathRef.current = gsap.to(s, {
              scale: 7, glow: 2, freq: 0.008,
              duration: 2.8, ease: "sine.inOut",
              yoyo: true, repeat: -1, onUpdate: upd,
            });
          },
        });
      }

      while (!stopped && !ready) {
        for (const w of words) {
          if (stopped || ready) break;
          await scramble(w);
          if (stopped || ready) break;
          await pause(500);
        }
      }
      if (stopped) return;
      el.textContent = "allthatjazz";

      // Apagar efecto al terminar el scramble
      hoveredRef.current = false;
      if (breathRef.current)    { breathRef.current.kill();    breathRef.current    = null; }
      if (mainTweenRef.current) { mainTweenRef.current.kill(); mainTweenRef.current = null; }
      const turbE = document.getElementById("atj-turb");
      const dispE = document.getElementById("atj-disp");
      const blurE = document.getElementById("atj-blur");
      const glowE = document.getElementById("atj-glow");
      if (turbE && dispE && blurE && glowE) {
        const s = svgStateRef.current;
        const upd = () => {
          dispE.setAttribute("scale",         s.scale.toFixed(3));
          blurE.setAttribute("stdDeviation",  s.blur.toFixed(3));
          glowE.setAttribute("stdDeviation",  s.glow.toFixed(3));
          turbE.setAttribute("baseFrequency", `${s.freq.toFixed(4)} ${(s.freq * 1.6).toFixed(4)}`);
        };
        gsap.to(s, {
          scale: 0, blur: 0, glow: 0, freq: 0.008,
          duration: 0.7, ease: "sine.inOut",
          onUpdate: upd,
          onComplete() {
            el.style.filter = "none";
            s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
            upd();
          },
        });
      }
    })();
    return () => {
      stopped = true;
      clearInterval(intervalId);
      clearTimeout(cap);
      window.removeEventListener("atj:content-ready", onReady);
    };
  }, []);

  // ── Handlers modal — NO llaman applyHover(false) para no interferir con móvil
  const handleOpen  = useCallback(() => {
    if (modalState !== "closed" || animRef.current) return;
    // Solo limpiar hover en desktop (móvil usa mobileActiveRef para protegerse)
    if (!mobileActiveRef.current) applyHover(false);
    setModalState("opening");
  }, [modalState, applyHover]);

  const handleClose = useCallback(() => {
    if (modalState !== "open" || animRef.current) return;
    if (!mobileActiveRef.current) applyHover(false);
    setModalState("closing");
  }, [modalState, applyHover]);

  // ── Transiciones: fade directo del manto, sin captura WebGL ni burbuja ────
  useEffect(() => {
    const layers = [blurLayerRef.current, contentRef.current].filter(Boolean);

    if (modalState === "opening") {
      animRef.current = true;
      if (!layers.length) {
        animRef.current = false;
        setModalState("open");
        return;
      }
      gsap.set(layers, { opacity: 0 });
      const tween = gsap.to(layers, {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
        onComplete() {
          animRef.current = false;
          setModalState("open");
        },
      });
      return () => tween.kill();
    }

    if (modalState === "closing") {
      animRef.current = true;
      if (!layers.length) {
        animRef.current = false;
        setModalState("closed");
        return;
      }
      const tween = gsap.to(layers, {
        opacity: 0,
        duration: 0.35,
        ease: "power2.in",
        onComplete() {
          animRef.current = false;
          setModalState("closed");
        },
      });
      return () => tween.kill();
    }
  }, [modalState]);

  const isVisible   = modalState !== "closed";
  const showContent = modalState === "opening" || modalState === "open" || modalState === "closing";

  return (
    <>
      <div className="fixed top-0 left-0 w-full flex justify-center pt-[16px] z-[9999] pointer-events-none">
        <NavAndClock />
      </div>

      <div className="fixed bottom-0 left-0 w-full flex flex-col justify-center items-center pb-2 leading-[2.75rem] z-[9999] HeaderFooter select-none pointer-events-auto">

        <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
          <defs>
            <filter id="atj-filter" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence id="atj-turb" type="fractalNoise" baseFrequency="0.008 0.013" numOctaves="2" seed="4" result="noise" />
              <feDisplacementMap id="atj-disp" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur id="atj-blur" in="displaced" stdDeviation="0" result="blurred" />
              <feGaussianBlur id="atj-glow" in="displaced" stdDeviation="0" result="glow-raw" />
              <feColorMatrix id="atj-glow-matrix" in="glow-raw" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -3" result="glow-boosted" />
              <feMerge result="final">
                <feMergeNode in="glow-boosted" />
                <feMergeNode in="blurred" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        <div className="flex">
          <h1
            ref={h1Ref}
            className="text-[4rem] tracking-[-0.04em] text-black select-none whitespace-nowrap cursor-pointer"
            onMouseEnter={() => applyHover(true)}
            onMouseLeave={() => applyHover(false)}
            onClick={() => {
              const isTouch = window.matchMedia("(pointer: coarse)").matches;
              if (isTouch) {
                // Móvil: siempre lanzar pulso — independiente del modal
                pulseMobile();
              } else {
                // Desktop: limpiar hover
                applyHover(false);
              }
              // Abrir/cerrar modal en ambos casos
              (isVisible ? handleClose : handleOpen)();
            }}
          >
            allthatjazz
          </h1>
        </div>

        <p className="flex text-[1.35rem] text-black MyFont2 tracking-[-0.05em] pointer-none">
          Atelier de création graphique et digitale.
        </p>
      </div>

      <div id="main-content" className="w-full h-full">{children}</div>

      {isVisible && (
        <>
          <div
            ref={blurLayerRef}
            className="fixed inset-0 z-[1000]"
            style={{
              backgroundColor:      "rgba(255, 255, 255, 0.15)",
              backdropFilter:       "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              opacity:              0,
              transform:            "translateZ(0)",
              WebkitTransform:      "translateZ(0)",
            }}
          />
          {showContent && (
            <div
              ref={contentRef}
              className="fixed inset-0 z-[1001] overflow-y-auto text-white mix-blend-difference"
              style={{ opacity: 0 }}
              onClick={handleClose}
            >
              <AboutSection7 skipReveal />
            </div>
          )}
        </>
      )}
    </>
  );
}
