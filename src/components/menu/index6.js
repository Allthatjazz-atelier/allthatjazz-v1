"use client";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import AboutSection from "../about";

export default function HeaderFooter6({ children }) {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [scrambleDone, setScrambleDone] = useState(false);

  const h1Ref = useRef(null);
  const animRefs = useRef([]);
  const splitRef = useRef(null);

  const words = [
    "allthatjazz",
    "すべてのジャズ",
    "όλοαυτότζαζ",
    "वह सभी जाज है",
    "allthatjazz",
  ];

  // --- SCRAMBLE
  useEffect(() => {
    if (!h1Ref.current) return;
    const el = h1Ref.current;
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789あいうえお漢字العربيةРусскийΑλφάβητοไทย";
    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];

    const scrambleWord = (word) =>
      new Promise((resolve) => {
        const letters = word.split("");
        const output = Array(letters.length).fill("");
        let iterations = 0;
        const maxIterations = 15;
        const interval = setInterval(() => {
          iterations++;
          for (let i = 0; i < letters.length; i++) {
            output[i] = iterations < maxIterations / 2 ? randomChar() : letters[i];
          }
          el.textContent = output.join("");
          if (iterations >= maxIterations) {
            clearInterval(interval);
            resolve();
          }
        }, 40);
      });

    const runSequence = async () => {
      el.textContent = "allthatjazz";
      await new Promise((r) => setTimeout(r, 800));
      for (const word of words) {
        await scrambleWord(word);
        await new Promise((r) => setTimeout(r, 500));
      }
      el.textContent = "allthatjazz";
      setScrambleDone(true);
    };

    runSequence();
  }, []);

  // --- HOVER ANIMATION
  useEffect(() => {
    if (!scrambleDone || !h1Ref.current) return;

    (async () => {
      const { SplitText } = await import("gsap/SplitText");
      gsap.registerPlugin(SplitText);

      const splitInstance = new SplitText(h1Ref.current, { type: "chars" });
      splitRef.current = splitInstance;
      const chars = splitInstance.chars;

      const onEnter = () => {
        animRefs.current.forEach((a) => a.kill());
        animRefs.current = [];
        chars.forEach((char) => {
          const animateChar = () => {
            const scaleY = gsap.utils.random(0.5, 2);
            const duration = gsap.utils.random(0.2, 0.6);
            const anim = gsap.to(char, {
              scaleY,
              y: gsap.utils.random(-3, 3),
              transformOrigin: "center bottom",
              duration,
              ease: "power1.inOut",
              onComplete: () => {
                if (animRefs.current.includes(anim)) animateChar();
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
          y: 0,
          duration: 0.3,
          ease: "power3.out",
          stagger: 0.02,
        });
      };

      const el = h1Ref.current;
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);

      return () => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        splitInstance.revert();
        animRefs.current.forEach((a) => a.kill());
      };
    })();
  }, [scrambleDone]);

  // --- RENDER
  return (
    <>
      {/* Contenedor fijo siempre visible */}
      <div className="fixed bottom-0 left-0 w-full flex flex-col justify-center items-center pb-2 -space-y-3 mix-blend-difference z-[9999] HeaderFooter select-none pointer-events-auto">
        {/* H1 Scramble y Footer */}
        <div className="flex" onClick={() => setIsAboutOpen(!isAboutOpen)}>
          <h1
            ref={h1Ref}
            className="text-[4rem] tracking-[-0.04em] text-white select-none whitespace-nowrap"
          >
            allthatjazz
          </h1>
        </div>

        {/* Tagline siempre visible */}
        <div className="flex flex-col justify-center items-center -space-y-1 tracking-[-0.05em] pointer-none">
          <p className="text-[0.875rem] text-white">
            Atelier de création graphique et digitale
          </p>
          <p className="text-[0.563rem] text-white">
            Visual identity | Web | Creative direction
          </p>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="w-full h-full bg-white text-black">{children}</div>

      {/* About modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-40 bg-black text-white overflow-y-auto">
          <AboutSection />
        </div>
      )}
    </>
  );
}
