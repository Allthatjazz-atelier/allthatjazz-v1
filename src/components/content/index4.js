"use client";
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";

export default function Content4() {
  const imgRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const img2Ref = useRef(null);
  const img3Ref = useRef(null);
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);
  const text3Ref = useRef(null);
  const wrapperRef = useRef(null);
  const container2Ref = useRef(null);
  const container3Ref = useRef(null);

  const [isOpen, setIsOpen] = useState(null); // null | 'first' | 'third'

  useEffect(() => {
    const container = containerRef.current;
    const container2 = container2Ref.current;
    const container3 = container3Ref.current;
    const img = imgRef.current;
    const video = videoRef.current;
    const img2 = img2Ref.current;
    const img3 = img3Ref.current;
    const text1 = text1Ref.current;
    const text2 = text2Ref.current;
    const text3 = text3Ref.current;
    const wrapper = wrapperRef.current;

    if (!container || !container2 || !container3 || !img || !video || !img2 || !img3 || !wrapper) return;

    gsap.set(video, { opacity: 0 });

    // 🔥 HOVER para la PRIMERA foto
    const handleMouseEnter1 = () => {
      if (isOpen) return;
      gsap.to([img2, img3, text2, text3], {
        filter: "blur(8px)",
        opacity: 0.5,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    const handleMouseLeave1 = () => {
      if (isOpen) return;
      gsap.to([img2, img3, text2, text3], {
        filter: "blur(0px)",
        opacity: 1,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    // 🔥 HOVER para la SEGUNDA foto
    const handleMouseEnter2 = () => {
      if (isOpen) return;
      gsap.to([img, img3, text1, text3], {
        filter: "blur(8px)",
        opacity: 0.5,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    const handleMouseLeave2 = () => {
      if (isOpen) return;
      gsap.to([img, img3, text1, text3], {
        filter: "blur(0px)",
        opacity: 1,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    // 🔥 HOVER para la TERCERA foto
    const handleMouseEnter3 = () => {
      if (isOpen) return;
      gsap.to([img, img2, text1, text2], {
        filter: "blur(8px)",
        opacity: 0.5,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    const handleMouseLeave3 = () => {
      if (isOpen) return;
      gsap.to([img, img2, text1, text2], {
        filter: "blur(0px)",
        opacity: 1,
        duration: 0.6,
        ease: "power2.inOut",
      });
    };

    // 🔥 CLICK en la PRIMERA foto (con video)
    const handleClick1 = () => {
      if (!isOpen) {
        setIsOpen('first');

        const originalRect = container.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const centerX = wrapperRect.width / 2;
        const centerY = wrapperRect.height / 2;

        const currentCenterX =
          originalRect.left + originalRect.width / 2 - wrapperRect.left;
        const currentCenterY =
          originalRect.top + originalRect.height / 2 - wrapperRect.top;

        const moveX = centerX - currentCenterX;
        const moveY = centerY - currentCenterY;

        // Mover y escalar
        gsap.to(container, {
          x: moveX,
          y: moveY,
          scale: 1.4,
          zIndex: 100,
          duration: 0.8,
          ease: "power3.out",
        });

        // Blur el resto
        gsap.to([img2, img3, text1, text2, text3], {
          filter: "blur(8px)",
          opacity: 0.5,
          duration: 0.6,
        });

        // Imagen → video
        gsap.to(img, { opacity: 0, duration: 0.6 });
        gsap.to(video, {
          opacity: 1,
          duration: 0.6,
          onStart: () => {
            video.currentTime = 0;
            video.play();
          },
        });
      } else if (isOpen === 'first') {
        setIsOpen(null);

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

        gsap.to([img2, img3, text1, text2, text3], {
          filter: "blur(0px)",
          opacity: 1,
          duration: 0.6,
        });
      }
    };

    // 🔥 CLICK en la TERCERA foto (sin video, escala más pequeña)
    const handleClick3 = () => {
      if (!isOpen) {
        setIsOpen('third');

        const originalRect = container3.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const centerX = wrapperRect.width / 2;
        const centerY = wrapperRect.height / 2;

        const currentCenterX =
          originalRect.left + originalRect.width / 2 - wrapperRect.left;
        const currentCenterY =
          originalRect.top + originalRect.height / 2 - wrapperRect.top;

        const moveX = centerX - currentCenterX;
        const moveY = centerY - currentCenterY;

        // Mover y escalar (más pequeña: 1.1 en lugar de 1.4)
        gsap.to(container3, {
          x: moveX,
          y: moveY,
          scale: 0.8,
          zIndex: 100,
          duration: 0.8,
          ease: "power3.out",
        });

        // Blur el resto
        gsap.to([img, img2, text1, text2, text3], {
          filter: "blur(8px)",
          opacity: 0.5,
          duration: 0.6,
        });
      } else if (isOpen === 'third') {
        setIsOpen(null);

        gsap.to(container3, {
          x: 0,
          y: 0,
          scale: 1,
          zIndex: 1,
          duration: 0.8,
          ease: "power3.inOut",
        });

        gsap.to([img, img2, text1, text2, text3], {
          filter: "blur(0px)",
          opacity: 1,
          duration: 0.6,
        });
      }
    };

    // EVENTOS - Primera foto
    container.addEventListener("mouseenter", handleMouseEnter1);
    container.addEventListener("mouseleave", handleMouseLeave1);
    container.addEventListener("click", handleClick1);

    // EVENTOS - Segunda foto
    container2.addEventListener("mouseenter", handleMouseEnter2);
    container2.addEventListener("mouseleave", handleMouseLeave2);

    // EVENTOS - Tercera foto
    container3.addEventListener("mouseenter", handleMouseEnter3);
    container3.addEventListener("mouseleave", handleMouseLeave3);
    container3.addEventListener("click", handleClick3);

    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter1);
      container.removeEventListener("mouseleave", handleMouseLeave1);
      container.removeEventListener("click", handleClick1);

      container2.removeEventListener("mouseenter", handleMouseEnter2);
      container2.removeEventListener("mouseleave", handleMouseLeave2);

      container3.removeEventListener("mouseenter", handleMouseEnter3);
      container3.removeEventListener("mouseleave", handleMouseLeave3);
      container3.removeEventListener("click", handleClick3);
    };
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className="w-[100vw] h-full md:h-[100vh] bg-white pl-4 pr-4 md:pr-8 pt-4"
    >
      <div className="flex flex-col md:flex-row gap-4 items-start justify-center text-[0.875rem] tracking-[-0.04em]">
        {/* Primera columna - Johnny Carretes */}
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
          <p ref={text1Ref}>Johnny Carretes, Creative direction, Web, 2025 (Berlin)</p>
        </div>

        {/* Segunda columna - Vilarnau */}
        <div className="flex flex-col gap-2 basis-[32%]">
          <div
            ref={container2Ref}
            className="relative w-full h-full"
            style={{ transformOrigin: "center center" }}
          >
            <img
              ref={img2Ref}
              src="/hero/img10.png"
              className="object-contain w-full h-full transition-all"
            />
          </div>
          <p ref={text2Ref}>Vilarnau, Creative direction, Web, 2025 (Berlin)</p>
        </div>

        {/* Tercera columna - MM Discos */}
        <div className="flex flex-col gap-2 basis-[35%]">
          <div
            ref={container3Ref}
            className="relative w-full h-full cursor-pointer"
            style={{ transformOrigin: "center center" }}
          >
            <img
              ref={img3Ref}
              src="/hero/img14.png"
              className="object-contain w-full h-full transition-all"
            />
          </div>
          <p ref={text3Ref}>MM Discos, Creative direction, Identity, 2025 (Barcelona - Berlin)</p>
        </div>
      </div>
    </div>
  );
}