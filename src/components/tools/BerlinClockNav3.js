"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

// ─── Datos del menú ────────────────────────────────────────────────────────────
// `href` apunta a cada ruta-escena. Galaxy = Space3D (/space).
const NAV_ITEMS = [
  { label: "Slider", href: "/" },
  { label: "Galaxy", href: "/space" },
  { label: "Ring",   href: "/ring" },
];

// ─── Tamaños ───────────────────────────────────────────────────────────────────
const STAR_SIZE  = 14;                 // tamaño del avatar (estrella)
const STAR_SCALE = STAR_SIZE / 13;     // el path nativo es 13×13

// ─── Path ✦ ────────────────────────────────────────────────────────────────────
// Path real del avatar `/public/avatar/✦.svg` — viewBox 13×13.
const STAR_PATH = "M5.824 12.288C5.70667 11.5947 5.39733 10.848 4.896 10.048C4.39467 9.23733 3.68 8.48533 2.752 7.792C1.83467 7.09867 0.917333 6.656 0 6.464V5.792C0.906667 5.57867 1.776 5.184 2.608 4.608C3.45067 4.02133 4.15467 3.31733 4.72 2.496C5.296 1.65333 5.664 0.821333 5.824 0H6.496C6.592 0.533333 6.784 1.08267 7.072 1.648C7.36 2.20267 7.728 2.736 8.176 3.248C8.63467 3.74933 9.14667 4.20267 9.712 4.608C10.5547 5.20533 11.4133 5.6 12.288 5.792V6.464C11.7013 6.58133 11.0933 6.82133 10.464 7.184C9.84533 7.54667 9.26933 7.97867 8.736 8.48C8.20267 8.97067 7.76533 9.488 7.424 10.032C6.92267 10.832 6.61333 11.584 6.496 12.288H5.824Z";

// Centro del bounding box del path en su propio sistema → transform-origin del giro.
const STAR_ORIGIN = "6.144 6.144";

// ─── Morph "allthatjazz" escalado al tamaño del link ─────────────────────────────
// El título original es 64px y usa { scale: 9, blur: 0.45, glow: 3.5, freq: 0.012 }.
// Aquí los links del pill son 18px (~0.28×). Para que el gesto se vea IGUAL en
// proporción (y no colapse en una mancha negra) escalamos displacement/blur/glow
// ×0.28 y la frecuencia de la turbulencia ÷0.28 (más densa sobre un glifo más
// pequeño). Los ratios de la respiración (pico→bucle) se conservan del original.
const MORPH_ON      = { scale: 2.5, blur: 0.13, glow: 1.0,  freq: 0.043 }; // pico de entrada
const MORPH_BREATH  = { scale: 1.9, glow: 0.55, freq: 0.028 };           // bucle yoyo
const MORPH_FREQ_0  = 0.028;                                             // freq en reposo

