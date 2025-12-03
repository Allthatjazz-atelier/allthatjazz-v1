import { useState } from "react";
import AboutSection from "../about";

export default function HeaderFooter() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const toggleAbout = () => {
    setIsAboutOpen(!isAboutOpen);
  };

  return (
    <>
      {/* Footer siempre visible */}
      <div className="fixed bottom-0 left-0 w-full z-50 flex flex-col justify-center items-center pb-2 -space-y-3 mix-blend-difference pointer-events-auto">
        <div className="flex cursor-pointer" onClick={toggleAbout}>
          <h1 className="text-[4rem] tracking-[-0.04em] text-white">allthatjazz</h1>
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
