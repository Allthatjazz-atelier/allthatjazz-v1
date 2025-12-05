"use client";

import { useEffect, useRef } from "react";

const AnimatedCursor = () => {
  const trailContainerRef = useRef(null);
  const animationStateRef = useRef(null);
  const trailRef = useRef([]);
  const currentImageIndexRef = useRef(0);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const interpolatedMousePosRef = useRef({ x: 0, y: 0 });
  const isDesktopRef = useRef(false);

  useEffect(() => {
    const config = {
      imageLifespan: 1000,
      mouseThreshold: 45,            // más sensible
      lerpFactor: 0.35,              // sigue el cursor más rápido
      inDuration: 750,
      outDuration: 850,
      staggerIn: 80,
      staggerOut: 30,
      slideDuration: 350,            // movimiento mucho más rápido
      slideEasing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      easing: "cubic-bezier(0.87, 0, 0.13, 1)",
    };

    const trailImageCount = 19;
    const images = Array.from(
      { length: trailImageCount },
      (_, i) => `/hero/img${i + 1}.png`
    );

    const trailContainer = trailContainerRef.current;
    if (!trailContainer) return;

    isDesktopRef.current = window.innerWidth > 1000;

    const MathUtils = {
      lerp: (a, b, n) => (1 - n) * a + n * b,
      distance: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    };

    const getMouseDistance = () =>
      MathUtils.distance(
        mousePosRef.current.x,
        mousePosRef.current.y,
        lastMousePosRef.current.x,
        lastMousePosRef.current.y
      );

    const isInTrailContainer = (x, y) => {
      const rect = trailContainer.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    // ⭐ NUEVO: CLIP PATHS PROPORCIONALES
    const createTrailImage = () => {
      const imgContainer = document.createElement("div");
      imgContainer.classList.add("trail-img");

      const imgSrc = images[currentImageIndexRef.current];
      currentImageIndexRef.current =
        (currentImageIndexRef.current + 1) % trailImageCount;

      const rect = trailContainer.getBoundingClientRect();
      const startX = interpolatedMousePosRef.current.x - rect.left - 100;
      const startY = interpolatedMousePosRef.current.y - rect.top - 100;
      const targetX = mousePosRef.current.x - rect.left - 100;
      const targetY = mousePosRef.current.y - rect.top - 100;

      imgContainer.style.left = `${startX}px`;
      imgContainer.style.top = `${startY}px`;
      imgContainer.style.transition = `left ${config.slideDuration}ms ${config.slideEasing}, top ${config.slideDuration}ms ${config.slideEasing}`;

      const maskLayers = [];
      const imageLayers = [];

      for (let i = 0; i < 10; i++) {
        const layer = document.createElement("div");
        layer.classList.add("mask-layer");

        const imageLayer = document.createElement("div");
        imageLayer.classList.add("image-layer");
        imageLayer.style.backgroundImage = `url(${imgSrc})`;

        // ⭐ CLIP PATH PROPORCIONAL (100% dividido en 10 capas)
        const startY = i * 10;
        const endY = (i + 1) * 10;

        layer.style.clipPath = `polygon(50% ${startY}%, 50% ${startY}%, 50% ${endY}%, 50% ${endY}%)`;
        layer.style.transition = `clip-path ${config.inDuration}ms ${config.easing}`;
        layer.style.transform = "translateZ(0)";

        layer.appendChild(imageLayer);
        imgContainer.appendChild(layer);
        maskLayers.push(layer);
        imageLayers.push(imageLayer);
      }

      trailContainer.appendChild(imgContainer);

      requestAnimationFrame(() => {
        imgContainer.style.left = `${targetX}px`;
        imgContainer.style.top = `${targetY}px`;

        // entrada progresiva
        maskLayers.forEach((layer, i) => {
          const startY = i * 10;
          const endY = (i + 1) * 10;
          const distanceFromMiddle = Math.abs(i - 4.5);
          const delay = distanceFromMiddle * config.staggerIn;

          setTimeout(() => {
            layer.style.clipPath = `polygon(0% ${startY}%, 100% ${startY}%, 100% ${endY}%, 0% ${endY}%)`;
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

    const removeOldImages = () => {
      const now = Date.now();
      if (trailRef.current.length === 0) return;

      const oldestImage = trailRef.current[0];
      if (now >= oldestImage.removeTime) {
        const imgToRemove = trailRef.current.shift();

        imgToRemove.maskLayers.forEach((layer, i) => {
          const startY = i * 10;
          const endY = (i + 1) * 10;
          const distanceFromEdge = 4.5 - Math.abs(i - 4.5);
          const delay = distanceFromEdge * config.staggerOut;

          layer.style.transition = `clip-path ${config.outDuration}ms ${config.easing}`;

          setTimeout(() => {
            layer.style.clipPath = `polygon(50% ${startY}%, 50% ${startY}%, 50% ${endY}%, 50% ${endY}%)`;
          }, delay);
        });

        imgToRemove.imageLayers.forEach((imageLayer) => {
          imageLayer.style.transition = `opacity ${config.outDuration}ms ${config.easing}`;
          imageLayer.style.opacity = "0.25";
        });

        setTimeout(() => {
          if (imgToRemove.element.parentNode) {
            imgToRemove.element.parentNode.removeChild(imgToRemove.element);
          }
        }, config.outDuration + 90);
      }
    };

    const render = () => {
      if (!isDesktopRef.current) return;

      const distance = getMouseDistance();

      interpolatedMousePosRef.current.x = MathUtils.lerp(
        interpolatedMousePosRef.current.x || mousePosRef.current.x,
        mousePosRef.current.x,
        config.lerpFactor
      );

      interpolatedMousePosRef.current.y = MathUtils.lerp(
        interpolatedMousePosRef.current.y || mousePosRef.current.y,
        mousePosRef.current.y,
        config.lerpFactor
      );

      if (
        distance > config.mouseThreshold &&
        isInTrailContainer(mousePosRef.current.x, mousePosRef.current.y)
      ) {
        createTrailImage();
        lastMousePosRef.current = { ...mousePosRef.current };
      }

      removeOldImages();
      animationStateRef.current = requestAnimationFrame(render);
    };

    const startAnimation = () => {
      if (!isDesktopRef.current) return;

      const handleMouseMove = (e) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
      };

      document.addEventListener("mousemove", handleMouseMove);
      animationStateRef.current = requestAnimationFrame(render);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
      };
    };

    let cleanUpMouseListener = null;

    if (isDesktopRef.current) {
      cleanUpMouseListener = startAnimation();
    }

    return () => {
      if (animationStateRef.current) {
        cancelAnimationFrame(animationStateRef.current);
      }
      if (cleanUpMouseListener) cleanUpMouseListener();
    };
  }, []);

  return <div ref={trailContainerRef} className="trail-container bg-white"></div>;
};

export default AnimatedCursor;
