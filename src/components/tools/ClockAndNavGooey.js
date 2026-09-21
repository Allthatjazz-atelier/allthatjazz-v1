"use client";

import { useEffect, useLayoutEffect, useCallback, useId, useRef, useState, memo } from "react";
import { useRouter } from "next/router";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

// A Slider · B Galaxy · C Ring
const NAV_ITEMS = [
  { key: "A", label: "Slider", href: "/" },
  { key: "B", label: "Galaxy", href: "/space" },
  { key: "C", label: "Ring",   href: "/ring" },
];

const LETTER_PATHS = [
  "M50,214 L128,40 L206,214 M90,158 L166,158",
  "M86,50 L86,210 M86,50 L148,50 C184,50 194,74 194,98 C194,122 180,128 148,128 L86,128 M86,128 L156,128 C196,128 208,154 208,178 C208,204 188,210 156,210 L86,210",
  "M190,78 C164,48 96,50 72,104 C54,142 56,176 76,206 C100,232 166,230 192,200",
];

const NB_CIRCLES = 36;
const CIRCLE_R = 14;
const PILL_DUR = 0.62;
const PILL_EASE = "power2.inOut";
const NAV_PUSH_DELAY = PILL_DUR * 1000;

function activeIndexFromPath(pathname) {
  const i = NAV_ITEMS.findIndex((item) => item.href === pathname);
  return i === -1 ? 0 : i;
}

export default function ClockAndNavGooey() {
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
    // Calienta el JS de Galaxy/Ring en idle. Los shaders GPU siguen
    // compilándose al montar; esto evita el parse de chunk en el click.
    const warm = () => {
      import("@/components/Space3D/Space3D_2");
      import("@/components/ring/RingSLider4");
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
    // salte el playhead → tripón en pill y gooey. 0 = no saltar.
    gsap.ticker.lagSmoothing(0);
    pushTimer.current = setTimeout(() => {
      if (href !== r.pathname) r.push(href);
      lagTimer.current = setTimeout(() => gsap.ticker.lagSmoothing(500, 33), 1100);
    }, NAV_PUSH_DELAY);
  }, [activeIndex]);

  return (
    <div
      className="bcn relative flex items-start text-[0.875rem] tracking-[-0.04em] text-black"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bcn-left">
        <BerlinClock />
        <GooeyMark letterIndex={activeIndex} />
      </div>
      <NavPills activeIndex={activeIndex} onNavigate={handleNavigate} />

      <style>{`
        .bcn {
          --bcn-pill: 1.5em;
          --bcn-gap: 0.28em;
          --bcn-rest: calc(2 * var(--bcn-pill) + var(--bcn-gap));
          gap: 0.55em;
          contain: layout style;
          isolation: isolate;
        }

        .bcn-left {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: var(--bcn-gap);
        }

        .bcn-clock {
          white-space: nowrap;
          line-height: var(--bcn-pill);
        }

        .bcn-nav {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: var(--bcn-gap);
          min-width: 4.8em;
          contain: layout;
        }

        .bcn-pill {
          position: relative;
          display: flex;
          align-items: center;
          height: var(--bcn-pill);
          min-width: var(--bcn-pill);
          padding: 0;
          border: 0;
          border-radius: 999px;
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

        .bcn-gooey {
          width: 100%;
          height: var(--bcn-rest);
          overflow: visible;
          pointer-events: none;
        }
        .bcn-gooey svg {
          display: block;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        @media (prefers-reduced-motion: reduce) {
          .bcn-pill { transition: none; }
        }
      `}</style>
    </div>
  );
}

// Reloj fuera de React: un setInterval no debe re-renderizar pills ni gooey.
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
    <span className="bcn-clock" style={{ fontVariantNumeric: "tabular-nums" }}>
      Berlin, <span ref={ref} />
    </span>
  );
});

