"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Todos los filtros en formato compuesto normalizado:
// hue-rotate() saturate() contrast() invert() sepia()
// Así el browser puede interpolar entre cualquier par de valores.
const FILTERS = [
  { id: "none",     label: "—",       value: "hue-rotate(0deg)   saturate(1)   contrast(1)   invert(0)   sepia(0)" },
  { id: "invert",   label: "Invert",  value: "hue-rotate(0deg)   saturate(1)   contrast(1)   invert(1)   sepia(0)" },
  { id: "hue180",   label: "Hue",     value: "hue-rotate(180deg) saturate(2)   contrast(1)   invert(0)   sepia(0)" },
  { id: "gray",     label: "Gray",    value: "hue-rotate(0deg)   saturate(0)   contrast(1)   invert(0)   sepia(0)" },
  { id: "sepia",    label: "Sepia",   value: "hue-rotate(0deg)   saturate(2)   contrast(1)   invert(0)   sepia(1)" },
  { id: "acid",     label: "Acid",    value: "hue-rotate(90deg)  saturate(3)   contrast(1.2) invert(0)   sepia(0)" },
  { id: "matrix",   label: "Matrix",  value: "hue-rotate(90deg)  saturate(1)   contrast(1)   invert(1)   sepia(0)" },
  { id: "noir",     label: "Noir",    value: "hue-rotate(0deg)   saturate(0)   contrast(3)   invert(0)   sepia(0)" },
  { id: "psycho",   label: "Psycho",  value: "hue-rotate(270deg) saturate(4)   contrast(1)   invert(0)   sepia(0)" },
];

const NONE_FILTER = FILTERS[0].value;

export default function BerlinClock5() {
  const [time, setTime]           = useState("");
  const [open, setOpen]           = useState(false);
  const [active, setActive]       = useState("none");
  const [spin, setSpin]           = useState(false);

  // Dos overlays para crossfade suave
  const [overlayA, setOverlayA]   = useState({ filter: NONE_FILTER, opacity: 0 });
  const [overlayB, setOverlayB]   = useState({ filter: NONE_FILTER, opacity: 0 });
  const [topLayer, setTopLayer]   = useState("A"); // cuál está encima
  const confirmedFilter           = useRef(NONE_FILTER);
  const leaveTimer                = useRef(null);

  const wrapRef = useRef(null);

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

  // ── Aplicar filtro en el overlay top con crossfade ────────────────────────
  const applyFilter = useCallback((filterValue, opacity) => {
    // El layer que no está encima recibe el nuevo filtro y sube su opacity,
    // mientras el anterior baja la suya.
    setTopLayer(prev => {
      if (prev === "A") {
        setOverlayB({ filter: filterValue, opacity });
        setOverlayA(a => ({ ...a, opacity: opacity === 0 ? 0 : 0 }));
        return "B";
      } else {
        setOverlayA({ filter: filterValue, opacity });
        setOverlayB(b => ({ ...b, opacity: 0 }));
        return "A";
      }
    });
  }, []);

  // ── Cerrar al click fuera ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
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
  }, []);

  // ── Confirmar filtro ──────────────────────────────────────────────────────
  const handleSelect = useCallback((f) => {
    confirmedFilter.current = f.value;
    setActive(f.id);
    setOpen(false);
    // Si es "none", bajar opacity
    if (f.id === "none") {
      setOverlayA({ filter: NONE_FILTER, opacity: 0 });
      setOverlayB({ filter: NONE_FILTER, opacity: 0 });
    }
  }, []);

  // ── Hover: preview con crossfade ──────────────────────────────────────────
  const handleHoverEnter = useCallback((f) => {
    clearTimeout(leaveTimer.current);
    applyFilter(f.value, f.id === "none" ? 0 : 1);
  }, [applyFilter]);

  const handleHoverLeave = useCallback(() => {
    // Pequeño delay para evitar flash al pasar entre cápsulas
    leaveTimer.current = setTimeout(() => {
      const cf = confirmedFilter.current;
      const isNone = cf === NONE_FILTER;
      applyFilter(cf, isNone ? 0 : 1);
    }, 80);
  }, [applyFilter]);

  // Cleanup timer
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const TRANSITION = "opacity 0.25s ease, backdrop-filter 0.35s ease";

  return (
    <>
      {/* Overlay A */}
      <div style={{
        position: "fixed", inset: 0, zIndex: topLayer === "A" ? 9999 : 9998,
        pointerEvents: "none",
        backdropFilter:       overlayA.filter,
        WebkitBackdropFilter: overlayA.filter,
        opacity:              overlayA.opacity,
        transition:           TRANSITION,
      }} />

      {/* Overlay B */}
      <div style={{
        position: "fixed", inset: 0, zIndex: topLayer === "B" ? 9999 : 9998,
        pointerEvents: "none",
        backdropFilter:       overlayB.filter,
        WebkitBackdropFilter: overlayB.filter,
        opacity:              overlayB.opacity,
        transition:           TRANSITION,
      }} />

      {/* Wrapper completo */}
      <div
        ref={wrapRef}
        style={{
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           "8px",
          pointerEvents: "auto",
          position:      "relative",
          zIndex:        10000,
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

        {/* Cápsulas */}
        {open && (
          <div style={{
            display:        "flex",
            flexWrap:       "wrap",
            justifyContent: "center",
            gap:            "5px",
            maxWidth:       "320px",
          }}>
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
                    border:        isActive ? "1px solid #111" : "1px solid rgba(0,0,0,0.15)",
                    background:    isActive ? "#111" : "rgba(255,255,255,0.45)",
                    backdropFilter:       "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    cursor:     "pointer",
                    transition: "background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s",
                    transform:  isActive ? "scale(1.05)" : "scale(1)",
                    animation:      "blurIn 0.45s cubic-bezier(0.22,1,0.36,1) both",
                    animationDelay: `${i * 0.04}s`,
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
        @keyframes blurIn {
          0%   { opacity: 0; filter: blur(18px); transform: translateY(4px) scale(0.96); }
          60%  { opacity: 1; filter: blur(4px);  transform: translateY(1px) scale(0.99); }
          100% { opacity: 1; filter: blur(0px);  transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}