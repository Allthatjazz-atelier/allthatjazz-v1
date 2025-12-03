"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function ClipRevealImage({ src, className = "", style, duration = 0.8 }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current) return;

    const img = wrapRef.current.querySelector("img");

    // Inicialmente oculto
    gsap.set(img, { clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)" });

    // Animación al hacer scroll
    gsap.to(img, {
      clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
      ease: "power2.out",
      duration, // más rápido que antes
      scrollTrigger: {
        trigger: wrapRef.current,
        start: "center center",
        toggleActions: "play none none none",
      },
    });
  }, [src, duration]);

  return (
    <div
      ref={wrapRef}
      className={`image-reveal-wrap relative overflow-hidden ${className}`}
      style={{ backgroundColor: "#000", ...style }} // fondo negro mientras se revela
    >
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}
