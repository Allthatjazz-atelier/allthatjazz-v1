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
const STAR_SIZE   = 14;   // tamaño del avatar
const PANEL_PADDING = 10; // padding uniforme del panel en los 4 lados
const LINK_GAP = 6;       // separación vertical entre links
const LINK_LINE_HEIGHT = 12;
const PANEL_OFFSET_Y = -8; // microajuste fino para alinear "Slider" con la línea del reloj
const RECT_WIDTH  = 124;  // ancho del menú abierto
const RECT_HEIGHT =
  PANEL_PADDING * 2 +
  NAV_ITEMS.length * LINK_LINE_HEIGHT +
  (NAV_ITEMS.length - 1) * LINK_GAP; // alto justo para padding simétrico
const SVG_W       = RECT_WIDTH;   // el SVG abarca todo el ancho final
const SVG_H       = RECT_HEIGHT;
const RECT_Y      = (SVG_H - STAR_SIZE) / 2 + PANEL_OFFSET_Y;

// ─── Path ✦ ────────────────────────────────────────────────────────────────────
// Path real del avatar `/public/avatar/✦.svg` — viewBox 13×13.
// Curvas Bézier cúbicas → silueta robusta con puntas cóncavas (no agujas).
const STAR_PATH = "M5.824 12.288C5.70667 11.5947 5.39733 10.848 4.896 10.048C4.39467 9.23733 3.68 8.48533 2.752 7.792C1.83467 7.09867 0.917333 6.656 0 6.464V5.792C0.906667 5.57867 1.776 5.184 2.608 4.608C3.45067 4.02133 4.15467 3.31733 4.72 2.496C5.296 1.65333 5.664 0.821333 5.824 0H6.496C6.592 0.533333 6.784 1.08267 7.072 1.648C7.36 2.20267 7.728 2.736 8.176 3.248C8.63467 3.74933 9.14667 4.20267 9.712 4.608C10.5547 5.20533 11.4133 5.6 12.288 5.792V6.464C11.7013 6.58133 11.0933 6.82133 10.464 7.184C9.84533 7.54667 9.26933 7.97867 8.736 8.48C8.20267 8.97067 7.76533 9.488 7.424 10.032C6.92267 10.832 6.61333 11.584 6.496 12.288H5.824Z";

// El path nativo es 13×13. Lo escalamos a STAR_SIZE (14) y lo centramos
// verticalmente dentro del SVG de 22 de alto.
const STAR_SCALE       = STAR_SIZE / 13;                  // ≈ 1.077
const STAR_TRANSLATE_Y = (SVG_H - STAR_SIZE) / 2;         // = 4
const STAR_TRANSFORM   = `translate(0 ${STAR_TRANSLATE_Y}) scale(${STAR_SCALE})`;
// Centro del bounding box del path en su propio sistema (0..12.288 en ambos ejes)
// — lo usamos como transform-origin para el scale animado por GSAP.
const STAR_ORIGIN      = "6.144 6.144";

