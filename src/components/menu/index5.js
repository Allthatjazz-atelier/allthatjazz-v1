"use client";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import AboutSection from "../about";

export default function HeaderFooter5() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [scrambleDone, setScrambleDone] = useState(false);
  const titleRef = useRef(null);
  const splitRef = useRef(null);
  const animRefs = useRef([]);

  const words = [
    "allthatjazz",      // inglés
    "すべてのジャズ",       // japonés
    "όλοαυτότζαζ",         // griego
    "वह सभी जाज है",        // indú
    "allthatjazz",      // regresa a inglés
  ];

  // --- 1️⃣ SCRAMBLE ANIMATION (preloader-like)
  useEffect(() => {
    if (!titleRef.current) return;
    const el = titleRef.current;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789あいうえお漢字العربيةРусскийΑλφάβητοไทย";
    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];

    const scrambleWord = (word) => {
      return new Promise((resolve) => {
        const letters = word.split("");
        const output = Array(letters.length).fill("");

        let iterations = 0;
        const maxIterations = 15;
        const interval = setInterval(() => {
          iterations++;
          for (let i = 0; i < letters.length; i++) {
            if (iterations < maxIterations / 2) {
              output[i] = randomChar();
            } else {
              output[i] = letters[i];
            }
          }
          el.textContent = output.join("");
          if (iterations >= maxIterations) {
            clearInterval(interval);
            resolve();
          }
        }, 40);
      });
    };

    const runSequence = async () => {
      for (let i = 0; i < words.length; i++) {
        await scrambleWord(words[i]);
        await new Promise((r) => setTimeout(r, 600));
      }
      el.textContent = "allthatjazz";
      setScrambleDone(true);
    };

    runSequence();
  }, []);

  // --- 2️⃣ HOVER ANIMATION (only starts after scramble)
  useEffect(() => {
    if (!scrambleDone || !titleRef.current) return;

    let chars = [];
    let splitInstance = null;

    (async () => {
      const { SplitText } = await import("gsap/SplitText");
      gsap.registerPlugin(SplitText);

      splitInstance = new SplitText(titleRef.current, { type: "chars" });
      splitRef.current = splitInstance;
      chars = splitInstance.chars;

      const onEnter = () => {
        animRefs.current.forEach((a) => a.kill());
        animRefs.current = [];

        chars.forEach((char) => {
          const animateChar = () => {
            const scaleY = gsap.utils.random(0.5, 2);
            const duration = gsap.utils.random(0.2, 0.6);
            const anim = gsap.to(char, {
              scaleY,
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
  }, [scrambleDone]);

  // --- 3️⃣ UI
  return (
    <>
      <div className="fixed bottom-0 left-0 w-full z-50 flex flex-col justify-center items-center pb-2 -space-y-3 mix-blend-difference pointer-events-auto">
        <div className="flex" onClick={() => setIsAboutOpen(!isAboutOpen)}>
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

      {isAboutOpen && (
        <div className="fixed inset-0 z-40 bg-black text-white overflow-y-auto">
          <AboutSection />
        </div>
      )}
    </>
  );
}
