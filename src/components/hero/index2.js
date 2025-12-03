"use client";

// import RevealImage from "../tools/RevealImage";
import RevealImage2 from "../tools/RevealImage2";

const Hero2 = () => {
  return (
    <div className="w-full h-screen flex flex-col items-center md:items-start pl-0 md- pl-4 justify-start pt-12 bg-white">
      {/* Contenedor de la imagen centrada */}
      <div className="w-11/12 md:w-6/12 aspect-[3/4]">
        <RevealImage2 
          src="/assets/img89.jpeg"
          origin="right"
          className="w-full h-full object-contain"
        />
      {/* Texto alineado a la izquierda respecto al contenedor de la imagen */}
      <div className="w-11/12 md:w-6/12 mt-1">
        <p className="text-[0.875rem] text-left">Explorations visuelles 2004-2025</p>
      </div>
      </div>

    </div>
  );
}

export default Hero2;