// ─── Componente ────────────────────────────────────────────────────────────────
export default function BerlinClockNav2() {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);
  const timeRef      = useRef(null);
  const svgRef       = useRef(null);
  const starRef      = useRef(null);
  const rectRef      = useRef(null);
  const linksRef     = useRef(null);
  const tlRef        = useRef(null);
  const panelHoveredRef = useRef(false);
  const titleHoveredRef = useRef(false);
  const activeTitleRef  = useRef(null);
  const hoverTweenRef   = useRef(null);
  const pulseTweenRef   = useRef(null);

  // Estado del filtro SVG (se anima con GSAP y se sincroniza con attrs del filtro)
  const filterState = useRef({ scale: 0, blur: 0, glow: 0, freq: 0.008 });

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
  // Pre-carga el bundle de cada vista para que el cambio sea instantáneo y la
  // escena entrante monte sin esperar a la red.
  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.href?.startsWith("/")) router.prefetch(item.href);
    });
  }, [router]);

  // ── Navegación a una vista ──────────────────────────────────────────────────
  const handleNavigate = useCallback(
    (href) => {
      setOpen(false);
      // No re-navegar si ya estamos en la ruta.
      if (!href || href === router.pathname) return;
      router.push(href);
    },
    [router]
  );

  // ── Sync del filtro con el estado animado ──────────────────────────────────
  const updateFilter = useCallback(() => {
    const turb = document.getElementById("bcn-turb");
    const disp = document.getElementById("bcn-disp");
    const blur = document.getElementById("bcn-blur");
    const glow = document.getElementById("bcn-glow");
    const s = filterState.current;
    if (turb && disp && blur && glow) {
      disp.setAttribute("scale",         s.scale.toFixed(3));
      blur.setAttribute("stdDeviation",  s.blur.toFixed(3));
      glow.setAttribute("stdDeviation",  s.glow.toFixed(3));
      turb.setAttribute("baseFrequency", `${s.freq.toFixed(4)} ${(s.freq * 1.6).toFixed(4)}`);
    }
  }, []);

  const clearActiveTitleFilter = useCallback(() => {
    if (activeTitleRef.current) {
      activeTitleRef.current.style.filter = "none";
      activeTitleRef.current = null;
    }
  }, []);

  const startMorphLoop = useCallback(() => {
    if (!open) return;
    const tl = tlRef.current;
    if (!tl || tl.isActive()) return; // no mezclar con apertura/cierre
    if (pulseTweenRef.current) return;

    if (hoverTweenRef.current) {
      hoverTweenRef.current.kill();
      hoverTweenRef.current = null;
    }

    const s = filterState.current;
    s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
    if (svgRef.current) svgRef.current.style.filter = "url(#bcn-filter)";
    updateFilter();

    pulseTweenRef.current = gsap.timeline({ repeat: -1, repeatDelay: 0.22 });
    pulseTweenRef.current
      .to(s, {
        scale: 3.2, blur: 0.16, glow: 0.95, freq: 0.009,
        duration: 0.95, ease: "sine.out",
        onUpdate: updateFilter,
      })
      .to(s, {
        scale: 0, blur: 0, glow: 0, freq: 0.008,
        duration: 0.72, ease: "sine.inOut",
        onUpdate: updateFilter,
      });
  }, [open, updateFilter]);

  const stopMorphLoop = useCallback((preserveVisualState = false) => {
    if (pulseTweenRef.current) {
      pulseTweenRef.current.kill();
      pulseTweenRef.current = null;
    }

    if (hoverTweenRef.current) {
      hoverTweenRef.current.kill();
      hoverTweenRef.current = null;
    }

    if (preserveVisualState) return;

    const s = filterState.current;
    hoverTweenRef.current = gsap.to(s, {
      scale: 0, blur: 0, glow: 0, freq: 0.008,
      duration: 0.5, ease: "sine.inOut",
      onUpdate: updateFilter,
      onComplete: () => {
        if (panelHoveredRef.current || titleHoveredRef.current) return;
        clearActiveTitleFilter();
        s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
        updateFilter();
      },
    });
  }, [clearActiveTitleFilter, updateFilter]);

  const handlePanelEnter = useCallback(() => {
    panelHoveredRef.current = true;
    startMorphLoop();
  }, [startMorphLoop]);

  const handlePanelLeave = useCallback(() => {
    panelHoveredRef.current = false;
    if (!titleHoveredRef.current) stopMorphLoop();
  }, [stopMorphLoop]);

  const handleTitleEnter = useCallback((targetEl) => {
    titleHoveredRef.current = true;
    if (activeTitleRef.current && activeTitleRef.current !== targetEl) {
      activeTitleRef.current.style.filter = "none";
    }
    activeTitleRef.current = targetEl;
    if (activeTitleRef.current) {
      activeTitleRef.current.style.filter = "url(#bcn-filter)";
    }
    startMorphLoop();
  }, [startMorphLoop]);

  const handleTitleLeave = useCallback((targetEl) => {
    if (activeTitleRef.current === targetEl) {
      clearActiveTitleFilter();
    }
    titleHoveredRef.current = false;
    if (!panelHoveredRef.current) stopMorphLoop();
  }, [clearActiveTitleFilter, stopMorphLoop]);

  // ── Timeline GSAP — construida una vez, se reproduce/invierte según `open` ─
  useGSAP(() => {
    // Estado inicial (cerrado)
    gsap.set(rectRef.current, {
      attr: { x: 0, y: RECT_Y, width: STAR_SIZE, height: STAR_SIZE },
      opacity: 0,
    });
    gsap.set(starRef.current, { opacity: 1, transformOrigin: STAR_ORIGIN });
    if (linksRef.current) {
      gsap.set(linksRef.current.children, { opacity: 0, y: 4 });
    }

    const tl = gsap.timeline({
      paused: true,
      // Cuando se cierra del todo, desactivamos el filter para no gastar GPU en idle
      onReverseComplete: () => {
        if (svgRef.current) svgRef.current.style.filter = "none";
        if (hoverTweenRef.current) {
          hoverTweenRef.current.kill();
          hoverTweenRef.current = null;
        }
        if (pulseTweenRef.current) {
          pulseTweenRef.current.kill();
          pulseTweenRef.current = null;
        }
        panelHoveredRef.current = false;
        titleHoveredRef.current = false;
        clearActiveTitleFilter();
        // Estado cerrado explícito para evitar desajustes visuales al reabrir.
        gsap.set(starRef.current, { opacity: 1, rotation: 0, scale: 1 });
        gsap.set(rectRef.current, {
          attr: { x: 0, y: RECT_Y, width: STAR_SIZE, height: STAR_SIZE },
          opacity: 0,
        });
        if (linksRef.current) {
          gsap.set(linksRef.current.children, { opacity: 0, y: 4 });
        }
      },
    });

    // ── Acto 1: el filtro se enciende (silueta empieza a temblar) ────────────
    tl.to(filterState.current, {
      scale: 7, blur: 0.4, glow: 2.5, freq: 0.012,
      duration: 0.40, ease: "sine.in",
      onUpdate: updateFilter,
    }, 0);

    // Nota: "Berlin, HH:MM" se mantiene visible durante toda la animación —
    // solo el avatar morfa. El reloj queda como ancla a la izquierda del menú.

    // ── Acto 2: la estrella GIRA 360° mientras se encoge ─────────────────────
    // Spin + shrink + wobble del filter (a tope durante todo este tramo) +
    // rect creciendo en paralelo → el ojo lo lee como UN gesto orgánico,
    // no como animaciones independientes.
    //
    // Por la simetría rotacional de orden 4 del ✦, los ángulos intermedios
    // (22.5°, 67.5°, ...) son los que más rotación se perciben. El ease
    // `expo.inOut` (lento al principio y al final, rápido en el medio) hace
    // que ese tramo donde la rotación es más legible coincida con el momento
    // de máxima distorsión del filtro → sensación de "se está retorciendo".
    tl.to(starRef.current, {
      rotation: 360,
      scale: 0.3,
      duration: 1.00, ease: "expo.inOut",
    }, 0);

    // Fade out de la estrella — entra por la segunda mitad del giro,
    // así vemos el inicio de la rotación a opacidad plena.
    tl.to(starRef.current, {
      opacity: 0,
      duration: 0.45, ease: "power2.in",
    }, 0.55);

    // ── Rect crece sincronizado con el giro (atributos SVG vía `attr:`) ──────
    tl.to(rectRef.current, {
      attr: { x: 0, y: RECT_Y, width: RECT_WIDTH, height: RECT_HEIGHT },
      opacity: 1,
      duration: 0.95, ease: "expo.inOut",
    }, 0.10);

    // ── Acto 3: el filtro se apaga → la forma final queda crisp ──────────────
    tl.to(filterState.current, {
      scale: 0, blur: 0, glow: 0, freq: 0.008,
      duration: 0.40, ease: "sine.out",
      onUpdate: updateFilter,
    }, 0.70);

    // ── Acto 4: links entran con stagger una vez todo está asentado ──────────
    tl.to(linksRef.current ? linksRef.current.children : [], {
      opacity: 1, y: 0,
      duration: 0.35, stagger: 0.05, ease: "power3.out",
    }, 1.05);

    tlRef.current = tl;
  }, { scope: containerRef });

  // ── Play / reverse según estado ─────────────────────────────────────────────
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;

    // Aseguramos que el filter esté aplicado ANTES de empezar (apertura o cierre)
    if (svgRef.current) svgRef.current.style.filter = "url(#bcn-filter)";

    if (open) {
      tl.timeScale(1).play(0);
    } else {
      stopMorphLoop(true);
      panelHoveredRef.current = false;
      titleHoveredRef.current = false;

      // Cerrar algo más rápido que abrir — patrón UX estándar.
      // 1.4× sobre 1.4s → ~1.0s de cierre. Conserva la legibilidad del morph
      // en reversa sin sentirse perezoso.
      tl.timeScale(1.4).reverse();
    }
  }, [open, stopMorphLoop]);

  // ── Cierre con click fuera + Escape ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-1 text-[0.875rem] tracking-[-0.04em] text-black"
      style={{ pointerEvents: "auto" }}
    >
      {/* Berlin time — tabular-nums para que los dígitos no bailen */}
      <span ref={timeRef} style={{ fontVariantNumeric: "tabular-nums" }}>
        Berlin, {time}
      </span>

      {/* Wrapper relativo de 14×14 — el SVG y los overlays absolutos cuelgan de aquí */}
      <div className="relative inline-flex items-center" style={{ width: STAR_SIZE, height: STAR_SIZE }}>

        {/* SVG con el filtro + las dos formas que morfean */}
        <svg
          ref={svgRef}
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            overflow: "visible",     // el glow del filter no se debe recortar
            pointerEvents: "none",
          }}
        >
          <defs>
            {/* Mismo filtro orgánico que `menu/index15.js` para "AllThatJazz" — */}
            {/* solo cambian los `id`s para no colisionar y los parámetros base. */}
            <filter id="bcn-filter" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence
                id="bcn-turb"
                type="fractalNoise"
                baseFrequency="0.008 0.013"
                numOctaves="2"
                seed="3"
                result="noise"
              />
              <feDisplacementMap
                id="bcn-disp"
                in="SourceGraphic"
                in2="noise"
                scale="0"
                xChannelSelector="R"
                yChannelSelector="G"
                result="displaced"
              />
              <feGaussianBlur id="bcn-blur" in="displaced" stdDeviation="0" result="blurred" />
              <feGaussianBlur id="bcn-glow" in="displaced" stdDeviation="0" result="glow-raw" />
              <feColorMatrix
                in="glow-raw"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -3"
                result="glow-boosted"
              />
              <feMerge>
                <feMergeNode in="glow-boosted" />
                <feMergeNode in="blurred" />
              </feMerge>
            </filter>
          </defs>

          {/* Estrella ✦ (visible cuando cerrado) — path original de /avatar/✦.svg.
              El `<g>` posiciona y escala desde el viewBox nativo 13×13 al tamaño
              del avatar. El `<path>` lleva el ref para que GSAP anime opacity/scale
              en su propio sistema de coords (transform-origin en STAR_ORIGIN). */}
          <g transform={STAR_TRANSFORM}>
            <path
              ref={starRef}
              d={STAR_PATH}
              fill="#111"
            />
          </g>

          {/* Rectángulo (visible cuando abierto) — crece de 14×14 a 124×88 */}
          <rect
            ref={rectRef}
            x={0}
            y={RECT_Y}
            width={STAR_SIZE}
            height={STAR_SIZE}
            fill="#111"
            opacity={0}
          />
        </svg>

        {/* Star button — click target, encima del área de la estrella */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="bcn-menu"
          aria-label={open ? "Cerrar menú de vistas" : "Abrir menú de vistas"}
          className="absolute cursor-pointer"
          style={{
            left: 0, top: 0,
            width: STAR_SIZE, height: STAR_SIZE,
            background: "transparent", border: 0, padding: 0,
            zIndex: 2,
          }}
        />

        {/* Links overlay — HTML dentro del panel vertical, clickable al abrir */}
        <ul
          id="bcn-menu"
          ref={linksRef}
          role="menu"
          aria-hidden={!open}
          onPointerEnter={handlePanelEnter}
          onPointerLeave={handlePanelLeave}
          style={{
            position: "absolute",
            left: 0,
            top: PANEL_OFFSET_Y,
            transform: "none",
            width: RECT_WIDTH,
            height: RECT_HEIGHT,
            margin: 0,
            padding: `${PANEL_PADDING}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: LINK_GAP,
            fontSize: 12,
            lineHeight: 1,
            listStyle: "none",
            pointerEvents: open ? "auto" : "none",
            zIndex: 3,
          }}
        >
          {NAV_ITEMS.map((item) => (
            <li key={item.label} style={{ margin: 0, padding: 0, lineHeight: 1, flex: "0 0 auto" }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleNavigate(item.href)}
                onPointerEnter={(e) => handleTitleEnter(e.currentTarget)}
                onPointerLeave={(e) => handleTitleLeave(e.currentTarget)}
                className="bcn-link"
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  color: "#fff",
                  cursor: "pointer",
                  font: "800 12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  letterSpacing: "-0.045em",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Hover de los links — opacidad, no scale (per skill brutalista) */}
      <style>{`
        .bcn-link {
          opacity: 1;
          transition: opacity 200ms ease;
        }
        .bcn-link:hover,
        .bcn-link:focus-visible {
          opacity: 1;
          outline: none;
        }
      `}</style>
    </div>
  );
}
