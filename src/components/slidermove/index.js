"use client";
import { useEffect, useState } from "react";

// Array de fotos con varias posiciones
const photos = [
  {
    src: "/assets/img16.jpeg",
    alt: "img16",
    positions: [
      { top: "-20%", left: "0%" },   // inicio
      { top: "20%", left: "20%" },   // intermedia
      { top: "50%", left: "50%" },   // final
    ],
    zIndex: 10,
  },
  {
    src: "/assets/img89.jpeg",
    alt: "img17",
    positions: [
      { top: "10%", left: "60%" },
      { top: "35%", left: "50%" },
      { top: "55%", left: "55%" },
    ],
    zIndex: 9,
  },
  {
    src: "/assets/img98.jpeg",
    alt: "img18",
    positions: [
      { top: "20%", left: "30%" },
      { top: "35%", left: "40%" },
      { top: "45%", left: "45%" },
    ],
    zIndex: 8,
  },
];

const SliderMove = () => {
  // estado para cada foto: índice de la posición actual
  const [posIndexes, setPosIndexes] = useState(Array(photos.length).fill(0));

  useEffect(() => {
    const interval = setInterval(() => {
      setPosIndexes((prev) =>
        prev.map((pIndex, i) => (pIndex + 1) % photos[i].positions.length)
      );
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-screen relative bg-white px-8 flex items-center justify-center">
      {/* Marco del slider */}
      <div className="relative w-full h-full max-w-[1200px] max-h-[600px] overflow-hidden">
        {photos.map((photo, index) => {
          const pos = photo.positions[posIndexes[index]];

          return (
            <div
              key={index}
              className="absolute transition-all duration-1000 ease-in-out"
              style={{
                top: pos.top,
                left: pos.left,
                transform: `translate(-50%, -50%)`,
                zIndex: photo.zIndex,
                width: "100%",
                height: "100%",
              }}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                className="w-full h-full object-cover"
              />
            </div>
          );
        })}
      </div>

      {/* Pie de foto fijo */}
      <div className="absolute bottom-8 w-full text-center">
        <p className="text-[0.875rem]">Explorations visuelles 2004-2025</p>
      </div>
    </div>
  );
};

export default SliderMove;