// ─── Componente ────────────────────────────────────────────────────────────────
export default function BerlinClockNav3() {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);
  const starRef      = useRef(null);
  const overlayRef   = useRef(null);
  const boxRef       = useRef(null);
  const linksRef     = useRef(null);
  const firstRunRef  = useRef(true);

  // ── Morph "allthatjazz" por link ───────────────────────────────────────────
  // Cada link tiene su propio filtro SVG (mismos params que `atj-filter` del
  // HeaderFooter) para poder morfar de forma independiente: el link de la vista
  // activa anima en bucle siempre, y cualquier link hovereado anima a la vez.
  const linkElsRef     = useRef([]);
  const morphStateRef  = useRef(NAV_ITEMS.map(() => ({ scale: 0, blur: 0, glow: 0, freq: MORPH_FREQ_0 })));
  const mainTweenRef   = useRef([]);
  const breathTweenRef = useRef([]);
  const morphStartRef  = useRef(null);

  // Ruta actual en un ref → el efecto de apertura la lee sin re-ejecutarse
  // cuando cambia el pathname (evita un giro extra de la estrella al navegar).
  const pathnameRef = useRef(router.pathname);
  pathnameRef.current = router.pathname;

  // ── Reloj Berlín ───────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      setTime(new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date()));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Prefetch de las rutas-escena ────────────────────────────────────────────
  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.href?.startsWith("/")) router.prefetch(item.href);
    });
  }, [router]);

  // ── Navegación a una vista ──────────────────────────────────────────────────
  const handleNavigate = useCallback(
    (href) => {
      setOpen(false);
      if (!href || href === router.pathname) return;
      router.push(href);
    },
    [router]
  );

  // ── Sync del filtro de un link con su estado animado ────────────────────────
  // Mismo mapeo de atributos que `makeUpdate` en HeaderFooter16.
  const updateMorph = useCallback((i) => {
    const s    = morphStateRef.current[i];
    const turb = document.getElementById(`bcn-turb-${i}`);
    const disp = document.getElementById(`bcn-disp-${i}`);
    const blur = document.getElementById(`bcn-blur-${i}`);
    const glow = document.getElementById(`bcn-glow-${i}`);
    if (!turb || !disp || !blur || !glow) return;
    disp.setAttribute("scale",         s.scale.toFixed(3));
    blur.setAttribute("stdDeviation",  s.blur.toFixed(3));
    glow.setAttribute("stdDeviation",  s.glow.toFixed(3));
    turb.setAttribute("baseFrequency", `${s.freq.toFixed(4)} ${(s.freq * 1.6).toFixed(4)}`);
  }, []);

  // ── Morph on/off de un link — copia exacta del hover de "allthatjazz" ───────
  // on  → entrada (scale 9 / 1.1s sine.out) + respiración en bucle (sine.inOut)
  // off → salida (scale 0 / 0.5s sine.inOut) y desactiva el filtro al acabar
  const morphLink = useCallback((i, on) => {
    const el = linkElsRef.current[i];
    if (!el || !document.getElementById(`bcn-disp-${i}`)) return;

    if (mainTweenRef.current[i])   { mainTweenRef.current[i].kill();   mainTweenRef.current[i]   = null; }
    if (breathTweenRef.current[i]) { breathTweenRef.current[i].kill(); breathTweenRef.current[i] = null; }

    const s = morphStateRef.current[i];
    const update = () => updateMorph(i);

    if (on) {
      el.style.filter = `url(#bcn-morph-${i})`;
      mainTweenRef.current[i] = gsap.to(s, {
        ...MORPH_ON,
        duration: 1.1, ease: "sine.out",
        onUpdate: update,
        onComplete() {
          breathTweenRef.current[i] = gsap.to(s, {
            ...MORPH_BREATH,
            duration: 2.8, ease: "sine.inOut",
            yoyo: true, repeat: -1,
            onUpdate: update,
          });
        },
      });
    } else {
      mainTweenRef.current[i] = gsap.to(s, {
        scale: 0, blur: 0, glow: 0, freq: MORPH_FREQ_0,
        duration: 0.5, ease: "sine.inOut",
        onUpdate: update,
        onComplete() {
          el.style.filter = "none";
          s.scale = 0; s.blur = 0; s.glow = 0; s.freq = MORPH_FREQ_0;
          update();
        },
      });
    }
  }, [updateMorph]);

  // ── Apaga el morph de todos los links (al cerrar el menú) ────────────────────
  const resetAllMorph = useCallback(() => {
    if (morphStartRef.current) { morphStartRef.current.kill(); morphStartRef.current = null; }
    NAV_ITEMS.forEach((_, i) => {
      if (mainTweenRef.current[i])   { mainTweenRef.current[i].kill();   mainTweenRef.current[i]   = null; }
      if (breathTweenRef.current[i]) { breathTweenRef.current[i].kill(); breathTweenRef.current[i] = null; }
      const s = morphStateRef.current[i];
      s.scale = 0; s.blur = 0; s.glow = 0; s.freq = MORPH_FREQ_0;
      updateMorph(i);
      const el = linkElsRef.current[i];
      if (el) el.style.filter = "none";
    });
  }, [updateMorph]);

  // ── Hover sobre cualquier link → mismo morph ────────────────────────────────
  const handleLinkEnter = useCallback((i) => {
    // Si ya está animando (p.ej. el link activo respirando) no reiniciamos.
    if (breathTweenRef.current[i] || mainTweenRef.current[i]?.isActive()) return;
    morphLink(i, true);
  }, [morphLink]);

  const handleLinkLeave = useCallback((i, isActive) => {
    // El link de la vista activa nunca se apaga.
    if (isActive) return;
    morphLink(i, false);
  }, [morphLink]);

  // ── Estado inicial (cerrado) ────────────────────────────────────────────────
  useGSAP(() => {
    gsap.set(starRef.current, { transformOrigin: STAR_ORIGIN, rotation: 0 });
    gsap.set(overlayRef.current, { autoAlpha: 0 });
    gsap.set(boxRef.current, { autoAlpha: 0, scale: 0.94, y: 10 });
    if (linksRef.current) {
      gsap.set(linksRef.current.children, { autoAlpha: 0, y: 12 });
    }
  }, { scope: containerRef });

  // ── Apertura / cierre ────────────────────────────────────────────────────────
  // Al abrir: la estrella da una vuelta completa (360°) y, en paralelo, el
  // recuadro de papel de calco aparece en el centro de la pantalla con un fade
  // + escala suave, y los links entran con stagger.
  useEffect(() => {
    // En el primer render no animamos (evita un giro fantasma al montar).
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    const links = linksRef.current ? linksRef.current.children : [];

    if (open) {
      // La estrella gira en sentido horario.
      gsap.to(starRef.current, {
        rotation: "+=360",
        duration: 0.9,
        ease: "expo.inOut",
        overwrite: "auto",
      });

      const tl = gsap.timeline();
      tl.to(overlayRef.current, { autoAlpha: 1, duration: 0.3, ease: "power1.out" }, 0)
        .to(boxRef.current, {
          autoAlpha: 1, scale: 1, y: 0,
          duration: 0.55, ease: "expo.out",
        }, 0.12)
        .to(links, {
          autoAlpha: 1, y: 0,
          duration: 0.4, stagger: 0.07, ease: "power3.out",
        }, 0.28);

      // El link de la vista activa empieza a morfar en bucle (sin hover),
      // sincronizado con la aparición de los links.
      const activeIndex = NAV_ITEMS.findIndex((it) => it.href === pathnameRef.current);
      if (activeIndex !== -1) {
        if (morphStartRef.current) morphStartRef.current.kill();
        morphStartRef.current = gsap.delayedCall(0.4, () => morphLink(activeIndex, true));
      }
    } else {
      // Al cerrar, la estrella gira en sentido contrario.
      gsap.to(starRef.current, {
        rotation: "-=360",
        duration: 0.7,
        ease: "expo.inOut",
        overwrite: "auto",
      });

      const tl = gsap.timeline();
      tl.to(links, {
        autoAlpha: 0, y: 8,
        duration: 0.2, stagger: 0.03, ease: "power1.in",
      }, 0)
        .to(boxRef.current, {
          autoAlpha: 0, scale: 0.96, y: 10,
          duration: 0.32, ease: "power2.in",
        }, 0.05)
        .to(overlayRef.current, { autoAlpha: 0, duration: 0.3, ease: "power1.in" }, 0.1);

      resetAllMorph();
    }
  }, [open, morphLink, resetAllMorph]);

  // ── Cierre con click fuera + Escape ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-1 text-[0.875rem] tracking-[-0.04em] text-black"
      style={{ pointerEvents: "auto" }}
    >
      {/* Berlin time — tabular-nums para que los dígitos no bailen */}
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        Berlin, {time}
      </span>

      {/* Estrella ✦ — botón toggle que gira al hacer click */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="bcn-menu"
        aria-label={open ? "Cerrar menú de vistas" : "Abrir menú de vistas"}
        className="inline-flex items-center justify-center cursor-pointer"
        style={{
          width: STAR_SIZE, height: STAR_SIZE,
          background: "transparent", border: 0, padding: 0,
          lineHeight: 0,
        }}
      >
        <svg
          width={STAR_SIZE}
          height={STAR_SIZE}
          viewBox="0 0 13 13"
          aria-hidden="true"
          style={{ overflow: "visible", display: "block" }}
        >
          <path
            ref={starRef}
            d={STAR_PATH}
            fill="#111"
            transform={`scale(${STAR_SCALE})`}
            style={{ transformBox: "fill-box" }}
          />
        </svg>
      </button>

      {/* Filtros de morph — uno por link (idénticos a `atj-filter` del
          HeaderFooter: turbulencia + displacement + blur + glow boosteado). */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute", overflow: "hidden" }}>
        <defs>
          {NAV_ITEMS.map((_, i) => (
            <filter key={i} id={`bcn-morph-${i}`} x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence id={`bcn-turb-${i}`} type="fractalNoise" baseFrequency="0.008 0.013" numOctaves="2" seed="4" result="noise" />
              <feDisplacementMap id={`bcn-disp-${i}`} in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur id={`bcn-blur-${i}`} in="displaced" stdDeviation="0" result="blurred" />
              <feGaussianBlur id={`bcn-glow-${i}`} in="displaced" stdDeviation="0" result="glow-raw" />
              {/* Glow forzado a NEGRO puro (RGB=0) con alfa boosteado → sombra
                  negra del mismo color que las letras, no gris. */}
              <feColorMatrix in="glow-raw" type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 12 -3" result="glow-boosted" />
              <feMerge>
                <feMergeNode in="glow-boosted" />
                <feMergeNode in="blurred" />
              </feMerge>
            </filter>
          ))}
        </defs>
      </svg>

      {/* ── Overlay modal centrado en pantalla ──────────────────────────────────
          Fijo a viewport. Transparente (no oscurece): solo captura clicks para
          cerrar al pulsar fuera del recuadro. */}
      <div
        ref={overlayRef}
        onPointerDown={(e) => {
          if (e.target === overlayRef.current) setOpen(false);
        }}
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 60,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Recuadro de papel de calco antiguo — blurrea lo que queda debajo */}
        <div
          ref={boxRef}
          id="bcn-menu"
          role="menu"
          aria-hidden={!open}
          className="bcn-paper"
        >
          <ul ref={linksRef} className="bcn-paper-list">
            {NAV_ITEMS.map((item, i) => {
              const active = item.href === router.pathname;
              return (
                <li key={item.label} style={{ margin: 0, padding: 0 }}>
                  <button
                    ref={(el) => { linkElsRef.current[i] = el; }}
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate(item.href)}
                    onPointerEnter={() => handleLinkEnter(i)}
                    onPointerLeave={() => handleLinkLeave(i, active)}
                    className={`bcn-paper-link${active ? " is-active" : ""}`}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Estilos: efecto papel de calco antiguo (vellum) ──────────────────── */}
      <style>{`
        .bcn-paper {
          position: relative;
          overflow: hidden;
          max-width: 90vw;
          padding: 12px 26px;
          /* Pill: border-radius completo */
          border-radius: 999px;
          /* Velo blanco translúcido + difusión del fondo (papel de calco) */
          background-color: rgba(255, 255, 255, 0.28);
          -webkit-backdrop-filter: blur(10px) saturate(0.85) brightness(1.06) contrast(1.02);
          backdrop-filter: blur(10px) saturate(0.85) brightness(1.06) contrast(1.02);
          border: none;
          box-shadow: 0 18px 50px -20px rgba(0, 0, 0, 0.16);
        }
        /* Grano de fibra de papel — textura monocroma multiplicada */
        .bcn-paper::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E");
          background-size: 180px 180px;
          opacity: 0.16;
          mix-blend-mode: multiply;
          pointer-events: none;
        }
        /* Velo muy sutil — sin viñeta blanca en los bordes */
        .bcn-paper::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(130% 120% at 50% 50%,
            rgba(255, 255, 255, 0.08) 0%,
            rgba(255, 255, 255, 0.00) 70%);
          pointer-events: none;
        }

        .bcn-paper-list {
          position: relative;
          z-index: 1;
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 26px;
        }

        .bcn-paper-link {
          background: transparent;
          border: 0;
          padding: 2px 2px;
          cursor: pointer;
          color: #000;
          font: 800 18px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          letter-spacing: -0.03em;
          white-space: nowrap;
          opacity: 0.82;
          transition: opacity 180ms ease;
        }
        .bcn-paper-link:hover,
        .bcn-paper-link:focus-visible {
          opacity: 1;
          outline: none;
        }
        .bcn-paper-link.is-active {
          opacity: 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .bcn-paper-link { transition: none; }
        }
      `}</style>
    </div>
  );
}
