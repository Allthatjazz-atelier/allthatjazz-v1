"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

// Image reveals progressive on scroll

gsap.registerPlugin(ScrollTrigger);

export default function RevealImage({ src, alt = "", origin = "left" }) {
  const imgRef = useRef(null);

  useEffect(() => {
    if (!imgRef.current) return;
    const el = imgRef.current;

    gsap.set(el, {
      scale: 0,
      transformOrigin: origin === "left" ? "0% 50%" : "100% 50%",
      willChange: "transform",
    });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "bottom 60%",
      scrub: 1,
      onUpdate: (self) => {
        gsap.to(el, {
          scale: gsap.utils.interpolate(0, 1, self.progress),
          force3D: true,
          overwrite: "auto",
        });
      },
    });

    return () => {
      trigger.kill();
    };
  }, [origin]);

  return (
    <div
      ref={imgRef}
      className="reveal-img relative w-full h-[60vh] overflow-hidden will-change-transform"
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover backface-hidden transform-gpu"
      />
    </div>
  );
}
