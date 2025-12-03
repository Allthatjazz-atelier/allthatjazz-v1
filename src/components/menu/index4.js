"use client";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import AboutSection from "../about";

export default function HeaderFooter4() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const titleRef = useRef(null);
  const splitRef = useRef(null);
  const animRefs = useRef([]);

  const toggleAbout = () => setIsAboutOpen(!isAboutOpen);

  useEffect(() => {
    if (!titleRef.current || typeof window === "undefined") return;

    let chars = [];
    let splitInstance = null;

    (async () => {
      const { SplitText } = await import("gsap/SplitText");
      gsap.registerPlugin(SplitText);

      splitInstance = new SplitText(titleRef.current, { type: "chars" });
      splitRef.current = splitInstance;
      chars = splitInstance.chars;

      const onEnter = () => {
        // detener animaciones previas
        animRefs.current.forEach((a) => a.kill());
        animRefs.current = [];

        chars.forEach((char) => {
          const animateChar = () => {
            const scaleY = gsap.utils.random(0.5, 2, 0.05);
            const xOffset = gsap.utils.random(-5, 5, 0.1); // movimiento X leve
            const duration = gsap.utils.random(0.2, 0.6, 0.01);
            const anim = gsap.to(char, {
              scaleY,
              x: xOffset,
              transformOrigin: "center bottom",
              duration,
              ease: "power1.inOut",
              onComplete: () => {
                if (animRefs.current.includes(anim)) {
                  animateChar(); // reinicia con nuevos valores aleatorios
                }
              },
            });
            animRefs.current.push(anim);
          };
          animateChar();
        });
      };

      const onLeave = () => {
        animRefs.current.forEach((a) => a.kill());
        animRefs.current = [];
        gsap.to(chars, {
          scaleY: 1,
          x: 0,
          duration: 0.3,
          ease: "power3.out",
          stagger: 0.02,
        });
      };

      const el = titleRef.current;
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);

      return () => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        splitInstance?.revert();
        animRefs.current.forEach((a) => a.kill());
      };
    })();
  }, []);

  return (
    <>
      {/* Footer */}
      <div className="fixed bottom-0 left-0 w-full z-50 flex flex-col justify-center items-center pb-2 -space-y-3 mix-blend-difference pointer-events-auto">
        <div className="flex cursor-pointer" onClick={toggleAbout}>
          <h1
            ref={titleRef}
            className="text-[4rem] tracking-[-0.04em] text-white select-none"
          >
            allthatjazz
          </h1>
        </div>
        <div className="flex flex-col justify-center items-center -space-y-1 tracking-[-0.05em]">
          <p className="text-[0.875rem] text-white">
            Atelier de creation graphique et digitale
          </p>
          <p className="text-[0.563rem] text-white">
            Visual identity | Web | Creative direction
          </p>
        </div>
      </div>

      {/* Overlay About */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-40 bg-black text-white overflow-y-auto">
          <AboutSection />
        </div>
      )}
    </>
  );
}
