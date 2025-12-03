"use client";

import { useEffect, useState } from "react";

const SpinSlider = () => {
  const images = [
    "/assets/img89.jpeg",
    "/assets/img98.jpeg",
    "/assets/img16.jpeg",
    "/assets/img51.jpeg",
  ];

  const [frontIndex, setFrontIndex] = useState(0);
  const [backIndex, setBackIndex] = useState(1);
  const duration = 4000; // duración de un giro completo (0→360)

  useEffect(() => {
    const interval = setInterval(() => {
      // justo a los 180° → la cara trasera está 100% oculta
      setBackIndex((prev) => (prev + 2) % images.length);

      // justo a los 360° → la cara delantera está oculta
      setTimeout(() => {
        setFrontIndex((prev) => (prev + 2) % images.length);
      }, duration / 2);
    }, duration);

    return () => clearInterval(interval);
  }, [duration, images.length]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-white">
      <div className="relative w-8/12 aspect-[3/4] perspective">
        <div
          className="slider-card"
          style={{ animationDuration: `${duration}ms` }}
        >
          <div className="card-face front">
            <img
              src={images[frontIndex]}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="card-face back">
            <img
              src={images[backIndex]}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpinSlider;
