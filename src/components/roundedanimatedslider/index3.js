"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function RoundedAnimatedSlider3({ images = [] }) {
  const containerRef = useRef(null);
  const [radius, setRadius] = useState(250);
  const animationsRef = useRef([]);
  const mouseInsideRef = useRef(false);
  const highlightVisibleRef = useRef(false);

  // Ajusta el radio según el tamaño de la ventana
  useEffect(() => {
    const updateRadius = () => {
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      setRadius(minDimension / 3);
    };
    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const imgs = container.querySelectorAll(".photo");
    const ctx = gsap.context(() => {}, container);

    // Variables CSS para la elipse dinámica
    container.style.setProperty("--ellipseX", "1.4");
    container.style.setProperty("--ellipseY", "0.8");

    // Animación de "respiración" elíptica con will-change para GPU
    const breathAnimation = gsap.to(container, {
      "--ellipseX": 1.6,
      "--ellipseY": 0.7,
      duration: 6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });

    animationsRef.current.push(breathAnimation);

    // Posiciona cada imagen en una elipse dinámica
    imgs.forEach((img, i) => {
      const angle = (i / imgs.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius * 1.4;
      const y = Math.sin(angle) * radius * 0.8;

      // Optimización GPU: usar transform y opacity
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
        force3D: true, // Fuerza aceleración 3D
        willChange: "transform, opacity", // Optimización GPU
      });
    });

    const maxVisible = 200;
    let highlightEnabled = true;

    const headerFooter = document.querySelector(".HeaderFooter");

    const disableHighlight = () => {
      highlightEnabled = false;
      
      // Ocultar TODAS las imágenes inmediatamente
      imgs.forEach((img) => {
        gsap.to(img, {
          opacity: 0,
          scale: 0.5,
          zIndex: 0,
          duration: 0.2,
          ease: "expo.out",
          force3D: true,
        });
      });
      
      if (highlightVisibleRef.current) {
        window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
        highlightVisibleRef.current = false;
      }
    };

    const enableHighlight = () => {
      highlightEnabled = true;
    };

    if (headerFooter) {
      headerFooter.addEventListener("mouseenter", disableHighlight);
      headerFooter.addEventListener("mouseleave", enableHighlight);
    }

    // Detectar si el mouse está dentro del contenedor
    const handleContainerEnter = () => {
      mouseInsideRef.current = true;
    };

    const handleContainerLeave = () => {
      mouseInsideRef.current = false;
      
      // Ocultar todas las imágenes cuando el mouse sale
      imgs.forEach((img) => {
        gsap.to(img, {
          opacity: 0,
          scale: 0.5,
          zIndex: 0,
          duration: 0.35,
          ease: "expo.out",
          force3D: true,
        });
      });

      // Ocultar highlight
      if (highlightVisibleRef.current) {
        window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
        highlightVisibleRef.current = false;
      }
    };

    const handleMove = (e) => {
      // No procesar si no está habilitado
      if (!highlightEnabled) {
        // Si highlight está deshabilitado, forzar ocultar todas las imágenes
        imgs.forEach((img) => {
          gsap.to(img, {
            opacity: 0,
            scale: 0.5,
            zIndex: 0,
            duration: 0.2,
            ease: "expo.out",
            force3D: true,
          });
        });
        
        if (highlightVisibleRef.current) {
          window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
          highlightVisibleRef.current = false;
        }
        return;
      }

      // No procesar si el mouse no está dentro del contenedor
      if (!mouseInsideRef.current) {
        imgs.forEach((img) => {
          gsap.to(img, {
            opacity: 0,
            scale: 0.5,
            zIndex: 0,
            duration: 0.2,
            ease: "expo.out",
            force3D: true,
          });
        });
        
        if (highlightVisibleRef.current) {
          window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
          highlightVisibleRef.current = false;
        }
        return;
      }

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
            force3D: true,
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
            force3D: true,
          });
        }
      });

      if (anyVisible && !highlightVisibleRef.current) {
        window.dispatchEvent(
          new CustomEvent("cursor:showHighlight", {
            detail: { text: "highlights" },
          })
        );
        highlightVisibleRef.current = true;
      }

      if (!anyVisible && highlightVisibleRef.current) {
        window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
        highlightVisibleRef.current = false;
      }
    };

    // Event listeners
    container.addEventListener("mouseenter", handleContainerEnter);
    container.addEventListener("mouseleave", handleContainerLeave);
    window.addEventListener("mousemove", handleMove);

    // Cleanup
    return () => {
      container.removeEventListener("mouseenter", handleContainerEnter);
      container.removeEventListener("mouseleave", handleContainerLeave);
      window.removeEventListener("mousemove", handleMove);
      
      // Limpiar animaciones GSAP
      animationsRef.current.forEach((anim) => anim.kill());
      animationsRef.current = [];
      ctx.revert();
      
      // Limpiar highlight
      window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
      
      if (headerFooter) {
        headerFooter.removeEventListener("mouseenter", disableHighlight);
        headerFooter.removeEventListener("mouseleave", enableHighlight);
      }

      // Remover will-change para liberar recursos
      imgs.forEach((img) => {
        img.style.willChange = "auto";
      });
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
            width: "clamp(80px, 13vw, 180px)",
          }}
        />
      ))}
    </div>
  );
}