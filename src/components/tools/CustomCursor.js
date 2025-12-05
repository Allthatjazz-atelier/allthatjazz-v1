"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function CustomCursor() {
  const dotRef = useRef(null);
  const labelRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Detectar si es desktop (768px = breakpoint md de Tailwind)
    const checkDesktop = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      
      // Solo ocultar cursor nativo en desktop
      if (desktop) {
        document.documentElement.style.cursor = "none";
      } else {
        document.documentElement.style.cursor = "";
      }
    };
    
    checkDesktop();
    window.addEventListener("resize", checkDesktop);

    // Si no es desktop, no hacemos nada más
    if (!isDesktop) {
      return () => {
        window.removeEventListener("resize", checkDesktop);
      };
    }

    const dot = dotRef.current;
    const label = labelRef.current;

    // Inicial
    gsap.set(dot, { x: 0, y: 0, scale: 1, opacity: 1, transformOrigin: "center center" });
    gsap.set(label, { x: 0, y: 0, opacity: 0, scale: 0.95, transformOrigin: "center center" });

    // Seguir ratón (suavizado con gsap)
    const onMove = (e) => {
      gsap.to([dot, label], { x: e.clientX, y: e.clientY, duration: 0.12, ease: "power2.out" });
    };

    // Mostrar label (y "esconder" el punto) — recibe texto opcional
    const show = (evt) => {
      const text = evt?.detail?.text ?? "highlights";
      if (!label) return;
      label.textContent = text;

      gsap.killTweensOf(label);
      gsap.to(label, { opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" });
      gsap.to(dot, { opacity: 0, scale: 0.6, duration: 0.12, ease: "power2.out" });
    };

    // Ocultar label y volver a punto negro
    const hide = () => {
      gsap.killTweensOf(label);
      gsap.to(label, { opacity: 0, scale: 0.95, duration: 0.15, ease: "power2.out" });
      gsap.to(dot, { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("cursor:showHighlight", show);
    window.addEventListener("cursor:hideHighlight", hide);

    return () => {
      window.removeEventListener("resize", checkDesktop);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("cursor:showHighlight", show);
      window.removeEventListener("cursor:hideHighlight", hide);
      // restaurar cursor nativo
      document.documentElement.style.cursor = "";
    };
  }, [isDesktop]);

  // Si no es desktop, no renderizamos nada
  if (!isDesktop) {
    return null;
  }

  return (
    <>
      {/* Dot (cursor por defecto) */}
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#000",
          pointerEvents: "none",
          zIndex: 9999,
          transform: "translate(-50%, -50%)",
          willChange: "transform, opacity",
          backgroundColor: "white",
          mixBlendMode: "difference",
        }}
      />

      {/* Label (hidden por defecto) */}
      <div
        ref={labelRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 9999,
          transform: "translate(-50%, -50%)",
          fontSize: 18,
          color: "white",
          mixBlendMode: "difference",
          whiteSpace: "nowrap",
          willChange: "transform, opacity",
        }}
      />
    </>
  );
}