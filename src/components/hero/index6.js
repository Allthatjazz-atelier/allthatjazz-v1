"use client";
import RevealVideo from "../tools/RevealVideo";

const Hero6Motion = () => {
  return (
    <div className="w-full h-screen flex flex-col md:flex-col items-center md:items-start justify-start pr-4 md:pr-0 pl-4 pt-12 bg-white">
      {/* Contenedor del video alineado a la izquierda */}
      <div className="w-fit">
        <RevealVideo
          src="/motion/motionatj.mp4"
          origin="left"
        />
      </div>

      {/* Texto alineado a la izquierda */}
      <div className="w-fit mt-2">
        <p className="text-[0.875rem] text-left">
           Explorations visuelles 2004-2025
        </p>
      </div>
    </div>
  );
};

export default Hero6Motion;
