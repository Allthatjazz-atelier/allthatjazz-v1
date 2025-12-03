"use client";

// import RevealImage from "../tools/RevealImage";
import RevealImage2 from "../tools/RevealImage2";
import RevealImage3 from "../tools/RevealImage3";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

const Slider5 = () => {
  const sliderRef = useRef(null);
  const [revealDone, setRevealDone] = useState(false);

  useEffect(() => {
    if (!revealDone || !sliderRef.current) return;

    const slides = sliderRef.current.querySelectorAll(".slide");
    gsap.set(slides, { opacity: 0, willChange: "opacity" });

    const [img1, img2, img3, img4, img5, img6] = slides;

    const sequence = [
      { show: [img1], wait: 0.8 },
      { hide: [img1], wait: 0 },
      { show: [img2], wait: 0.4 },
      { show: [img3], wait: 0.8 },
      { hide: [img2, img3], wait: 0 },
      { show: [img4], wait: 0.4 },
      { show: [img5], wait: 0.8 },
      { hide: [img4], wait: 0.8 },
      { show: [img6], wait: 0.4 },
      { hide: [img5], wait: 0.4 },
      { hide: [img6], wait: 0.8 },
    ];

    const tl = gsap.timeline({ repeat: -1 });
    sequence.forEach((step) => {
      if (step.show) tl.to(step.show, { opacity: 1, duration: 0.3, ease: "power2.inOut" });
      if (step.hide) tl.to(step.hide, { opacity: 0, duration: 0.3, ease: "power2.inOut" });
      if (step.wait) tl.to({}, { duration: step.wait * 0.5 }); // 👈 todo 2x más rápido
    });
    

    return () => tl.kill();
  }, [revealDone]);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-start pt-12 bg-white">
      <div
        ref={sliderRef}
        className="relative w-11/12 aspect-[3/4]"
      >
        {/* Primera imagen con reveal */}
        <div className="slide absolute top-1/2 left-1/2 w-[100%] px-4 transform -translate-x-1/2 -translate-y-1/2 z-[2]">
          {!revealDone ? (
            <RevealImage3
              src="/assets/img2.jpeg"
              alt="img2"
              className="w-full h-full object-contain"
              onComplete={() => setRevealDone(true)}
            />
          ) : (
            <img
              src="/assets/img2.jpeg"
              className="w-full h-full object-contain"
              alt="img2"
            />
          )}
        </div>

        {/* Resto de las imágenes */}
        <div className="slide absolute top-[55%] left-[41.2%] w-[75%] transform -translate-x-1/2 -translate-y-1/2 z-[3]" style={{ opacity: revealDone ? 1 : 0 }}>
          <img src="/assets/img16.jpeg" className="w-full h-full object-contain" alt="img16" />
        </div>
        <div className="slide absolute top-[35%] left-[66.3%] w-[60%] transform -translate-x-1/2 -translate-y-1/2 z-[4]" style={{ opacity: revealDone ? 1 : 0 }}>
          <img src="/assets/img89.jpeg" className="w-full h-full object-contain" alt="img89" />
        </div>
        <div className="slide absolute top-[27%] left-[33.8%] w-[60%] transform -translate-x-1/2 -translate-y-1/2 z-[5]" style={{ opacity: revealDone ? 1 : 0 }}>
          <img src="/assets/img51.jpeg" className="w-full h-full object-contain" alt="img51" />
        </div>
        <div className="slide absolute top-[72%] left-[68.9%] w-[55%] transform -translate-x-1/2 -translate-y-1/2 z-[6]" style={{ opacity: revealDone ? 1 : 0 }}>
          <img src="/assets/img98.jpeg" className="w-full h-full object-contain" alt="img98" />
        </div>
        <div className="slide absolute top-[50%] left-[50%] w-[100%] transform -translate-x-1/2 -translate-y-1/2 z-[5]" style={{ opacity: revealDone ? 1 : 0 }}>
          <img src="/assets/img84.jpeg" className="w-full h-full object-contain" alt="img98" />
        </div>
      </div>
      <div className="w-11/12 mt-1">
        <p className="text-[0.875rem] text-left">Explorations visuelles 2004-2025</p>
      </div>
    </div>
  );
}

export default Slider5;
