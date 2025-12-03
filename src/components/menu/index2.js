import { useState, useRef } from "react";
import AboutSection from "../about";
import useMultilangScramble from "../tools/MultiLangScramble";

export default function HeaderFooter2() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const titleRef = useRef(null);

  // palabras para ABOUT US en distintos idiomas
  const aboutWords = [
    "about us",           // inglés
    "私たちについて",      // japonés
    "关于我们",             // chino
    "เกี่ยวกับเรา",        // tailandés
    "عنّا",               // árabe
    "περί εμάς",           // griego
    "о нас",              // ruso
  ];

  // palabras para BACK HOME en distintos idiomas
  const backWords = [
    "back home",         // inglés
    "ホームへ戻る",       // japonés
    "回到主页",           // chino
    "กลับบ้าน",          // tailandés
    "العودة",            // árabe
    "πίσω",              // griego
    "домой",             // ruso
  ];

  // usamos el hook y le pasamos las palabras según el estado del modal
  useMultilangScramble(titleRef, {
    words: isAboutOpen ? backWords : aboutWords,
    finalText: "allthatjazz",
    iterations: 10,
    duration: 0.8,
    wordDelay: 1200,
    firstWordEnglish: isAboutOpen ? "back home" : "about us"
  });

  const toggleAbout = () => {
    setIsAboutOpen(!isAboutOpen);
  };

  return (
    <>
      {/* Footer siempre visible */}
      <div className="fixed bottom-0 left-0 w-full z-50 flex flex-col justify-center items-center pb-2 -space-y-3 mix-blend-difference pointer-events-auto">
        <div className="flex cursor-pointer" onClick={toggleAbout}>
          <h1
            ref={titleRef}
            className="text-[4rem] tracking-[-0.04em] text-white transition-colors duration-300"
          >
            allthatjazz
          </h1>
        </div>
        <div className="flex flex-col justify-center items-center -space-y-1 tracking-[-0.05em]">
          <p className="text-[0.875rem] text-white">Atelier de creation graphique et digitale</p>
          <p className="text-[0.563rem] text-white">Visual identity | Web | Creative direction</p>
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
