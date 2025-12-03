"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Helpers
const getSrc = (img) => (typeof img === "string" ? img : img?.src || "");

const buildClipPaths = (rows, cols, type, overlap = 0.1) => {
  const stepX = 100 / cols;
  const stepY = 100 / rows;
  const paths = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x1 = c * stepX - overlap;
      const y1 = r * stepY - overlap;
      const x2 = (c + 1) * stepX;
      const y2 = (r + 1) * stepY;

      paths.push(
        type === "visible"
          ? `polygon(${x1}% ${y1}%, ${x2}% ${y1}%, ${x2}% ${y2}%, ${x1}% ${y2}%)`
          : `polygon(${x1}% ${y1}%, ${x1}% ${y1}%, ${x1}% ${y1}%, ${x1}% ${y1}%)`
      );
    }
  }
  return paths;
};

const makeOrder = (rows, cols, mode = "radial") => {
  const total = rows * cols;
  const indices = Array.from({ length: total }, (_, i) => i);

  if (mode !== "radial") return indices.map((i) => [i]); // fallback simple

  const centerR = (rows - 1) / 2;
  const centerC = (cols - 1) / 2;

  const distances = indices.map((i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return { i, dist: Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2) };
  });

  // agrupar por distancia (redondeamos para evitar decimales)
  const groupsMap = new Map();
  distances.forEach(({ i, dist }) => {
    const key = Math.round(dist * 10) / 10; // redondeo a 0.1
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key).push(i);
  });

  // devolver array de grupos ordenados por distancia ascendente
  return Array.from(groupsMap.keys())
    .sort((a, b) => a - b)
    .map((k) => groupsMap.get(k));
};


export default function GridRevealImage2({
  src,
  rows = 8,
  cols = 8,
  className = "",
  style,
  trigger = "self",
  order = "diagonal",
  duration = 0.3,
  stagger = 0.005,
  ease = "power2.out",
  overlap = 0.1,
  groupOffset = 0.01,
  start = "top 80%",
  once = true,
  onComplete,
}) {
  const wrapRef = useRef(null);
  const tlRef = useRef(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (once && hasAnimatedRef.current) return;

    let mounted = true;

    (async () => {
      const { default: ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (!mounted || !wrapRef.current) return;

      const wrap = wrapRef.current;
      const masks = wrap.querySelectorAll(".mask");
      const hidden = buildClipPaths(rows, cols, "hidden", overlap);
      const visible = buildClipPaths(rows, cols, "visible", overlap);

      // Inicialmente oculta cada máscara
      masks.forEach((mask, idx) =>
        gsap.set(mask, { clipPath: hidden[idx], willChange: "clip-path" })
      );

      const groups = makeOrder(rows, cols, order);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: trigger === "self" ? wrap : document.querySelector(trigger),
          start,
          once,
          immediateRender: false,
        },
        onComplete: () => {
          if (once) hasAnimatedRef.current = true;
          onComplete?.();
        },
      });

      // 🔹 Hacer visible el contenedor antes de animar las máscaras
      tl.set(wrap, { opacity: 1, duration: 0 });

      // Animación de las máscaras
      groups.forEach((group, groupIndex) => {
        const elements = group
          .map((idx) => wrap.querySelector(`.mask${idx}`))
          .filter(Boolean);

          tl.to(
            elements,
            {
              clipPath: (i, el) => visible[Number(el.dataset.index)],
              duration,
              ease,
              stagger,
              opacity: 1,
              scale: 1.05,
              transformOrigin: "center center",
              overwrite: "auto",
            },
            groupIndex * groupOffset
          );
          
      });

      tlRef.current = tl;
    })();

    return () => {
      mounted = false;
      if (tlRef.current) {
        tlRef.current.kill();
        tlRef.current = null;
      }
      if (wrapRef.current) {
        gsap.killTweensOf(wrapRef.current.querySelectorAll(".mask"));
      }
    };
  }, [
    rows,
    cols,
    trigger,
    order,
    duration,
    stagger,
    ease,
    overlap,
    groupOffset,
    start,
    once,
    onComplete,
  ]);

  const resolvedSrc = getSrc(src);
  const total = rows * cols;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden opacity-0 ${className}`}
      style={style}
    >
      {Array.from({ length: total }).map((_, j) => (
        <div
          key={j}
          className={`mask mask${j} absolute inset-0 bg-center bg-cover`}
          data-index={j}
          style={{ backgroundImage: `url(${resolvedSrc})` }}
        />
      ))}
    </div>
  );
}
