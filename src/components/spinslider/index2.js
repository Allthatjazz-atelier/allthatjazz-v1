"use client";

import { useEffect, useState, useRef } from "react";

const SpinCubeContinuous = () => {
  const images = [
    "/assets/img89.jpeg",
    "/assets/img98.jpeg",
    "/assets/img16.jpeg",
    "/assets/img51.jpeg",
    "/assets/img84.jpeg",
    "/assets/img20.jpeg",
    "/assets/img25.jpeg",
    "/assets/img85.jpeg",
    "/assets/img31.jpeg",
    "/assets/img95.jpeg",
  ];

  const [faces, setFaces] = useState([0, 1, 2, 3, 4, 5]); // índices iniciales
  const currentImage = useRef(6); // siguiente imagen
  const duration = 6000; // tiempo giro completo

  // Caras en orden según qué cara queda "detrás" (cada 1/6 de vuelta aprox)
  const hiddenOrder = ["back", "left", "top", "right", "bottom", "front"];

  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      const hiddenFaceIndex = step % 6;

      setFaces((prev) => {
        const next = [...prev];
        // cara que queda detrás
        next[hiddenFaceIndex] = currentImage.current % images.length;
        currentImage.current++;
        return next;
      });

      step++;
    }, duration / 6); // cada 1/6 de vuelta

    return () => clearInterval(interval);
  }, [images.length, duration]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-white">
      <div className="scene">
        <div className="cube">
          <div className="face front">
            <img src={images[faces[0]]} className="w-full h-full object-cover" />
          </div>
          <div className="face back">
            <img src={images[faces[1]]} className="w-full h-full object-cover" />
          </div>
          <div className="face right">
            <img src={images[faces[2]]} className="w-full h-full object-cover" />
          </div>
          <div className="face left">
            <img src={images[faces[3]]} className="w-full h-full object-cover" />
          </div>
          <div className="face top">
            <img src={images[faces[4]]} className="w-full h-full object-cover" />
          </div>
          <div className="face bottom">
            <img src={images[faces[5]]} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpinCubeContinuous;
