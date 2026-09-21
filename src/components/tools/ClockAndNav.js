"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";

// A Slider · B Galaxy · C Ring — la activa muestra letra + nombre; las otras, solo letra.
const NAV_ITEMS = [
  { key: "A", label: "Slider", href: "/" },
  { key: "B", label: "Galaxy", href: "/space" },
  { key: "C", label: "Ring",   href: "/ring" },
];

function activeIndexFromPath(pathname) {
  const i = NAV_ITEMS.findIndex((item) => item.href === pathname);
  return i === -1 ? 0 : i;
}

export default function ClockAndNav() {
  const router = useRouter();
  const [time, setTime] = useState("");

  const activeIndex = activeIndexFromPath(router.pathname);

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

  const handleNavigate = useCallback((href) => {
    if (!href || href === router.pathname) return;
    router.push(href);
  }, [router]);

  return (
    <div
      className="bcn relative flex items-center text-[0.875rem] tracking-[-0.04em] text-black"
      style={{ pointerEvents: "auto" }}
    >
      <span className="bcn-clock" style={{ fontVariantNumeric: "tabular-nums" }}>
        Berlin, {time}
      </span>

      <nav className="bcn-nav" aria-label="Vistas">
        {NAV_ITEMS.map((item, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={`${item.key} ${item.label}`}
              onClick={() => handleNavigate(item.href)}
              className={`bcn-pill${active ? " is-active" : ""}`}
            >
              <span className="bcn-pill__key">{item.key}</span>
              <span className="bcn-pill__label" aria-hidden={!active}>
                <span className="bcn-pill__name">{item.label}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <style>{`
        .bcn {
          --bcn-pill: 1.5em;
          --bcn-gap: 0.28em;
          gap: 0.65em;
        }

        .bcn-clock {
          white-space: nowrap;
          line-height: var(--bcn-pill);
        }

        .bcn-nav {
          display: flex;
          align-items: center;
          gap: var(--bcn-gap);
        }

        .bcn-pill {
          display: inline-flex;
          align-items: center;
          height: var(--bcn-pill);
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
        .bcn-pill.is-active {
          opacity: 1;
        }

        /* Letra siempre centrada en el círculo; el nombre se abre a la derecha. */
        .bcn-pill__key {
          flex: 0 0 var(--bcn-pill);
          width: var(--bcn-pill);
          height: var(--bcn-pill);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* 0fr → 1fr: anima a ancho intrínseco sin medir en JS. */
        .bcn-pill__label {
          display: grid;
          grid-template-columns: 0fr;
          transition: grid-template-columns 320ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        .bcn-pill.is-active .bcn-pill__label {
          grid-template-columns: 1fr;
        }
        .bcn-pill__name {
          overflow: hidden;
          min-width: 0;
          white-space: nowrap;
          padding-right: 0;
          transition: padding-right 320ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
        .bcn-pill.is-active .bcn-pill__name {
          padding-right: 0.55em;
        }

        @media (prefers-reduced-motion: reduce) {
          .bcn-pill,
          .bcn-pill__label { transition: none; }
        }
      `}</style>
    </div>
  );
}
