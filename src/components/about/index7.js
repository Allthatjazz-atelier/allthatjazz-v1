import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function AboutSection7() {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const paragraphs = el.querySelectorAll('[data-reveal]');

    // Blur agresivo desde el primer frame — mancha visible pero ilegible
    gsap.set(paragraphs, { filter: 'blur(14px)' });

    // Se despeja escalonado sin delay — empieza a la vez que el clip-path
    gsap.to(paragraphs, {
      filter:   'blur(0px)',
      duration: 1.5,
      ease:     'power2.out',
      stagger:  0.18,
    });

    return () => gsap.killTweensOf(paragraphs);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen gap-12 flex flex-col text-[0.875rem] md:text-[0.875rem] tracking-[-0.04em] items-center justify-start pt-[16vh] md:pt-0 md:justify-center px-4 leading-none text-center"
    >
      <div className="flex flex-col z-10 w-[100vw] md:w-[40vw] px-4">

        <p
          data-reveal
          className="flex font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] mb-[2rem]"
        >
          A creative collective based in Berlin, playing Worldwide. <br />
          Blending digital craft with analog attitude. Exploring and shaping
          visual narratives and experiences that resonate through culture,
          music, fashion, lifestyle and multimedia. Hustling 24/7.
        </p>

        <p
          data-reveal
          className="flex font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] mb-[4rem]"
        >
          Creative direction, strategy, digital and web experiences, design
          and code are part of our playground
        </p>

        <div data-reveal className="flex flex-col">
          <p className="font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1]">
            For collaborations or inquires, please reach out at:
          </p>
          <p className="font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1]">
            hello@allthatjazz.com
          </p>
          <p className="uppercase font-semibold text-[0.625rem] tracking-[-0.045em] leading-[1.1] mt-1">
            joaquin diaz, kiko Climent, +++
          </p>
        </div>

      </div>
    </div>
  );
}