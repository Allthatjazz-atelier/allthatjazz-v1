"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import AboutSection6 from "../about/index6";
import BerlinClock from "../tools/BerlinClock";

export default function HeaderFooter9({ children }) {
  const [isAboutOpen, setIsAboutOpen]     = useState(false);
  const [isMounted,   setIsMounted]       = useState(false); // controla el render del modal
  const [isAnimating, setIsAnimating]     = useState(false);

  const h1Ref    = useRef(null);
  const modalRef = useRef(null); // el div fixed del modal

  // ── Animación: abrir ──────────────────────────────────────────────
  const openModal = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsMounted(true);   // montar el DOM
    setIsAboutOpen(true);

    // Esperar un tick para que React monte el div antes de animarlo
    requestAnimationFrame(() => {
      const el = modalRef.current;
      if (!el) { setIsAnimating(false); return; }

      // Estado inicial: burbuja colapsada en el centro, contenido invisible
      gsap.set(el, {
        clipPath: "circle(0% at 50% 100%)", // nace desde el bottom-center (donde está el h1)
        opacity:  1,
        scale:    1,
      });
      gsap.set(el.children, { opacity: 0, scale: 0.94, filter: "blur(8px)" });

      const tl = gsap.timeline({ onComplete: () => setIsAnimating(false) });

      // 1. Burbuja se expande — mismo timing que el AquaSlider (power2.inOut, 1.2s)
      tl.to(el, {
        clipPath: "circle(160% at 50% 100%)",
        duration: 1.0,
        ease:     "power2.inOut",
      });

      // 2. Contenido aparece mientras la burbuja termina de crecer
      tl.to(el.children, {
        opacity:  1,
        scale:    1,
        filter:   "blur(0px)",
        duration: 0.55,
        ease:     "power2.out",
        stagger:  0.04,
      }, "-=0.4");
    });
  }, [isAnimating]);

  // ── Animación: cerrar ─────────────────────────────────────────────
  const closeModal = useCallback(() => {
    if (isAnimating) return;
    const el = modalRef.current;
    if (!el) return;
    setIsAnimating(true);

    const tl = gsap.timeline({
      onComplete: () => {
        setIsAboutOpen(false);
        setIsMounted(false);   // desmontar después de salir
        setIsAnimating(false);
      },
    });

    // 1. Contenido desaparece primero (lens collapse)
    tl.to(el.children, {
      opacity:  0,
      scale:    1.04,
      filter:   "blur(6px)",
      duration: 0.3,
      ease:     "power2.in",
      stagger:  0.02,
    });

    // 2. Burbuja se encoge de vuelta al origen
    tl.to(el, {
      clipPath: "circle(0% at 50% 100%)",
      duration: 0.75,
      ease:     "power2.inOut",
    }, "-=0.1");
  }, [isAnimating]);

  const toggleAbout = useCallback(() => {
    if (isAboutOpen) closeModal();
    else             openModal();
  }, [isAboutOpen, openModal, closeModal]);

  // ── Scramble ─────────────────────────────────────────────────────
  const words = [
    "allthatjazz",
    "すべてのジャズ",
    "όλοαυτότζαζ",
    "वह सभी जाज है",
    "allthatjazz",
  ];

  useEffect(() => {
    if (!h1Ref.current) return;
    const el = h1Ref.current;
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789あいうえお漢字العربيةРусскийΑλφάβητοไทย";
    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];

    const scrambleWord = (word) =>
      new Promise((resolve) => {
        const letters = word.split("");
        const output  = Array(letters.length).fill("");
        let iterations = 0;
        const maxIterations = 15;
        const interval = setInterval(() => {
          iterations++;
          for (let i = 0; i < letters.length; i++) {
            output[i] = iterations < maxIterations / 2 ? randomChar() : letters[i];
          }
          el.textContent = output.join("");
          if (iterations >= maxIterations) { clearInterval(interval); resolve(); }
        }, 40);
      });

    const runSequence = async () => {
      el.textContent = "allthatjazz";
      await new Promise((r) => setTimeout(r, 800));
      for (const word of words) {
        await scrambleWord(word);
        await new Promise((r) => setTimeout(r, 500));
      }
      el.textContent = "allthatjazz";
    };

    runSequence();
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Clock */}
      <div className="fixed top-0 left-0 w-full flex justify-center pt-[16px] z-[9999] pointer-events-none">
        <BerlinClock />
      </div>

      {/* Header / Footer */}
      <div className="fixed bottom-0 left-0 w-full flex flex-col justify-center items-center pb-2 leading-[2.75rem] z-[9999] HeaderFooter select-none pointer-events-auto">
        <div className="flex" onClick={toggleAbout}>
          <h1
            ref={h1Ref}
            className="text-[4rem] tracking-[-0.04em] text-black select-none whitespace-nowrap cursor-pointer"
          >
            allthatjazz
          </h1>
        </div>
        <p className="flex text-[1.35rem] text-black MyFont2 tracking-[-0.05em] pointer-none">
          Atelier de création graphique et digitale.
        </p>
      </div>

      {/* Contenido principal */}
      <div className="w-full h-full">{children}</div>

      {/* Modal About — montado sólo mientras isMounted, animado con clip-path */}
      {isMounted && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-[1000] overflow-y-auto text-white mix-blend-difference"
          style={{
            backgroundColor:    "rgba(255, 255, 255, 0.15)",
            backdropFilter:     "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            // clip-path animado por GSAP — valor inicial se sobreescribe en openModal
            clipPath: "circle(0% at 50% 100%)",
            willChange: "clip-path",
          }}
        >
          <AboutSection6 onClose={closeModal} />
        </div>
      )}
    </>
  );
}