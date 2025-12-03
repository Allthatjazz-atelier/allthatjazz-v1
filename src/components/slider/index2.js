"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const Slider2 = () => {
  const sliderRef = useRef(null);

  useEffect(() => {
    if (!sliderRef.current) return;

    const slides = sliderRef.current.querySelectorAll(".slide");

    // Ocultamos todas de inicio
    gsap.set(slides, { opacity: 0 });

    const tl = gsap.timeline({ repeat: -1 });

    slides.forEach((slide, i) => {
      tl.set(slides, { opacity: 0 }) // apaga todas
        .set(slide, { opacity: 1 }) // enciende solo una
        .to({}, { duration: 1.2 }); // espera 1.2s antes de pasar a la siguiente
    });

    return () => tl.kill();
  }, []);

  return (
    <div ref={sliderRef} className="w-screen h-screen overflow-hidden relative">
      {/* Image1 */}
      <div className="slide absolute top-1/2 left-1/2 w-[100%] px-4 transform -translate-x-1/2 -translate-y-1/2 z-[1]">
        <img src="/assets/img2.jpeg" className="w-full h-full object-contain" alt="img15" />
      </div>

      {/* Text */}
      <div className="absolute w-[100%] top-[77%] pl-4">
        <p className="text-[0.875rem] text-left">Explorations visuelles 2004-2025</p>
      </div>

      {/* Image2 */}
      <div className="slide absolute top-[55%] left-[41.2%] transform -translate-x-1/2 -translate-y-1/2 w-[75%] z-[2]">
        <img src="/assets/img16.jpeg" className="w-full h-full object-contain" alt="img10" />
      </div>

      {/* Image3 */}
      <div className="slide absolute top-[35%] left-[66.3%] transform -translate-x-1/2 -translate-y-1/2 w-[60%] z-[3]">
        <img src="/assets/img89.jpeg" className="w-full h-full object-contain" alt="img10" />
      </div>

      {/* Image4 */}
      <div className="slide absolute top-[27%] left-[33.8%] transform -translate-x-1/2 -translate-y-1/2 w-[60%] z-[4]">
        <img src="/assets/img51.jpeg" className="w-full h-full object-contain" alt="img10" />
      </div>

      {/* Image5 */}
      <div className="slide absolute top-[60.9%] left-[68.9%] transform -translate-x-1/2 -translate-y-1/2 w-[55%] z-[4]">
        <img src="/assets/img98.jpeg" className="w-full h-full object-contain" alt="img10" />
      </div>
    </div>
  );
};

export default Slider2;
