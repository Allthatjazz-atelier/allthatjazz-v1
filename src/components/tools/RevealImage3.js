"use client";
import { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";

export default function RevealImage3({ src, alt = "", origin = "left", onComplete }) {
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const el = imgRef.current;

    gsap.set(el, {
      scale: 0,
      transformOrigin: origin === "left" ? "0% 50%" : "100% 50%",
      willChange: "transform",
    });

    const tl = gsap.timeline({
      onComplete: () => {
        if (onComplete) onComplete();
      },
    });

    tl.to(el, {
      scale: 1,
      duration: 1,
      ease: "power3.out",
    });

    return () => tl.kill();
  }, [origin, onComplete]);

  return (
    <div
      ref={imgRef}
      className="reveal-img relative w-full h-[60vh] overflow-hidden will-change-transform"
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain backface-hidden transform-gpu"
      />
    </div>
  );
}
