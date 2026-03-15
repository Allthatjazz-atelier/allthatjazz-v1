"use client";

import { useEffect, useRef, useState } from "react";

// backdrop-filter se aplica a lo que hay DETRÁS del overlay
// El HeaderFooter (z-9999) está por encima del overlay (z-9998) → inmune
const FILTERS = [
  null,
  "invert(1)",
  "hue-rotate(180deg) saturate(2)",
  "saturate(0)",
  "sepia(1) saturate(2)",
  "hue-rotate(90deg) saturate(3) contrast(1.2)",
  "invert(1) hue-rotate(90deg)",
  "contrast(3) saturate(0)",
  "hue-rotate(270deg) saturate(4)",
];

export default function BerlinClock() {
  const [time, setTime]         = useState("");
  const [filter, setFilter]     = useState(null); // null = sin overlay
  const currentFilter           = useRef(null);

  // ── Reloj ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const updateTime = () => {
      const berlinTime = new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }).format(new Date());
      setTime(berlinTime);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Click: filtro random distinto al actual ────────────────────────────────
  const handleClick = () => {
    const options = FILTERS.filter(f => f !== currentFilter.current);
    const next = options[Math.floor(Math.random() * options.length)];
    currentFilter.current = next;
    setFilter(next);
  };

  return (
    <>
      {/* Overlay de filtro — z-9998, por debajo del HeaderFooter (z-9999) */}
      {filter && (
        <div
          style={{
            position:       "fixed",
            inset:          0,
            zIndex:         9998,
            pointerEvents:  "none",
            backdropFilter: filter,
            WebkitBackdropFilter: filter,
            transition:     "backdrop-filter 0.6s ease",
          }}
        />
      )}

      <div className="flex items-center gap-1 text-[0.875rem] text-black tabular-nums">
        <span>Berlin, {time}</span>
        <img
          src="/avatar/✦.svg"
          alt="avatar"
          onClick={handleClick}
          className="w-[14px] h-[14px] pointer-events-auto transition-transform duration-700 ease-in-out hover:rotate-[360deg] cursor-pointer"
          style={{ transformOrigin: "center" }}
        />
      </div>
    </>
  );
}