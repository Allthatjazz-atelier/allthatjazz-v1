"use client";
import { useState, useEffect, useRef } from "react";
import AboutSection6 from "../about/index6";
import BerlinClock from "../tools/BerlinClock";

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
    {/* Clock fijo arriba */}
    <div className="fixed top-0 left-0 w-full flex justify-center pt-[16px] z-[9999] pointer-events-none">
      <BerlinClock />
    </div>
      {/* Contenedor fijo siempre visible */}
      <div className="fixed bottom-0 left-0 w-full flex flex-col justify-center items-center pb-2 leading-[2.75rem] z-[9999] HeaderFooter select-none pointer-events-auto">
        {/* H1 Scramble y Footer */}
        <div className="flex" onClick={() => setIsAboutOpen(!isAboutOpen)}>
          <h1
            ref={h1Ref}
            className="text-[4rem] tracking-[-0.04em] text-black select-none whitespace-nowrap cursor-pointer"
          >
            allthatjazz
          </h1>
        </div>

        {/* Tagline siempre visible */}
          <p className="flex text-[1.35rem] text-black MyFont2 tracking-[-0.02em] pointer-none">
            Atelier de création graphique et digitale.
          </p>
          
      </div>

      {/* Contenido principal - sin mix-blend para que el hero (AquaSliderWithHero2) se vea normal */}
      <div className="w-full h-full">{children}</div>

      {/* About modal - Figma: Background blur 45.2, Fill #FFFFFF 15% (blur reducido para acercarse al render de Figma) */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-[1000] overflow-y-auto text-white mix-blend-difference"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <AboutSection6 />
        </div>
      )}
    </>
  );
}