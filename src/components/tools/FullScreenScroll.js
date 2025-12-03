"use client";
import { useEffect, useRef } from "react";

export default function FullScreenScroll({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let gsap, ScrollTrigger;

    (async () => {
      // Importamos gsap dinámicamente para Next.js
      const gsapModule = await import("gsap");
      gsap = gsapModule.gsap;
      const stModule = await import("gsap/dist/ScrollTrigger");
      ScrollTrigger = stModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      const container = containerRef.current;
      const sections = container.querySelectorAll(".section");

      // Establecemos altura de cada sección a 100vh para full-page
      sections.forEach((sec) => {
        sec.style.height = "100vh";
      });

      // Creamos la animación de scroll flip
      gsap.to(sections, {
        yPercent: -100 * (sections.length - 1),
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: 0,
          end: () => "+=" + container.offsetHeight,
          pin: true,
          scrub: false,             // ✨ Flip inmediato
          snap: 1 / (sections.length - 1), // ✨ Snap a cada sección
          invalidateOnRefresh: true, // recalcula en resize
        },
      });

      // Refrescamos ScrollTrigger al cambiar el tamaño
      ScrollTrigger.refresh();
    })();
  }, []);

  return (
    <div ref={containerRef}>
      {children.map((child, i) => (
        <div key={i} className="section">
          {child}
        </div>
      ))}
    </div>
  );
}
