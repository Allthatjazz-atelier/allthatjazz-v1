"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const FILTERS = [
  { id: "none",     label: "—",        value: null },
  { id: "invert",   label: "Invert",   value: "invert(1)" },
  { id: "hue180",   label: "Hue",      value: "hue-rotate(180deg) saturate(2)" },
  { id: "gray",     label: "Gray",     value: "saturate(0)" },
  { id: "sepia",    label: "Sepia",    value: "sepia(1) saturate(2)" },
  { id: "acid",     label: "Acid",     value: "hue-rotate(90deg) saturate(3) contrast(1.2)" },
  { id: "matrix",   label: "Matrix",   value: "invert(1) hue-rotate(90deg)" },
  { id: "noir",     label: "Noir",     value: "contrast(3) saturate(0)" },
  { id: "psycho",   label: "Psycho",   value: "hue-rotate(270deg) saturate(4)" },
];

export default function BerlinClock4() {
  const [time, setTime]         = useState("");
  // filter = filtro aplicado definitivamente
  // previewFilter = filtro mostrado en hover (temporal)
  const [filter, setFilter]     = useState(null);
  const [previewFilter, setPreviewFilter] = useState(undefined); // undefined = sin preview activo
  const [open, setOpen]         = useState(false);
  const [active, setActive]     = useState("none");
  const [spin, setSpin]         = useState(false);
  const wrapRef                 = useRef(null);

  // El filtro visible en pantalla: preview tiene prioridad si está activo
  const visibleFilter = previewFilter !== undefined ? previewFilter : filter;

  // ── Reloj ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => setTime(
      new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date())
    );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Cerrar al click fuera ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setPreviewFilter(undefined); // limpiar preview al cerrar
      }
    };
    const t = setTimeout(() => document.addEventListener("click", handler), 150);
    return () => { clearTimeout(t); document.removeEventListener("click", handler); };
  }, [open]);

  // ── Avatar click ───────────────────────────────────────────────────────────
  const handleAvatarClick = useCallback(() => {
    setSpin(false);
    requestAnimationFrame(() => setSpin(true));
    setOpen(v => !v);
    if (open) setPreviewFilter(undefined);
  }, [open]);

  // ── Seleccionar filtro definitivamente ────────────────────────────────────
  const handleSelect = useCallback((f) => {
    setFilter(f.value);
    setActive(f.id);
    setPreviewFilter(undefined);
    setOpen(false);
  }, []);

  // ── Hover: preview temporal ───────────────────────────────────────────────
  const handleHoverEnter = useCallback((f) => {
    setPreviewFilter(f.value ?? null);
  }, []);

  const handleHoverLeave = useCallback(() => {
    setPreviewFilter(undefined); // vuelve al filtro activo
  }, []);

  return (
    <>
      {/* Overlay global — usa visibleFilter para mostrar preview o definitivo */}
      {visibleFilter !== null && visibleFilter !== undefined && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          pointerEvents: "none",
          backdropFilter:       visibleFilter,
          WebkitBackdropFilter: visibleFilter,
          // Transición rápida en hover, más suave al confirmar
          transition: previewFilter !== undefined
            ? "backdrop-filter 0.12s ease"
            : "backdrop-filter 0.5s ease",
        }} />
      )}

      {/* Wrapper completo */}
      <div
        ref={wrapRef}
        style={{
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           "8px",
          pointerEvents: "auto",
        }}
      >
        {/* Fila del reloj */}
        <div className="flex items-center gap-1 text-[0.875rem] text-black tabular-nums">
          <span>Berlin, {time}</span>
          <img
            src="/avatar/✦.svg"
            alt="filtros"
            onClick={handleAvatarClick}
            onAnimationEnd={() => setSpin(false)}
            style={{
              width: "14px", height: "14px",
              cursor: "pointer",
              transformOrigin: "center",
              animation: spin
                ? "spin360 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards"
                : "none",
            }}
          />
        </div>

        {/* Cápsulas de filtros */}
        {open && (
          <div
            style={{
              display:        "flex",
              flexWrap:       "wrap",
              justifyContent: "center",
              gap:            "5px",
              maxWidth:       "320px",
            }}
          >
            {FILTERS.map((f, i) => {
              const isActive = active === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => handleSelect(f)}
                  onMouseEnter={() => handleHoverEnter(f)}
                  onMouseLeave={handleHoverLeave}
                  style={{
                    fontFamily:    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    fontSize:      "0.75rem",
                    fontWeight:    500,
                    letterSpacing: "-0.03em",
                    lineHeight:    1,
                    color:         isActive ? "#fff" : "#111",
                    padding:       "5px 10px",
                    borderRadius:  "999px",
                    border:        isActive
                      ? "1px solid #111"
                      : "1px solid rgba(0,0,0,0.15)",
                    background:    isActive
                      ? "#111"
                      : "rgba(255,255,255,0.45)",
                    backdropFilter:       "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    cursor:     "pointer",
                    transition: "background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s",
                    transform:  isActive ? "scale(1.05)" : "scale(1)",
                    // Animación blur-to-sharp escalonada por índice
                    animation:          `blurIn 0.45s cubic-bezier(0.22,1,0.36,1) both`,
                    animationDelay:     `${i * 0.04}s`,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin360 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Blur máximo → nítido, con ligero desplazamiento hacia arriba */
        @keyframes blurIn {
          0%   {
            opacity: 0;
            filter: blur(18px);
            transform: translateY(4px) scale(0.96);
          }
          60%  {
            opacity: 1;
            filter: blur(4px);
            transform: translateY(1px) scale(0.99);
          }
          100% {
            opacity: 1;
            filter: blur(0px);
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}