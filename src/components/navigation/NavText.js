"use client";

import { useEffect, useCallback, useRef, useState, memo } from "react";
import { useRouter } from "next/router";
import gsap from "gsap";
import { setDensityLevel, setHomeView, useViewPrefs } from "@/components/final-components/viewPrefs";
import { useTheme } from "@/hooks/useTheme";

// Slider y rejilla comparten la ruta "/" y se alternan por estado (`homeView`);
// la galaxia es su propia ruta.
const NAV_ITEMS = [
  { label: "Slider", view: "slider" },
  { label: "Grid", view: "grid" },
  { label: "Galaxy", route: "/space" },
];

function activeIndexOf(pathname, homeView) {
  if (pathname === "/space") return 2;
  return homeView === "grid" ? 1 : 0;
}

export default function NavText() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { homeView } = useViewPrefs();
  const routeIndex = activeIndexOf(router.pathname, homeView);
  const [activeIndex, setActiveIndex] = useState(routeIndex);
  const lagTimer = useRef(null);

  useEffect(() => {
    router.prefetch("/space");
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
    if (lagTimer.current) clearTimeout(lagTimer.current);
    gsap.ticker.lagSmoothing(500, 33);
  }, []);

  useEffect(() => { setActiveIndex(routeIndex); }, [routeIndex]);

  const handleNavigate = useCallback((item, i) => {
    const r = routerRef.current;
    if (i === activeIndex) return;
    setActiveIndex(i);

    if (item.route) {
      if (lagTimer.current) clearTimeout(lagTimer.current);
      // Sin lagSmoothing, el compile de shaders de Galaxy hace saltar GSAP.
      gsap.ticker.lagSmoothing(0);
      if (item.route !== r.pathname) r.push(item.route);
      lagTimer.current = setTimeout(() => gsap.ticker.lagSmoothing(500, 33), 1100);
      return;
    }

    if (r.pathname === "/") {
      window.dispatchEvent(new CustomEvent("atj:view-will-change", {
        detail: { to: item.view },
      }));
    }
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
          <div className="bcn-clock" aria-live="polite">
            <BerlinClock />
          </div>
          <NavLinks activeIndex={activeIndex} onNavigate={handleNavigate} />
          <ThemeSwitch />
        </div>
        {activeIndex === 1 && <DensityLinks />}
      </div>

      <style>{`
        .bcn {
          /* A la escala del texto, no de las pastillas de antes. */
          --bcn-pill: 1.1em;
          --bcn-ring: color-mix(in srgb, var(--atj-ink) 36%, transparent);
          display: flex;
          flex-direction: column;
          align-items: center;
          contain: layout style;
          isolation: isolate;
        }

        .bcn-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .bcn-head {
          display: flex;
          align-items: center;
          gap: 1.5em;
        }

        .bcn-clock {
          white-space: nowrap;
          line-height: 1;
        }

        .bcn-nav,
        .bcn-sub {
          display: flex;
          align-items: center;
          gap: 0.85em;
        }

        .bcn-sub {
          font-variant-numeric: tabular-nums;
        }

        .bcn-link {
          border: 0;
          padding: 0;
          background: transparent;
          color: color-mix(in srgb, var(--atj-ink) 40%, transparent);
          font: inherit;
          letter-spacing: inherit;
          line-height: 1;
          white-space: nowrap;
          cursor: pointer;
          transition: color 180ms ease;
        }
        .bcn-link:hover,
        .bcn-link:focus-visible {
          color: var(--atj-ink);
          outline: none;
        }
        .bcn-link.is-active { color: var(--atj-ink); }

        /* Interruptor rectangular: esquinas cortas, no una cápsula. La pieza
           interior repite el mismo radio, a escala, y toma --atj-ink. */
        .bcn-theme {
          flex: 0 0 auto;
          display: flex;
          height: var(--bcn-pill);
          border-radius: 4px;
          overflow: hidden;
          box-sizing: border-box;
        }
        .bcn-pill.bcn-pill--theme {
          --bcn-knob: 0.72em;
          --bcn-knob-pad: calc((var(--bcn-pill) - var(--bcn-knob)) / 2);
          position: relative;
          display: flex;
          align-items: center;
          width: calc(var(--bcn-pill) * 1.9);
          height: 100%;
          padding: 0 var(--bcn-knob-pad);
          border: 0;
          border-radius: 0;
          background: var(--atj-hairline);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          color: var(--atj-ink);
          cursor: pointer;
          transform: translateZ(0);
        }
        .bcn-pill.bcn-pill--theme:focus-visible { outline: none; }
        .bcn-knob {
          width: var(--bcn-knob);
          height: var(--bcn-knob);
          border-radius: 2px;
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
        .dark .bcn-theme {
          border: 1px solid var(--bcn-ring);
        }

        @media (max-width: 768px), (pointer: coarse) {
          .bcn { --bcn-pill: 1.28em; }
          .bcn-stack { gap: 10px; }
          .bcn-head { gap: 1.15em; }
          .bcn-nav, .bcn-sub { gap: 0.7em; }
          .bcn-link { padding: 0.25em 0; }
          .bcn-pill.bcn-pill--theme { --bcn-knob: 0.84em; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bcn-link,
          .bcn-knob { transition: none; }
        }
      `}</style>
    </div>
  );
}

const ThemeSwitch = memo(function ThemeSwitch() {
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

const DensityLinks = memo(function DensityLinks() {
  const { level, ladder } = useViewPrefs();
  return (
    <div className="bcn-sub" role="group" aria-label="Densidad de la rejilla">
      {ladder.map((cols, i) => (
        <button
          key={cols}
          type="button"
          aria-pressed={i === level}
          aria-label={`${cols} columnas`}
          className={`bcn-link${i === level ? " is-active" : ""}`}
          onClick={() => {
            if (i === level) return;
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

const NavLinks = memo(function NavLinks({ activeIndex, onNavigate }) {
  return (
    <nav className="bcn-nav" aria-label="Vistas">
      {NAV_ITEMS.map((item, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={item.label}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(item, i)}
            className={`bcn-link${active ? " is-active" : ""}`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
});
