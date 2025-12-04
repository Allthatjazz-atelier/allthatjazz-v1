"use client";
import { useEffect, useRef, useState } from "react";

export default function RoundedAnimatedSlider6({ images = [] }) {
  const containerRef = useRef(null);
  const [radius, setRadius] = useState(250);
  const animationsRef = useRef([]);
  const mouseInsideRef = useRef(false);

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
    const isMobile = window.innerWidth < 768;

    // Posiciona cada imagen en una elipse dinámica
    imgs.forEach((img, i) => {
      const angle = (i / imgs.length) * Math.PI * 2;
      const x = Math.cos(angle) * radius * 1.4;
      const y = Math.sin(angle) * radius * 0.8;

      // Optimización GPU: usar transform y opacity
      img.style.position = "absolute";
      img.style.top = "50%";
      img.style.left = "50%";
      img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(0.6)`;
      img.style.transformOrigin = "center center";
      img.style.opacity = "0";
      img.style.zIndex = "1";
      img.style.transition = "all 0.45s cubic-bezier(0.19, 1, 0.22, 1)";
    });

    const maxVisible = 200;

    // LÓGICA PARA MÓVIL: Animación automática con focos aleatorios
    if (isMobile) {
      const animateMobileClusters = () => {
        // Generar 1-2 puntos focales aleatorios en la pantalla
        const numFoci = Math.floor(Math.random() * 2) + 1; // 1 o 2 focos
        const foci = [];
        
        for (let i = 0; i < numFoci; i++) {
          foci.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          });
        }

        imgs.forEach((img) => {
          const rect = img.getBoundingClientRect();
          const imgCenterX = rect.left + rect.width / 2;
          const imgCenterY = rect.top + rect.height / 2;

          // Calcular la distancia al foco más cercano
          let minDist = Infinity;
          foci.forEach((focus) => {
            const dx = imgCenterX - focus.x;
            const dy = imgCenterY - focus.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            minDist = Math.min(minDist, dist);
          });

          // Revelar imágenes según proximidad al foco más cercano
          const maxDistMobile = maxVisible;
          if (minDist > maxDistMobile) {
            img.style.opacity = "0";
            img.style.transform = `translate(-50%, -50%) translate(${
              parseFloat(img.dataset.x) || 0
            }px, ${parseFloat(img.dataset.y) || 0}px) scale(0.5)`;
            img.style.zIndex = "0";
          } else {
            const scale = Math.max(
              0.6,
              1.6 - (minDist / maxDistMobile) * 1.0
            );
            const zIndex = Math.max(
              1,
              Math.round(10 - (minDist / maxDistMobile) * 9)
            );

            // Guardar posición para mantener la transformación
            const angle = (Array.from(imgs).indexOf(img) / imgs.length) * Math.PI * 2;
            const x = Math.cos(angle) * radius * 1.4;
            const y = Math.sin(angle) * radius * 0.8;
            img.dataset.x = x;
            img.dataset.y = y;

            // Opacidad completa para móvil
            img.style.opacity = "1";
            img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
            img.style.zIndex = zIndex.toString();
          }
        });
      };

      // Ejecutar la animación cada 2-4 segundos
      const mobileInterval = setInterval(() => {
        animateMobileClusters();
      }, 2500 + Math.random() * 1500);

      // Primera ejecución
      setTimeout(animateMobileClusters, 500);

      // Cleanup para móvil
      return () => {
        clearInterval(mobileInterval);
      };
    }

    // LÓGICA PARA DESKTOP: Interacción con mouse
    const handleContainerEnter = () => {
      mouseInsideRef.current = true;
    };

    const handleContainerLeave = () => {
      mouseInsideRef.current = false;
      
      // Ocultar todas las imágenes cuando el mouse sale
      imgs.forEach((img) => {
        img.style.opacity = "0";
        img.style.transform = `translate(-50%, -50%) translate(${
          parseFloat(img.dataset.x) || 0
        }px, ${parseFloat(img.dataset.y) || 0}px) scale(0.5)`;
        img.style.zIndex = "0";
      });
    };

    const handleMove = (e) => {
      // No procesar si el mouse no está dentro del contenedor
      if (!mouseInsideRef.current) {
        return;
      }

      imgs.forEach((img) => {
        const rect = img.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - e.clientX;
        const dy = rect.top + rect.height / 2 - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Guardar posición para mantener la transformación
        const angle = (Array.from(imgs).indexOf(img) / imgs.length) * Math.PI * 2;
        const x = Math.cos(angle) * radius * 1.4;
        const y = Math.sin(angle) * radius * 0.8;
        img.dataset.x = x;
        img.dataset.y = y;

        if (dist > maxVisible) {
          img.style.opacity = "0";
          img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(0.5)`;
          img.style.zIndex = "0";
        } else {
          const scale = Math.max(0.7, 1.6 - (dist / maxVisible) * 0.9);
          const zIndex = Math.max(1, Math.round(10 - (dist / maxVisible) * 9));

          img.style.opacity = "1";
          img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
          img.style.zIndex = zIndex.toString();
        }
      });
    };

    if (!isMobile) {
      // Event listeners solo para desktop
      container.addEventListener("mouseenter", handleContainerEnter);
      container.addEventListener("mouseleave", handleContainerLeave);
      window.addEventListener("mousemove", handleMove);

      // Cleanup
      return () => {
        container.removeEventListener("mouseenter", handleContainerEnter);
        container.removeEventListener("mouseleave", handleContainerLeave);
        window.removeEventListener("mousemove", handleMove);
      };
    }
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