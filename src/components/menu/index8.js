"use client";
import { useState, useEffect, useRef } from "react";
import AboutSection from "../about";

export default function HeaderFooter8({ children }) {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const h1Ref = useRef(null);

  const words = [
    "allthatjazz",
    "すべてのジャズ",
    "όλοαυτότζαζ",
    "वह सभी जाज है",
    "allthatjazz",
  ];

  // --- SCRAMBLE (se mantiene)
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
    };

    runSequence();
  }, []);

  // --- RENDER
  return (
    <>
      {/* Contenedor fijo siempre visible */}
      <div className="fixed bottom-0 left-0 w-full flex flex-col justify-center items-center pb-2 -space-y-5 mix-blend-difference z-[9999] HeaderFooter select-none pointer-events-auto">
        {/* H1 Scramble y Footer */}
        <div className="flex" onClick={() => setIsAboutOpen(!isAboutOpen)}>
          <h1
            ref={h1Ref}
            className="text-[4rem] tracking-[-0.04em] text-white select-none whitespace-nowrap cursor-pointer"
          >
            allthatjazz
          </h1>
        </div>

        {/* Tagline siempre visible */}
          <p className="flex text-[1.35rem] text-white MyFont2 tracking-[-0.05em] pointer-none">
            Atelier de création graphique et digitale.
          </p>
          
      </div>

      {/* Contenido principal */}
      <div className="w-full h-full bg-white text-black">{children}</div>

      {/* About modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-200 bg-black text-white overflow-y-auto">
          <AboutSection />
        </div>
      )}
    </>
  );
}