const NavPills = memo(function NavPills({ activeIndex, onNavigate }) {
  const nameRefs = useRef([]);
  const growRefs = useRef([]);
  const nameW = useRef([0, 0, 0]);
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

// ── Sampler ──────────────────────────────────────────────────────────────────
function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function linePt(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function cubicPt(a, c1, c2, b, t) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}
function approxLen(sample, steps = 12) {
  let len = 0;
  let prev = sample(0);
  for (let i = 1; i <= steps; i++) {
    const p = sample(i / steps);
    len += dist(prev, p);
    prev = p;
  }
  return Math.max(len, 0.001);
}
function samplePath(d, count) {
  const tokens = d.match(/[MLQC]|-?\d*\.?\d+/g) || [];
  let i = 0;
  let cmd = "M";
  let x = 0;
  let y = 0;
  const segs = [];
  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    if (/[MLQC]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") {
      x = num();
      y = num();
    } else if (cmd === "L") {
      const nx = num();
      const ny = num();
      const a = { x, y };
      const b = { x: nx, y: ny };
      segs.push({ len: dist(a, b), at: (t) => linePt(a, b, t) });
      x = nx;
      y = ny;
    } else if (cmd === "C") {
      const c1 = { x: num(), y: num() };
      const c2 = { x: num(), y: num() };
      const b = { x: num(), y: num() };
      const a = { x, y };
      const at = (t) => cubicPt(a, c1, c2, b, t);
      segs.push({ len: approxLen(at, 16), at });
      x = b.x;
      y = b.y;
    }
  }

  const total = segs.reduce((s, seg) => s + seg.len, 0) || 1;
  return Array.from({ length: count }, (_, n) => {
    let walk = (n / count) * total;
    let hit = segs[segs.length - 1];
    for (const seg of segs) {
      if (walk <= seg.len) { hit = seg; break; }
      walk -= seg.len;
    }
    return hit.at(hit.len ? walk / hit.len : 0);
  });
}

const LETTER_POINTS = LETTER_PATHS.map((d) => samplePath(d, NB_CIRCLES));

// Morph corto: cabe en el mismo tramo que la pill (~0.62s) para no
// solaparse con el compile WebGL de Galaxy/Ring. Ola breve, no la de /tests.
const MORPH_DUR = 0.5;
const MORPH_STAGGER = 0.0034;

const GooeyMark = memo(function GooeyMark({ letterIndex }) {
  const rawId = useId().replace(/[:]/g, "");
  const fid = `bcng-${rawId}`;
  const circlesRef = useRef([]);
  const [homeIndex] = useState(letterIndex);
  const proxyRef = useRef({ p: 0 });
  const firstRunRef = useRef(true);

  useGSAP(() => {
    const circles = circlesRef.current;
    const to = LETTER_POINTS[letterIndex];
    if (!to) return;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = circles.map((c) => ({
      x: c ? parseFloat(c.getAttribute("cx")) : 128,
      y: c ? parseFloat(c.getAttribute("cy")) : 128,
    }));

    if (reduce) {
      circles.forEach((c, i) => {
        if (!c || !to[i]) return;
        c.setAttribute("cx", to[i].x);
        c.setAttribute("cy", to[i].y);
      });
      return;
    }

    const proxy = proxyRef.current;
    const total = MORPH_DUR + (NB_CIRCLES - 1) * MORPH_STAGGER;
    gsap.killTweensOf(proxy);
    proxy.p = 0;
    gsap.to(proxy, {
      p: 1,
      duration: total,
      ease: "none",
      overwrite: true,
      onUpdate: () => {
        const time = proxy.p * total;
        for (let i = 0; i < NB_CIRCLES; i++) {
          const c = circles[i];
          if (!c || !to[i]) continue;
          let t = (time - i * MORPH_STAGGER) / MORPH_DUR;
          if (t <= 0) continue;
          if (t > 1) t = 1;
          const e = 1 - (1 - t) * (1 - t);
          const f = from[i];
          c.setAttribute("cx", (f.x + (to[i].x - f.x) * e).toFixed(2));
          c.setAttribute("cy", (f.y + (to[i].y - f.y) * e).toFixed(2));
        }
      },
    });
  }, { dependencies: [letterIndex], revertOnUpdate: false });

  return (
    <div className="bcn-gooey" aria-hidden="true">
      <svg viewBox="24 18 216 228" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id={fid} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="goo" />
            <feColorMatrix
              in="goo"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
            />
          </filter>
        </defs>

        <g filter={`url(#${fid})`}>
          {Array.from({ length: NB_CIRCLES }, (_, i) => (
            <circle
              key={i}
              ref={(el) => { circlesRef.current[i] = el; }}
              cx={LETTER_POINTS[homeIndex][i].x}
              cy={LETTER_POINTS[homeIndex][i].y}
              r={CIRCLE_R}
              fill="#111111"
            />
          ))}
        </g>
      </svg>
    </div>
  );
});
