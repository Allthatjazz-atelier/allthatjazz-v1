"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function RoundedAnimatedSlider2({ images = [] }) {
  const containerRef = useRef(null);
  const [radius, setRadius] = useState(250);
  const rotationRef = useRef(0);
  const mousePos = useRef({ x: 0, y: 0 });

  // Ajusta el radio según el tamaño de la ventana
  useEffect(() => {
    const updateRadius = () => {
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      setRadius(minDimension / 2.5);
    };
    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const imgs = container.querySelectorAll(".photo");
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Inicializa mousePos en el centro
    mousePos.current = { x: centerX, y: centerY };

    // Posiciona cada imagen en círculo respecto al centro
    imgs.forEach((img, i) => {
      const angle = (i / imgs.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      gsap.set(img, {
        position: "absolute",
        top: "50%",
        left: "50%",
        xPercent: -50,
        yPercent: -50,
        x,
        y,
        transformOrigin: "center center",
        scale: 0.6,
        opacity: 0,
        zIndex: 1,
      });
    });

    const maxVisible = 250;

    // 🔄 ANIMACIÓN CONTINUA: Rotación + Reveal basado en cursor
    const animate = () => {
      rotationRef.current += 0.3; // Velocidad reducida de 0.5 a 0.3
      
      imgs.forEach((img, i) => {
        const baseAngle = (i / imgs.length) * Math.PI * 2;
        const currentAngle = baseAngle + (rotationRef.current * Math.PI / 180);
        const x = Math.cos(currentAngle) * radius;
        const y = Math.sin(currentAngle) * radius;

        // Actualiza posición (rotación)
        gsap.set(img, { x, y });

        // Calcula distancia al cursor para reveal
        const imgX = centerX + x;
        const imgY = centerY + y;
        const dx = imgX - mousePos.current.x;
        const dy = imgY - mousePos.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxVisible) {
          gsap.to(img, {
            opacity: 0,
            scale: 0.5,
            zIndex: 0,
            duration: 0.35,
            ease: "expo.out",
          });
        } else {
          const scale = gsap.utils.mapRange(0, maxVisible, 1.8, 0.8, dist);
          const zIndex = Math.round(
            gsap.utils.mapRange(0, maxVisible, 10, 1, dist)
          );

          gsap.to(img, {
            opacity: 1,
            scale,
            zIndex,
            duration: 0.45,
            ease: "expo.out",
          });
        }
      });

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    const handleMove = (e) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", handleMove);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("mousemove", handleMove);
    };
  }, [images, radius]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen flex items-center justify-center overflow-hidden bg-white"
    >
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          className="photo absolute object-contain"
          alt={`photo-${i}`}
          style={{
            width: "18vw",
            height: "18vh",
            maxWidth: "250px",
            maxHeight: "250px",
          }}
        />
      ))}
    </div>
  );
}