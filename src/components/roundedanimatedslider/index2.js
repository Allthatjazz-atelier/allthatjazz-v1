"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function RoundedAnimatedSlider2({ images = [] }) {
  const containerRef = useRef(null);
  const [radius, setRadius] = useState(250);

  // Ajusta el radio según el tamaño de la ventana
  useEffect(() => {
    const updateRadius = () => {
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      setRadius(minDimension / 3); // 1/3 de la pantalla
    };
    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const imgs = container.querySelectorAll(".photo");

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

    let highlightVisible = false;
    const maxVisible = 200;
    let highlightEnabled = true;

    const headerFooter = document.querySelector(".HeaderFooter");
    if (headerFooter) {
      headerFooter.addEventListener("mouseenter", () => {
        highlightEnabled = false;
        if (highlightVisible) {
          window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
          highlightVisible = false;
        }
      });
      headerFooter.addEventListener("mouseleave", () => {
        highlightEnabled = true;
      });
    }

    const handleMove = (e) => {
      if (!highlightEnabled) return;

      let anyVisible = false;

      imgs.forEach((img) => {
        const rect = img.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - e.clientX;
        const dy = rect.top + rect.height / 2 - e.clientY;
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
          anyVisible = true;
          const scale = gsap.utils.mapRange(0, maxVisible, 1.6, 0.7, dist);
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

      if (anyVisible && !highlightVisible) {
        window.dispatchEvent(
          new CustomEvent("cursor:showHighlight", {
            detail: { text: "highlights" },
          })
        );
        highlightVisible = true;
      }

      if (!anyVisible && highlightVisible) {
        window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
        highlightVisible = false;
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
      if (headerFooter) {
        headerFooter.removeEventListener("mouseenter", () => {});
        headerFooter.removeEventListener("mouseleave", () => {});
      }
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
            width: "clamp(80px, 13vw, 180px)", // tamaño responsivo
          }}
        />
      ))}
    </div>
  );
}
