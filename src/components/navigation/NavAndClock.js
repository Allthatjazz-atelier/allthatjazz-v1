"use client";

import { useEffect, useLayoutEffect, useCallback, useRef, useState, memo } from "react";
import { useRouter } from "next/router";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

// A Slider · B Galaxy
const NAV_ITEMS = [
  { key: "A", label: "Slider", href: "/" },
  { key: "B", label: "Galaxy", href: "/space" },
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
      className="bcn relative text-[0.875rem] tracking-[-0.04em] text-black"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bcn-bar">
        <div className="bcn-pill bcn-clock" aria-live="polite">
          <BerlinClock />
        </div>
        <NavPills activeIndex={activeIndex} onNavigate={handleNavigate} />
      </div>

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

        .bcn-pill {
          position: relative;
          display: flex;
          align-items: center;
          height: var(--bcn-pill);
          min-width: var(--bcn-pill);
          padding: 0;
          border: 0;
          border-radius: 0;
          background: rgba(17, 17, 17, 0.06);
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

        @media (prefers-reduced-motion: reduce) {
          .bcn-pill { transition: none; }
        }
      `}</style>
    </div>
  );
}

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
