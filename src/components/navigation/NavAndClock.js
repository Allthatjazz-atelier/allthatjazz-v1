"use client";

import { useEffect, useLayoutEffect, useCallback, useRef, useState, memo } from "react";
import { useRouter } from "next/router";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { setDensityLevel, setHomeView, useViewPrefs } from "@/components/final-components/viewPrefs";
import { useTheme } from "@/hooks/useTheme";

// A Slider · B Grid · C Galaxy. Slider y rejilla comparten la ruta "/" y se
// alternan por estado (`homeView`); la galaxia es su propia ruta.
const NAV_ITEMS = [
  { key: "A", label: "Slider", view: "slider" },
  { key: "B", label: "Grid", view: "grid" },
  { key: "C", label: "Galaxy", route: "/space" },
];

const PILL_DUR = 0.62;
const PILL_EASE = "power2.inOut";
const NAV_PUSH_DELAY = PILL_DUR * 1000;

function activeIndexOf(pathname, homeView) {
  if (pathname === "/space") return 2;
  return homeView === "grid" ? 1 : 0;
}

export default function NavAndClock() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { homeView } = useViewPrefs();
  const routeIndex = activeIndexOf(router.pathname, homeView);
  // Estado local para que la pastilla se estire al click, no al llegar la ruta:
  // en galaxia el push va 620 ms detrás y ese margen absorbe el compile.
  const [activeIndex, setActiveIndex] = useState(routeIndex);
  const pushTimer = useRef(null);
  const lagTimer = useRef(null);

  useEffect(() => {
    router.prefetch("/space");
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

  const handleNavigate = useCallback((item, i) => {
    const r = routerRef.current;
    if (i === activeIndex) return;
    setActiveIndex(i);

    // Galaxia: sigue siendo una ruta. La cápsula anima y, al acabar, se navega
    // (el margen absorbe el compile de shaders sin tirón de pill).
    if (item.route) {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      if (lagTimer.current) clearTimeout(lagTimer.current);
      gsap.ticker.lagSmoothing(0);
      pushTimer.current = setTimeout(() => {
        if (item.route !== r.pathname) r.push(item.route);
        lagTimer.current = setTimeout(() => gsap.ticker.lagSmoothing(500, 33), 1100);
      }, NAV_PUSH_DELAY);
      return;
    }

    // Slider ↔ rejilla: solo estado. El escenario reacciona al cambio y arranca
    // el morph al instante, sin router de por medio. Si venimos de galaxia,
    // volvemos a "/" primero (fundido) y allí queda la vista elegida.
    setHomeView(item.view);
    if (r.pathname !== "/") r.push("/");
  }, [activeIndex]);

  return (
    <div
      className="bcn relative text-[0.875rem] tracking-[-0.04em] text-[var(--atj-ink)]"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bcn-stack">
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
            que las de vista; el stack comparte ancho con la barra superior. */}
        {activeIndex === 1 && <DensityPills />}
      </div>

      <style>{`
        .bcn {
          --bcn-pill: 1.5em;
          --bcn-cut: 2px;
          --bcn-ring: color-mix(in srgb, var(--atj-ink) 36%, transparent);
          display: flex;
          flex-direction: column;
          align-items: center;
          contain: layout style;
          isolation: isolate;
        }

        /* Una cápsula: el radio y el recorte viven en la barra. El velo+blur
           es el del about y va en cada tramo, así el hueco deja ver detrás. */
        .bcn-bar {
          display: flex;
          align-items: stretch;
          height: var(--bcn-pill);
          gap: var(--bcn-cut);
          border-radius: 999px;
          overflow: hidden;
          box-sizing: border-box;
        }

        .bcn-nav {
          display: contents;
        }

        /* Misma caja que .bcn-bar: la fila de densidad estira al mismo ancho. */
        .bcn-stack {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
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
          box-sizing: border-box;
        }
        /* Interruptor: la bolita toma --atj-ink, así que es negra en claro y
           blanca en oscuro sin lógica aparte. */
        .bcn-pill.bcn-pill--theme {
          --bcn-knob: 1em;
          --bcn-knob-pad: calc((var(--bcn-pill) - var(--bcn-knob)) / 2);
          width: calc(var(--bcn-pill) * 1.9);
          padding: 0 var(--bcn-knob-pad);
          color: var(--atj-ink);
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
          width: 100%;
          font-variant-numeric: tabular-nums;
        }
        .bcn-pill--dens {
          flex: 1 1 0;
          justify-content: center;
          padding: 0;
          min-width: 0;
        }

        .bcn-pill {
          position: relative;
          display: flex;
          align-items: center;
          height: 100%;
          min-width: var(--bcn-pill);
          padding: 0;
          border: 0;
          border-radius: 0;
          background: var(--atj-hairline);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          transform: translateZ(0);
          color: color-mix(in srgb, var(--atj-ink) 72%, transparent);
          font: inherit;
          letter-spacing: inherit;
          line-height: 1;
          cursor: pointer;
          overflow: hidden;
          opacity: 1;
          transition: color 180ms ease;
        }
        .bcn-pill:hover,
        .bcn-pill:focus-visible {
          color: var(--atj-ink);
          outline: none;
        }
        .bcn-pill.is-active { color: var(--atj-ink); }

        /* Oscuro: un solo trazo de 1px — perímetro de la cápsula y cortes.
           Sin sombra interior: sumaba otra línea arriba y abajo. */
        .dark .bcn-bar,
        .dark .bcn-theme {
          gap: 0;
          border: 1px solid var(--bcn-ring);
        }
        .dark .bcn-nav > .bcn-pill,
        .dark .bcn-bar--dens > .bcn-pill + .bcn-pill {
          border-left: 1px solid var(--bcn-ring);
        }

        .bcn-pill.bcn-clock {
          padding: 0 0.7em;
          color: var(--atj-ink);
          cursor: default;
          white-space: nowrap;
        }
        .bcn-pill.bcn-clock:hover,
        .bcn-pill.bcn-clock:focus-visible {
          color: var(--atj-ink);
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
          .bcn-stack { gap: 6px; }
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
            onClick={() => onNavigate(item, i)}
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
