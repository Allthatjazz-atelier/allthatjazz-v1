"use client";

import { useEffect, useState, useRef } from "react";

const SpinCubeStep = () => {
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

  const [faces, setFaces] = useState([0, 1, 2, 3, 4, 5]);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const currentImage = useRef(6);
  const usedIndices = useRef(new Set(faces));

  // Secuencia de giros "cara a cara", ignorando rolls
  const sequence = [
    ["x", -90], // arriba
    ["y", -90], // izquierda
    ["x", 90],  // abajo
    ["y", 90],  // derecha
  ];

  const oppositeFace = [1, 0, 3, 2, 5, 4]; // front↔back, right↔left, top↔bottom

  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      const [axis, dir] = sequence[step % sequence.length];

      // Actualizamos rotación
      setRotation((prev) => ({ ...prev, [axis]: prev[axis] + dir }));

      // Determinar cuál será la cara frontal después del giro
      let frontFaceIndex;
      switch (step % 4) {
        case 0: frontFaceIndex = 4; break; // giro arriba → top visible
        case 1: frontFaceIndex = 3; break; // giro izquierda → left visible
        case 2: frontFaceIndex = 5; break; // giro abajo → bottom visible
        case 3: frontFaceIndex = 2; break; // giro derecha → right visible
      }

      // Cara completamente oculta
      const hiddenFaceIndex = oppositeFace[frontFaceIndex];

      // Cambiamos la imagen solo si la cara está completamente oculta
      if (!usedIndices.current.has(frontFaceIndex)) {
        let nextImg = currentImage.current % images.length;
        while (usedIndices.current.has(nextImg)) {
          currentImage.current++;
          nextImg = currentImage.current % images.length;
        }

        setFaces((prev) => {
          const next = [...prev];
          usedIndices.current.delete(prev[hiddenFaceIndex]);
          next[hiddenFaceIndex] = nextImg;
          usedIndices.current.add(nextImg);
          currentImage.current++;
          return next;
        });
      }

      step++;
    }, 1200); // más rápido y armónico

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-white">
      <div className="scene">
        <div
          className="cube"
          style={{
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transition: "transform 1.2s ease-in-out",
          }}
        >
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

export default SpinCubeStep;
