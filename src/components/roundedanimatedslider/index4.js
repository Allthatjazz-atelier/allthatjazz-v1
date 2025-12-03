"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function FullFieldImageSlider({ images = [] }) {
  const containerRef = useRef(null);

  // Repetimos las imágenes para llenar la pantalla
  const repeatedImages = Array(20).fill(images).flat();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // NodeList de las imágenes ya renderizadas
    const imgs = container.querySelectorAll(".photo");
    if (!imgs || imgs.length === 0) return;

    // Configuración de zonas y throttling
    const maxVisible = 220; // distancia máxima para considerar visible
    const fadeZone = 40; // zona de transición (no re-anima dentro de este margen)
    const throttleMs = 20; // mínimo intervalo entre ejecuciones (ms) -> ~50fps

    // Cache de visibilidad para cada elemento (WeakMap evita memory leaks)
    const visibility = new WeakMap();

    // Posicionamos aleatoriamente (una vez)
    imgs.forEach((img) => {
      const x = Math.random() * window.innerWidth - window.innerWidth / 2;
      const y = Math.random() * window.innerHeight - window.innerHeight / 2;

      gsap.set(img, {
        position: "absolute",
        top: "50%",
        left: "50%",
        xPercent: -50,
        yPercent: -50,
        x,
        y,
        transformOrigin: "center center",
        scale: gsap.utils.random(0.4, 0.7),
        opacity: 0,
        zIndex: 1,
      });

      // inicialmente marcamos como invisible
      visibility.set(img, false);
    });

    // Parallax sutil (opcional)
    const parallaxTween = gsap.to(imgs, {
      x: "+=50",
      y: "+=30",
      duration: 15,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      stagger: { each: 0.2, from: "random" },
      paused: false,
    });

    // Throttled mousemove handler
    let lastCall = 0;
    let highlightVisible = false;

    const handleMove = (e) => {
      const now = performance.now();
      if (now - lastCall < throttleMs) return;
      lastCall = now;

      let anyVisibleThisFrame = false;

      imgs.forEach((img) => {
        const rect = img.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - e.clientX;
        const dy = rect.top + rect.height / 2 - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const wasVisible = Boolean(visibility.get(img));

        // Zonas:
        // 1) fuera del rango con margen -> forzar invisible
        if (dist > maxVisible + fadeZone) {
          if (wasVisible) {
            visibility.set(img, false);
            gsap.to(img, {
              opacity: 0,
              scale: 0.5,
              zIndex: 0,
              duration: 0.45,
              ease: "expo.out",
              overwrite: "auto",
            });
          }
          // si ya estaba invisible, no reanimamos
          return;
        }

        // 2) dentro del rango principal -> forzar visible (mapeado suave)
        if (dist < maxVisible - fadeZone) {
          anyVisibleThisFrame = true;
          if (!wasVisible) {
            visibility.set(img, true);
            // calculamos escala en función de la distancia (más cerca -> mayor)
            const scale = gsap.utils.mapRange(
              0,
              Math.max(1, maxVisible - fadeZone),
              1.6,
              0.8,
              dist
            );
            const zIndex = Math.round(
              gsap.utils.mapRange(0, maxVisible, 12, 1, dist)
            );
            gsap.to(img, {
              opacity: 1,
              scale,
              zIndex,
              duration: 0.5,
              ease: "power2.out",
              overwrite: "auto",
            });
          } else {
            // si ya visible, actualizamos suavemente la escala/zIndex (sin tocar opacity)
            const scale = gsap.utils.mapRange(
              0,
              Math.max(1, maxVisible - fadeZone),
              1.6,
              0.8,
              dist
            );
            const zIndex = Math.round(
              gsap.utils.mapRange(0, maxVisible, 12, 1, dist)
            );
            gsap.to(img, {
              scale,
              zIndex,
              duration: 0.45,
              ease: "expo.out",
              overwrite: "auto",
            });
          }
          return;
        }

        // 3) zona de transición -> no actualizamos el estado (evita jitter)
        // opcional: podríamos hacer una interpolación muy suave aquí, pero por simplicidad
        // mantenemos el estado actual para evitar micro-animaciones.
      });

      // Manejamos el evento global de highlight como antes
      if (anyVisibleThisFrame && !highlightVisible) {
        window.dispatchEvent(
          new CustomEvent("cursor:showHighlight", {
            detail: { text: "highlights" },
          })
        );
        highlightVisible = true;
      } else if (!anyVisibleThisFrame && highlightVisible) {
        window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
        highlightVisible = false;
      }
    };

    window.addEventListener("mousemove", handleMove);

    // Cleanup
    return () => {
      window.removeEventListener("mousemove", handleMove);
      // detener tween de parallax
      if (parallaxTween) parallaxTween.kill();
      // opcionalmente limpiamos animaciones en todas las imgs
      imgs.forEach((img) => {
        gsap.killTweensOf(img);
      });
      window.dispatchEvent(new CustomEvent("cursor:hideHighlight"));
    };
  }, [images]); // re-ejecuta si cambia el array de imágenes

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen flex items-center justify-center overflow-hidden bg-white"
    >
      {repeatedImages.map((src, i) => (
        <img
          key={i}
          src={src}
          className="photo absolute object-contain"
          alt={`photo-${i}`}
          style={{
            width: "clamp(60px, 10vw, 160px)",
            pointerEvents: "none", // evita que las imágenes interfieran con el hover
            userSelect: "none",
          }}
        />
      ))}
    </div>
  );
}
