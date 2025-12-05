"use client";

import { useEffect, useRef } from "react";

const AnimatedCursorMobile = () => {
  const trailContainerRef = useRef(null);
  const trailRef = useRef([]);
  const currentImageIndexRef = useRef(0);

  useEffect(() => {
    const config = {
      imageLifespan: 1200,
      revealInterval: 1100, // cada cuánto aparece una nueva img
      inDuration: 750,
      outDuration: 850,
      staggerIn: 80,
      staggerOut: 40,
    };

    const trailImageCount = 19;
    const images = Array.from(
      { length: trailImageCount },
      (_, i) => `/hero/img${i + 1}.png`
    );

    const container = trailContainerRef.current;
    if (!container) return;

    const getRandomInside = () => {
      const rect = container.getBoundingClientRect();
      return {
        x: Math.random() * rect.width - 100,
        y: Math.random() * rect.height - 100,
      };
    };

    const createReveal = () => {
      const imgContainer = document.createElement("div");
      imgContainer.classList.add("trail-img");

      const imgSrc = images[currentImageIndexRef.current];
      currentImageIndexRef.current =
        (currentImageIndexRef.current + 1) % trailImageCount;

      const { x, y } = getRandomInside();

      imgContainer.style.left = `${x}px`;
      imgContainer.style.top = `${y}px`;

      const maskLayers = [];
      const imageLayers = [];

      for (let i = 0; i < 10; i++) {
        const layer = document.createElement("div");
        layer.classList.add("mask-layer");

        const imageLayer = document.createElement("div");
        imageLayer.classList.add("image-layer");
        imageLayer.style.backgroundImage = `url(${imgSrc})`;

        const startY = i * 10;
        const endY = (i + 1) * 10;

        layer.style.clipPath = `polygon(50% ${startY}%, 50% ${startY}%, 50% ${endY}%, 50% ${endY}%)`;
        layer.style.transition = `clip-path ${config.inDuration}ms cubic-bezier(0.87, 0, 0.13, 1)`;

        layer.appendChild(imageLayer);
        imgContainer.appendChild(layer);
        maskLayers.push(layer);
        imageLayers.push(imageLayer);
      }

      container.appendChild(imgContainer);

      requestAnimationFrame(() => {
        maskLayers.forEach((layer, i) => {
          const startY = i * 10;
          const endY = (i + 1) * 10;
          const delay = Math.abs(i - 4.5) * config.staggerIn;

          setTimeout(
            () =>
              (layer.style.clipPath = `polygon(
              0% ${startY}%, 100% ${startY}%, 100% ${endY}%, 0% ${endY}%
          )`),
            delay
          );
        });
      });

      trailRef.current.push({
        element: imgContainer,
        maskLayers,
        imageLayers,
        removeTime: Date.now() + config.imageLifespan,
      });
    };

    const removeOld = () => {
      const now = Date.now();
      if (trailRef.current.length === 0) return;

      const obj = trailRef.current[0];
      if (now < obj.removeTime) return;

      trailRef.current.shift();

      obj.maskLayers.forEach((layer, i) => {
        const startY = i * 10;
        const endY = (i + 1) * 10;
        const delay = (4.5 - Math.abs(i - 4.5)) * config.staggerOut;

        layer.style.transition = `clip-path ${config.outDuration}ms cubic-bezier(0.87, 0, 0.13, 1)`;
        setTimeout(() => {
          layer.style.clipPath = `polygon(
            50% ${startY}%, 50% ${startY}%, 50% ${endY}%, 50% ${endY}%
          )`;
        }, delay);
      });

      obj.imageLayers.forEach((layer) => {
        layer.style.transition = `opacity ${config.outDuration}ms cubic-bezier(0.87, 0, 0.13, 1)`;
        layer.style.opacity = "0.35";
      });

      setTimeout(() => {
        obj.element.remove();
      }, config.outDuration + 100);
    };

    const interval = setInterval(() => {
      createReveal();
      removeOld();
    }, config.revealInterval);

    return () => clearInterval(interval);
  }, []);

  return <div className="trail-container bg-white" ref={trailContainerRef}></div>;
};

export default AnimatedCursorMobile;
