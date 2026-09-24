"use client";

import { useEffect, useLayoutEffect, useCallback, useRef, useState, memo } from "react";
import { useRouter } from "next/router";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { setDensityLevel, useViewPrefs } from "@/components/final-components/viewPrefs";
import { useTheme } from "@/hooks/useTheme";

// A Slider · B Grid · C Galaxy
const NAV_ITEMS = [
  { key: "A", label: "Slider", href: "/" },
  { key: "B", label: "Grid", href: "/grid" },
  { key: "C", label: "Galaxy", href: "/space" },
];

const PILL_DUR = 0.62;
const PILL_EASE = "power2.inOut";
const NAV_PUSH_DELAY = PILL_DUR * 1000;

function activeIndexFromPath(pathname) {
  const i = NAV_ITEMS.findIndex((item) => item.href === pathname);
  return i === -1 ? 0 : i;
}

export default function NavAndClock() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const routeIndex = activeIndexFromPath(router.pathname);
  const [activeIndex, setActiveIndex] = useState(routeIndex);
  const pushTimer = useRef(null);
  const lagTimer = useRef(null);

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      if (item.href?.startsWith("/")) router.prefetch(item.href);
    });
    // Calienta el JS de Galaxy en idle. Los shaders GPU siguen
    // compilándose al montar; esto evita el parse de chunk en el click.
    const warm = () => {
      import("@/components/Space3D/Space3D_2");
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 1800 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 500);
    return () => clearTimeout(t);
  }, [router]);

  useEffect(() => () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    if (lagTimer.current) clearTimeout(lagTimer.current);
    gsap.ticker.lagSmoothing(500, 33);
  }, []);

  // Atrás/adelante del browser: sí sincroniza. Durante un click nuestro
  // activeIndex ya coincide y React no re-renderiza.
  useEffect(() => { setActiveIndex(routeIndex); }, [routeIndex]);

  const handleNavigate = useCallback((href, i) => {
    const r = routerRef.current;
    if (!href || i === activeIndex) return;
    setActiveIndex(i);
    if (pushTimer.current) clearTimeout(pushTimer.current);
    if (lagTimer.current) clearTimeout(lagTimer.current);
    // El escenario arranca el morph en este instante: si esperáramos al
    // router.push (tras la pastilla) las imágenes se quedarían quietas 620 ms.
    window.dispatchEvent(new CustomEvent("atj:view-will-change", { detail: { href } }));
    // Sin lagSmoothing, un frame largo (compile de shaders) hace que GSAP
    // salte el playhead → tripón en pill. 0 = no saltar.
    gsap.ticker.lagSmoothing(0);
    pushTimer.current = setTimeout(() => {
      if (href !== r.pathname) r.push(href);
      lagTimer.current = setTimeout(() => gsap.ticker.lagSmoothing(500, 33), 1100);
    }, NAV_PUSH_DELAY);
  }, [activeIndex]);

  return (
    <div
      className="bcn relative text-[0.875rem] tracking-[-0.04em] text-[var(--atj-ink)]"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bcn-head">
        <div className="bcn-bar">
          <div className="bcn-pill bcn-clock" aria-live="polite">
            <BerlinClock />
          </div>
          <NavPills activeIndex={activeIndex} onNavigate={handleNavigate} />
        </div>
        <ThemePill />
      </div>

      {/* Segunda fila, solo en la rejilla: densidad. Mismo idioma de cápsula
          que las de vista, para que se lean como una extensión y no como un
          control nuevo. */}
      {router.pathname === "/grid" && <DensityPills />}

      <style>{`
        .bcn {
          --bcn-pill: 1.5em;
          --bcn-cut: 2px;
          display: flex;
          flex-direction: column;
          align-items: center;
          contain: layout style;
          isolation: isolate;
        }

        /* Una cápsula; los huecos blancos la cortan en minipills. */
        .bcn-bar {
          display: flex;
          align-items: stretch;
          height: var(--bcn-pill);
          gap: var(--bcn-cut);
          border-radius: 999px;
          overflow: hidden;
        }

        .bcn-nav {
          display: contents;
        }

        .bcn-head {
          position: relative;
          display: flex;
        }

        /* Cápsula aparte y fuera del flujo: la barra conserva su centro óptico
           y la fila de densidad sigue alineada debajo. El hueco es mayor que
           --bcn-cut para que se lea como otra pieza, no como otra minipill. */
        .bcn-theme {
          position: absolute;
          top: 0;
          left: 100%;
          margin-left: 6px;
          display: flex;
          height: var(--bcn-pill);
          border-radius: 999px;
          overflow: hidden;
        }
        /* Interruptor: la bolita toma --atj-ink, así que es negra en claro y
           blanca en oscuro sin lógica aparte. */
        .bcn-pill.bcn-pill--theme {
          --bcn-knob: 1em;
          --bcn-knob-pad: calc((var(--bcn-pill) - var(--bcn-knob)) / 2);
          width: calc(var(--bcn-pill) * 1.9);
          padding: 0 var(--bcn-knob-pad);
          opacity: 1;
        }

        .bcn-knob {
          width: var(--bcn-knob);
          height: var(--bcn-knob);
          border-radius: 50%;
          background: currentColor;
          transform: translate3d(0, 0, 0);
          transition: transform 320ms cubic-bezier(0.65, 0, 0.35, 1);
        }
        .bcn-pill--theme.is-active .bcn-knob {
          transform: translate3d(
            calc(var(--bcn-pill) * 1.9 - var(--bcn-knob-pad) * 2 - var(--bcn-knob)),
            0,
            0
          );
        }

        .bcn-bar--dens {
          margin-top: 4px;
          font-variant-numeric: tabular-nums;
        }
        .bcn-pill--dens {
          justify-content: center;
          padding: 0 0.62em;
        }

        .bcn-pill {
          position: relative;
          display: flex;
          align-items: center;
          height: var(--bcn-pill);
          min-width: var(--bcn-pill);
          padding: 0;
          border: 0;
          border-radius: 0;
          background: var(--atj-hairline);
          color: inherit;
          font: inherit;
          letter-spacing: inherit;
          line-height: 1;
          cursor: pointer;
          overflow: hidden;
          opacity: 0.72;
          transition: opacity 180ms ease;
        }
        .bcn-pill:hover,
        .bcn-pill:focus-visible {
          opacity: 1;
          outline: none;
        }
        .bcn-pill.is-active { opacity: 1; }

        .bcn-pill.bcn-clock {
          padding: 0 0.7em;
          opacity: 1;
          cursor: default;
          white-space: nowrap;
        }
        .bcn-pill.bcn-clock:hover,
        .bcn-pill.bcn-clock:focus-visible {
          opacity: 1;
        }

        .bcn-pill__key {
          position: relative;
          z-index: 1;
          flex: 0 0 var(--bcn-pill);
          width: var(--bcn-pill);
          height: var(--bcn-pill);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Spacer GN.D: GSAP anima width en px. El nombre es absoluto y
           se revela al estirar. */
        .bcn-pill__grow {
          flex: 0 0 auto;
          width: 0;
          height: 100%;
        }

        .bcn-pill__name {
          position: absolute;
          left: var(--bcn-pill);
          top: 0;
          height: 100%;
          display: flex;
          align-items: center;
          white-space: nowrap;
          padding: 0 0.58em 0 0.06em;
          pointer-events: none;
        }

        /* Solo la altura: la letra no cambia porque el ancho de los nombres se
           mide en px al montar y quedaría desfasado al rotar el dispositivo. */
        @media (max-width: 768px), (pointer: coarse) {
          .bcn { --bcn-pill: 1.8em; }
          .bcn-bar--dens { margin-top: 6px; }
          .bcn-pill--dens { padding: 0 0.85em; }
          .bcn-pill.bcn-pill--theme { --bcn-knob: 1.2em; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bcn-pill,
          .bcn-knob { transition: none; }
        }
      `}</style>
    </div>
  );
}

