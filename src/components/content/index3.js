"use client";
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";

export default function Content3() {
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const img2Ref = useRef(null);
  const img3Ref = useRef(null);
  const text2Ref = useRef(null);
  const text3Ref = useRef(null);
  const wrapperRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false); // controla si el video está en modo “centrado y escalado”

  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    const video = videoRef.current;
    const img2 = img2Ref.current;
    const img3 = img3Ref.current;
    const text2 = text2Ref.current;
    const text3 = text3Ref.current;
    const wrapper = wrapperRef.current;

    if (!container || !img || !video || !img2 || !img3 || !wrapper) return;

    gsap.set(video, { opacity: 0 });

    let originalRect = null;

    // 🔥 SOLO BLUR en hover
    const handleMouseEnter = () => {
      if (isOpen) return; // si ya está abierto, no hacer nada
      gsap.to([img2, img3, text2, text3], {
        filter: "blur(8px)",
        opacity: 0.5,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    const handleMouseLeave = () => {
      if (isOpen) return; // si está abierto, no resetear nada
      gsap.to([img2, img3, text2, text3], {
        filter: "blur(0px)",
        opacity: 1,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    // 🔥 CLICK: activar animación completa
    const handleClick = () => {
      if (!isOpen) {
        // abrir
        setIsOpen(true);

        originalRect = container.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const centerX = wrapperRect.width / 2;
        const centerY = wrapperRect.height / 2;

        const currentCenterX =
          originalRect.left + originalRect.width / 2 - wrapperRect.left;
        const currentCenterY =
          originalRect.top + originalRect.height / 2 - wrapperRect.top;

        const moveX = centerX - currentCenterX;
        const moveY = centerY - currentCenterY;

        // mover & escalar
        gsap.to(container, {
          x: moveX,
          y: moveY,
          scale: 1.4,
          zIndex: 100,
          duration: 0.8,
          ease: "power3.out",
        });

        // imagen → video
        gsap.to(img, { opacity: 0, duration: 0.6 });
        gsap.to(video, {
          opacity: 1,
          duration: 0.6,
          onStart: () => {
            video.currentTime = 0;
            video.play();
          },
        });
      } else {
        // cerrar
        setIsOpen(false);

        gsap.to(container, {
          x: 0,
          y: 0,
          scale: 1,
          zIndex: 1,
          duration: 0.8,
          ease: "power3.inOut",
        });

        gsap.to(img, { opacity: 1, duration: 0.6 });
        gsap.to(video, {
          opacity: 0,
          duration: 0.6,
          onComplete: () => video.pause(),
        });

        gsap.to([img2, img3], {
          filter: "blur(0px)",
          opacity: 1,
          duration: 0.6,
        });
      }
    };

    // EVENTOS
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("click", handleClick);
    };
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className="w-[100vw] h-full md:h-[100vh] bg-white pl-4 pr-4 md:pr-8 pt-4"
    >
      <div className="flex flex-col md:flex-row gap-4 items-start justify-center text-[0.875rem] tracking-[-0.04em]">
        {/* Primera columna */}
        <div className="flex flex-col gap-2 basis-[32%]">
          <div
            ref={containerRef}
            className="relative w-full h-full cursor-pointer"
            style={{ transformOrigin: "center center" }}
          >
            <img
              ref={imgRef}
              src="/hero/img12.png"
              className="object-contain w-full h-full"
            />
            <video
              ref={videoRef}
              src="/motion/promojohnny.mp4"
              className="absolute inset-0 object-contain w-full h-full"
              muted
              loop
              playsInline
            />
          </div>
          <p>Johnny Carretes, Creative direction, Web, 2025 (Berlin)</p>
        </div>

        {/* Segunda */}
        <div className="flex flex-col gap-2 basis-[32%]">
          <img
            ref={img2Ref}
            src="/hero/img10.png"
            className="object-contain w-full h-full transition-all"
          />
          <p ref={text2Ref}>Vilarnau, Creative direction, Web, 2025 (Berlin)</p>
        </div>

        {/* Tercera */}
        <div className="flex flex-col gap-2 basis-[35%]">
          <img
            ref={img3Ref}
            src="/hero/img14.png"
            className="object-contain w-full h-full transition-all"
          />
          <p ref={text3Ref}>MM Discos, Creative direction, Identity, 2025 (Barcelona - Berlin)</p>
        </div>
      </div>
    </div>
  );
}
