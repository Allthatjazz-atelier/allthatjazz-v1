"use client";

import { useEffect, useRef } from "react";

const AnimatedCursorMobile = () => {
  const trailContainerRef = useRef(null);
  const trailRef = useRef([]);
  const currentImageIndexRef = useRef(0);

  useEffect(() => {
    const config = {
      imageLifespan: 1200,
      revealInterval: 1100,
      inDuration: 750,
      outDuration: 850,
      staggerIn: 80,
      staggerOut: 40,
    };

    const IMG_SIZE = 180; // <-- tamaño cuadrado base sin recortar
    const CLIP_SEGMENTS = 10;

    const trailImageCount = 19;
    const images = Array.from(
      { length: trailImageCount },
      (_, i) => `/hero/img${i + 1}.png`
    );

    const container = trailContainerRef.current;
    if (!container) return;

    /** 🔥 Posición aleatoria FIJA dentro del viewport del contenedor */
    const getRandomInside = () => {
      const rect = container.getBoundingClientRect();
      return {
        x: Math.random() * (rect.width - IMG_SIZE),
        y: Math.random() * (rect.height - IMG_SIZE),
      };
    };

    /** ---------------------------------------------------
     * 🔥 createReveal() — versión corregida sin líneas
     * --------------------------------------------------- */
    const createReveal = () => {
      const imgContainer = document.createElement("div");
      imgContainer.classList.add("trail-img");
      imgContainer.style.width = `${IMG_SIZE}px`;
      imgContainer.style.height = `${IMG_SIZE}px`;

      const imgSrc = images[currentImageIndexRef.current];
      currentImageIndexRef.current =
        (currentImageIndexRef.current + 1) % trailImageCount;

      const { x, y } = getRandomInside();
      imgContainer.style.left = `${x}px`;
      imgContainer.style.top = `${y}px`;

      const maskLayers = [];
      const imageLayers = [];

      for (let i = 0; i < CLIP_SEGMENTS; i++) {
        const layer = document.createElement("div");
        layer.classList.add("mask-layer");

        const imageLayer = document.createElement("div");
        imageLayer.classList.add("image-layer");
        imageLayer.style.backgroundImage = `url(${imgSrc})`;

        const startY = (i / CLIP_SEGMENTS) * 100;
        const endY = ((i + 1) / CLIP_SEGMENTS) * 100;

        // Estado inicial: colapsado a una línea → NO genera bordes visibles
        layer.style.clipPath = `polygon(
          50% ${startY}%,
          50% ${startY}%,
          50% ${endY}%,
          50% ${endY}%
        )`;

        layer.style.transition = `clip-path ${config.inDuration}ms cubic-bezier(0.87, 0, 0.13, 1)`;

        layer.appendChild(imageLayer);
        imgContainer.appendChild(layer);

        maskLayers.push(layer);
        imageLayers.push(imageLayer);
      }

      container.appendChild(imgContainer);

      /** Animación de aparición */
      requestAnimationFrame(() => {
        maskLayers.forEach((layer, i) => {
          const startY = (i / CLIP_SEGMENTS) * 100;
          const endY = ((i + 1) / CLIP_SEGMENTS) * 100;
          const delay = Math.abs(i - CLIP_SEGMENTS / 2) * config.staggerIn;

          setTimeout(() => {
            layer.style.clipPath = `polygon(
              0% ${startY}%,
              100% ${startY}%,
              100% ${endY}%,
              0% ${endY}%
            )`;
          }, delay);
        });
      });

      trailRef.current.push({
        element: imgContainer,
        maskLayers,
        imageLayers,
        removeTime: Date.now() + config.imageLifespan,
      });
    };

    /** Desaparición */
    const removeOld = () => {
      const now = Date.now();
      if (!trailRef.current.length) return;

      const obj = trailRef.current[0];
      if (now < obj.removeTime) return;

      trailRef.current.shift();

      obj.maskLayers.forEach((layer, i) => {
        const startY = (i / CLIP_SEGMENTS) * 100;
        const endY = ((i + 1) / CLIP_SEGMENTS) * 100;
        const delay = (CLIP_SEGMENTS / 2 - Math.abs(i - CLIP_SEGMENTS / 2)) * config.staggerOut;

        layer.style.transition = `clip-path ${config.outDuration}ms cubic-bezier(0.87, 0, 0.13, 1)`;

        setTimeout(() => {
          layer.style.clipPath = `polygon(
            50% ${startY}%,
            50% ${startY}%,
            50% ${endY}%,
            50% ${endY}%
          )`;
        }, delay);
      });

      obj.imageLayers.forEach((layer) => {
        layer.style.transition = `opacity ${config.outDuration}ms`;
        layer.style.opacity = "0.35";
      });

      setTimeout(() => obj.element.remove(), config.outDuration + 50);
    };

    /** Intervalo principal */
    const interval = setInterval(() => {
      createReveal();
      removeOld();
    }, config.revealInterval);

    return () => clearInterval(interval);
  }, []);

  return <div className="trail-container bg-white" ref={trailContainerRef}></div>;
};

export default AnimatedCursorMobile;
