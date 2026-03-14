import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function AboutSection6() {
  const imageRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(false);


  useEffect(() => {
    // Detectar si es desktop (768px = breakpoint md de Tailwind)
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);

    if (isDesktop) {
      gsap.set(imageRef.current, {
        scale: 0.8,
        opacity: 0,
        visibility: 'hidden',
        xPercent: -50,
        yPercent: -50
      });
    }

    return () => {
      window.removeEventListener('resize', checkDesktop);
      gsap.killTweensOf(imageRef.current);
    };
  }, [isDesktop]);


  return (
    <div className="relative w-full h-screen gap-12 flex flex-col text-[0.875rem] md:text-[0.875rem] tracking-[-0.04em] items-center justify-start pt-[16vh] md:pt-0 md:justify-center px-4 leading-none text-center">
      
      {/* TEXTOS ORIGINALES */}
      <div className="flex flex-col z-10 w-[100vw] md:w-[40vw] px-4">
        <p className="flex font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] mb-[2rem]">
          A creative collective based in Berlin, playing Worldwide. <br/> Blending digital craft with analog attitude. Exploring and shaping visual narratives and experiences that resonate through culture, music, fashion, lifestyle and multimedia. Hustling 24/7.
        </p>
        <p className="flex font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] mb-[4rem]">
          Creative direction, strategy, digital and web experiences, design and code are part of our playground
        </p>
        <div className="flex flex-col">
          <p className="font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1]">For collaborations or inquires, please reach out at:</p>
          <p className="font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1]">hello@allthatjazz.com</p>
          <p className="uppercase font-semibold text-[0.625rem] tracking-[-0.045em] leading-[1.1] mt-1">joaquin diaz, kiko Climent, +++</p>
        </div>
      </div>
      

    </div>
  );
}