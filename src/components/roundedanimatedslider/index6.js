"use client";
import { useEffect, useRef, useState } from "react";

export default function RoundedAnimatedSlider6({ images = [] }) {
  const containerRef = useRef(null);
  const [radius, setRadius] = useState(250);
  const [isMobile, setIsMobile] = useState(false);
  const mouseInsideRef = useRef(false);

  // Ajusta el radio según el tamaño de la ventana
  useEffect(() => {
    const updateRadius = () => {
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      setRadius(minDimension / 3);
      setIsMobile(window.innerWidth < 768);
    };
    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const imgs = container.querySelectorAll(".photo");
    const checkMobile = window.innerWidth < 768;

    // LÓGICA PARA MÓVIL: Clusters apilados con foto destacada
    if (checkMobile) {
      // Distribuir imágenes por toda la pantalla de forma aleatoria
      imgs.forEach((img) => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;
        
        img.style.position = "absolute";
        img.style.left = `${x}px`;
        img.style.top = `${y}px`;
        img.style.transform = "translate(-50%, -50%) scale(0.5)";
        img.style.transformOrigin = "center center";
        img.style.opacity = "0";
        img.style.zIndex = "1";
        img.style.transition = "all 0.6s cubic-bezier(0.19, 1, 0.22, 1)";
        
        // Guardar posición original
        img.dataset.x = x;
        img.dataset.y = y;
      });

      const animateMobileClusters = () => {
        // Generar 1-2 puntos focales (clusters)
        const numClusters = Math.floor(Math.random() * 2) + 1;
        const clusters = [];
        
        for (let i = 0; i < numClusters; i++) {
          clusters.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            radius: 180 + Math.random() * 120, // Radio del cluster variable
          });
        }

        // Encontrar la imagen más cercana a cada cluster para destacarla
        const featuredImages = new Set();
        clusters.forEach((cluster) => {
          let closestImg = null;
          let minDist = Infinity;
          
          imgs.forEach((img) => {
            const imgX = parseFloat(img.dataset.x);
            const imgY = parseFloat(img.dataset.y);
            const dx = imgX - cluster.x;
            const dy = imgY - cluster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDist) {
              minDist = dist;
              closestImg = img;
            }
          });
          
          if (closestImg) {
            featuredImages.add(closestImg);
          }
        });

        // Animar todas las imágenes según su distancia a los clusters
        imgs.forEach((img) => {
          const imgX = parseFloat(img.dataset.x);
          const imgY = parseFloat(img.dataset.y);

          // Calcular distancia al cluster más cercano
          let minDist = Infinity;
          let closestCluster = null;
          
          clusters.forEach((cluster) => {
            const dx = imgX - cluster.x;
            const dy = imgY - cluster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDist) {
              minDist = dist;
              closestCluster = cluster;
            }
          });

          const isFeature = featuredImages.has(img);

          // Si está dentro del radio del cluster
          if (minDist < closestCluster.radius) {
            if (isFeature) {
              // Imagen destacada: más grande, al frente
              img.style.opacity = "1";
              img.style.transform = "translate(-50%, -50%) scale(1.3)";
              img.style.zIndex = "100";
            } else {
              // Imágenes del cluster: apiladas detrás, todas con misma opacidad
              const distRatio = minDist / closestCluster.radius;
              const scale = 0.7 + (1 - distRatio) * 0.3; // 0.7 - 1.0
              const zIndex = Math.max(1, Math.round((1 - distRatio) * 20));
              
              img.style.opacity = "1";
              img.style.transform = `translate(-50%, -50%) scale(${scale})`;
              img.style.zIndex = zIndex.toString();
            }
          } else {
            // Fuera del cluster: ocultar
            img.style.opacity = "0";
            img.style.transform = "translate(-50%, -50%) scale(0.5)";
            img.style.zIndex = "0";
          }
        });
      };

      // Ejecutar la animación cada 2.5-4 segundos
      const mobileInterval = setInterval(() => {
        animateMobileClusters();
      }, 2500 + Math.random() * 1500);

      // Primera ejecución después de un delay
      setTimeout(animateMobileClusters, 500);

      // Cleanup para móvil
      return () => {
        clearInterval(mobileInterval);
      };
    }

    // LÓGICA PARA DESKTOP: Distribución circular con interacción de mouse
    if (!checkMobile) {
      // Posiciona cada imagen en una elipse
      imgs.forEach((img, i) => {
        const angle = (i / imgs.length) * Math.PI * 2;
        const x = Math.cos(angle) * radius * 1.4;
        const y = Math.sin(angle) * radius * 0.8;

        img.style.position = "absolute";
        img.style.top = "50%";
        img.style.left = "50%";
        img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(0.6)`;
        img.style.transformOrigin = "center center";
        img.style.opacity = "0";
        img.style.zIndex = "1";
        img.style.transition = "all 0.45s cubic-bezier(0.19, 1, 0.22, 1)";
        
        img.dataset.x = x;
        img.dataset.y = y;
      });

      const maxVisible = 200;

      const handleContainerEnter = () => {
        mouseInsideRef.current = true;
      };

      const handleContainerLeave = () => {
        mouseInsideRef.current = false;
        
        imgs.forEach((img) => {
          img.style.opacity = "0";
          img.style.transform = `translate(-50%, -50%) translate(${
            parseFloat(img.dataset.x) || 0
          }px, ${parseFloat(img.dataset.y) || 0}px) scale(0.5)`;
          img.style.zIndex = "0";
        });
      };

      const handleMove = (e) => {
        if (!mouseInsideRef.current) return;

        imgs.forEach((img) => {
          const rect = img.getBoundingClientRect();
          const dx = rect.left + rect.width / 2 - e.clientX;
          const dy = rect.top + rect.height / 2 - e.clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const x = parseFloat(img.dataset.x);
          const y = parseFloat(img.dataset.y);

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

      container.addEventListener("mouseenter", handleContainerEnter);
      container.addEventListener("mouseleave", handleContainerLeave);
      window.addEventListener("mousemove", handleMove);

      return () => {
        container.removeEventListener("mouseenter", handleContainerEnter);
        container.removeEventListener("mouseleave", handleContainerLeave);
        window.removeEventListener("mousemove", handleMove);
      };
    }
  }, [images, radius, isMobile]);
  
  // Para móvil: repetir las imágenes 3 veces para cubrir toda la pantalla
  const displayImages = isMobile ? [...images, ...images, ...images] : images;

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen flex items-center justify-center overflow-hidden bg-white"
    >
      {displayImages.map((src, i) => (
        <img
          key={i}
          src={src}
          className="photo absolute object-contain"
          alt={`photo-${i}`}
          style={{
            width: isMobile ? "clamp(180px, 45vw, 320px)" : "clamp(80px, 13vw, 180px)",
            height: "auto",
          }}
        />
      ))}
    </div>
  );
}