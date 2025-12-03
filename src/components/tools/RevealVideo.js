"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function RevealVideo({ src, origin = "left", autoplay = true, loop = true, muted = true }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    const el = videoRef.current;

    gsap.set(el, {
      scale: 0,
      transformOrigin:
        origin === "left"
          ? "0% 50%"
          : origin === "right"
          ? "100% 50%"
          : "50% 100%",
      willChange: "transform",
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });

    tl.to(el, {
      scale: 1,
      duration: 1,
      ease: "power3.out",
      onStart: () => {
        if (autoplay && el.paused) el.play();
      },
    });

    const trigger = tl.scrollTrigger;

    return () => {
      tl.kill();
      if (trigger) trigger.kill();
    };
  }, [origin, autoplay]);

  return (
    <div className="relative w-fit h-auto overflow-hidden will-change-transform">
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        loop={loop}
        playsInline
        preload="auto"
        className="w-[100%] md:w-[40%] h-auto object-contain"
      />
    </div>
  );
}
