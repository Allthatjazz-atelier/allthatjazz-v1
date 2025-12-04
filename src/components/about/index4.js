import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function AboutSection4() {
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const projects = [
    { name: 'Divorce from New York/High praise Records', image: '/hero/img3.png' },
    { name: 'Johnny Carretes', image: '/hero/img12.png' },
    { name: 'Vilarnau', image: '/hero/img10.png' },
    { name: 'MM Discos', image: '/hero/img15.png' },
    { name: 'Playground Goodies', image: '/hero/img16.png' },
    { name: 'Bisous Bisous', image: '/hero/img19.png' }
  ];

  useEffect(() => {
    gsap.set(imageRef.current, {
      scale: 0.8,
      opacity: 0,
      visibility: 'hidden',
      xPercent: -50,
      yPercent: -50
    });
    return () => gsap.killTweensOf(imageRef.current);
  }, []);

  const handleMouseEnter = (imageSrc, target) => {
    if (!imageRef.current) return;

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
    gsap.to(target, {
      x: 0,
      duration: 0.25,
      ease: "power2.in"
    });
  };

  const handleMouseMove = (e) => {
    if (!imageRef.current) return;

    gsap.to(imageRef.current, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.25,
      ease: "power2.out"
    });
  };

  const handleMouseLeave = () => {
    if (!imageRef.current) return;

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
    <div className="relative w-full h-screen gap-12 flex flex-col text-[0.875rem] md:text-[0.875rem] tracking-[-0.04em] items-start justify-start pt-12 px-4 leading-none bg-black text-white">
      
      {/* TEXTOS ORIGINALES */}
      <div className="flex flex-col gap-4 text-white mix-blend-difference z-10">
        <p className="flex text-justify">
          Allthatjazz is a creative collective, based in Berlin and working world wide. 
          Our practice is rooted in explorative and visual craft. 
          We are specialised in shaping visual narratives and digital experiences in the fields of culture, 
          fashion, lifestyle and multimedia. 
          We help brands and artists to elevate their work, engagement and impact.  
          Working 9 to 5, hustling 24/7. For work related stuff, collaborations or inquires, please reach out at:  
        </p>

        <div className="flex flex-col">
          <p>Creative direction, strategy, design and code:</p>
          <p>Joaquin Diaz, Kiko Climent, +++</p>
        </div>

        <div className="flex flex-col">
          <p>Contact:</p>
          <p>info@allthatjazz.com</p>
        </div>

        <p className="flex">SM: @allthatjazz.atelier</p>
      </div>
      
      {/* SELECTED PROJECTS */}
      <div 
        className="flex flex-col gap-4 relative z-10"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <p>Selected Projects:</p>

        <div className="flex flex-col uppercase text-[0.75rem] tracking-[-0.02em]">
          {projects.map((project, i) => (
            <p
              key={i}
              className="cursor-pointer hover:text-gray-400 transition-colors duration-200"
              onMouseEnter={(e) => handleMouseEnter(project.image, e.currentTarget)}
              onMouseLeave={(e) => handleMouseLeaveP(e.currentTarget)}
            >
              {project.name}
            </p>
          ))}
        </div>
      </div>

      {/* IMAGE */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
        <img
          ref={imageRef}
          alt="Project preview"
          className="
            will-change-transform
            object-contain
            w-screen h-screen   /* MOBILE: full viewport */
            md:w-[30%] md:h-auto md:object-contain  /* DESKTOP: como antes */
          "
        />
      </div>

    </div>
  );
}
