import GridRevealImage from "../tools/GridRevealAnimation";
import RevealImage2 from "../tools/RevealImage2";

const Hero1 = () => {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-start pt-12 bg-white">
      {/* Contenedor de la imagen centrada */}
      <div className="w-11/12 aspect-[3/4]">
        <RevealImage2 
          src="/assets/img51.jpeg" 
          origin="right" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Texto alineado a la izquierda respecto al contenedor de la imagen */}
      <div className="w-11/12 mt-1">
        <p className="text-[0.875rem] text-left">Explorations visuelles 2004-2025</p>
      </div>
    </div>
  );
}

export default Hero1;