// Aislado en su propio componente para que el cambio de tema no re-renderice
// las pills de vista: el estado de color no tiene nada que ver con la ruta.
const ThemePill = memo(function ThemePill() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="bcn-theme">
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Modo oscuro"
        onClick={toggle}
        className={`bcn-pill bcn-pill--theme${dark ? " is-active" : ""}`}
      >
        <span className="bcn-knob" aria-hidden="true" />
      </button>
    </div>
  );
});

// Densidad de la rejilla. El nivel vive en un store externo porque la rejilla
// cuelga del escenario y estas pills del layout: son dos árboles hermanos.
const DensityPills = memo(function DensityPills() {
  const { level, ladder } = useViewPrefs();
  return (
    <div className="bcn-bar bcn-bar--dens" role="group" aria-label="Densidad de la rejilla">
      {ladder.map((cols, i) => (
        <button
          key={cols}
          type="button"
          aria-pressed={i === level}
          aria-label={`${cols} columnas`}
          className={`bcn-pill bcn-pill--dens${i === level ? " is-active" : ""}`}
          onClick={() => {
            if (i === level) return;
            // La rejilla mide su estado actual antes de que cambie el layout:
            // el aviso va por delante del cambio, no después.
            window.dispatchEvent(new CustomEvent("atj:density-will-change"));
            setDensityLevel(i);
          }}
        >
          {cols}
        </button>
      ))}
    </div>
  );
});

// Reloj fuera de React: un setInterval no debe re-renderizar pills.
const BerlinClock = memo(function BerlinClock() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      Berlin, <span ref={ref} />
    </span>
  );
});

const NavPills = memo(function NavPills({ activeIndex, onNavigate }) {
  const nameRefs = useRef([]);
  const growRefs = useRef([]);
  const nameW = useRef([0, 0]);
  const first = useRef(true);

  const measure = useCallback(() => {
    nameRefs.current.forEach((el, i) => {
      if (el) nameW.current[i] = Math.ceil(el.scrollWidth);
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useGSAP(() => {
    measure();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = first.current || reduce ? 0 : PILL_DUR;
    first.current = false;

    NAV_ITEMS.forEach((_, i) => {
      const grow = growRefs.current[i];
      if (!grow) return;
      gsap.to(grow, {
        width: i === activeIndex ? nameW.current[i] : 0,
        duration: dur,
        ease: PILL_EASE,
        overwrite: "auto",
      });
    });
  }, { dependencies: [activeIndex], revertOnUpdate: false });

  return (
    <nav className="bcn-nav" aria-label="Vistas">
      {NAV_ITEMS.map((item, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={item.key}
            type="button"
            aria-current={active ? "page" : undefined}
            aria-label={`${item.key} ${item.label}`}
            onClick={() => onNavigate(item.href, i)}
            className={`bcn-pill${active ? " is-active" : ""}`}
          >
            <span className="bcn-pill__key">{item.key}</span>
            <span
              ref={(el) => { growRefs.current[i] = el; }}
              className="bcn-pill__grow"
              aria-hidden="true"
            />
            <span
              ref={(el) => { nameRefs.current[i] = el; }}
              className="bcn-pill__name"
              aria-hidden={!active}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});
