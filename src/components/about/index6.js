import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function AboutSection6() {
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const projects = [
    { name: 'Divorce from New York/High praise Records', image: '/hero/img3.png' },
    { name: 'Johnny Carretes', image: '/hero/img12.png' },
    { name: 'Vilarnau', image: '/hero/img10.png' },
    { name: 'MM Discos', image: '/hero/img15.png' },
    { name: 'Playground Goodies', image: '/hero/img16.png' },
    { name: 'Bisous Bisous', image: '/hero/img19.png' }
  ];

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

  const handleMouseEnter = (imageSrc, target) => {
    if (!isDesktop || !imageRef.current) return;

    // hover del p → mover un poco a la derecha
    gsap.to(target, {
      x: 8,
      duration: 0.25,
      ease: "power2.out"
    });

    // mostrar imagen
    gsap.killTweensOf(imageRef.current);
    imageRef.current.src = imageSrc;

    gsap.to(imageRef.current, {
      scale: 1,
      opacity: 1,
      visibility: "visible",
      duration: 0.4,
      ease: "power2.out"
    });
  };

  const handleMouseLeaveP = (target) => {
    if (!isDesktop) return;

    gsap.to(target, {
      x: 0,
      duration: 0.25,
      ease: "power2.in"
    });
  };

  const handleMouseMove = (e) => {
    if (!isDesktop || !imageRef.current) return;

    gsap.to(imageRef.current, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.25,
      ease: "power2.out"
    });
  };

  const handleMouseLeave = () => {
    if (!isDesktop || !imageRef.current) return;

    gsap.killTweensOf(imageRef.current);
    gsap.to(imageRef.current, {
      scale: 0.8,
      opacity: 0,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(imageRef.current, { visibility: "hidden" });
      }
    });
  };

  return (
    <div className="relative w-full h-screen gap-12 flex flex-col text-[0.875rem] md:text-[0.875rem] tracking-[-0.04em] items-center justify-center px-4 leading-none text-center">
      
      {/* TEXTOS ORIGINALES */}
      <div className="flex flex-col z-10 w-screen md:w-[40vw]">
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