"use client";
import { useRef, useEffect } from "react";
import gsap from "gsap";

export default function Content2() {
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    const video = videoRef.current;

    if (!container || !img || !video) return;

    // Configuración inicial
    gsap.set(video, { opacity: 0 });

    const handleMouseEnter = () => {
      // Fade out imagen y fade in video
      gsap.to(img, {
        opacity: 0,
        duration: 0.6,
        ease: "power2.inOut",
      });

      gsap.to(video, {
        opacity: 1,
        duration: 0.6,
        ease: "power2.inOut",
        onStart: () => {
          video.currentTime = 0;
          video.play();
        },
      });
    };

    const handleMouseLeave = () => {
      // Fade in imagen y fade out video
      gsap.to(img, {
        opacity: 1,
        duration: 0.6,
        ease: "power2.inOut",
      });

      gsap.to(video, {
        opacity: 0,
        duration: 0.6,
        ease: "power2.inOut",
        onComplete: () => {
          video.pause();
        },
      });
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div className="w-[100vw] h-full md:h-[100vh] bg-white pl-4 pr-4 md:pr-8 pt-4">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-center text-[0.875rem] tracking-[-0.04em]">
        {/* Primera columna con hover image/video */}
        <div className="flex flex-col gap-2 basis-[32%]">
          <div ref={containerRef} className="relative w-full h-full cursor-pointer">
            <img
              ref={imgRef}
              src="/hero/img12.png"
              className="object-contain w-full h-full"
              alt="Johnny Carretes"
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

        {/* Segunda columna */}
        <div className="flex flex-col gap-2 basis-[32%]">
          <img
            src="/hero/img10.png"
            className="object-contain w-full h-full"
            alt="Vilarnau"
          />
          <p>Vilarnau, Creative direction, Web, 2025 (Berlin)</p>
        </div>

        {/* Tercera columna */}
        <div className="flex flex-col gap-2 basis-[35%]">
          <img
            src="/hero/img14.png"
            className="object-contain w-full h-full"
            alt="MM Discos"
          />
          <p>MM Discos, Creative direction, Identity, 2025 (Barcelona - Berlin)</p>
        </div>
      </div>
    </div>
  );
}