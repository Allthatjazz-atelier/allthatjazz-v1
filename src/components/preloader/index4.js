"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const Preloader5 = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(async () => {
      const { CustomEase } = await import("gsap/CustomEase");
      const { SplitText } = await import("gsap/SplitText");

      gsap.registerPlugin(CustomEase, SplitText);
      CustomEase.create("hop", ".8, 0, .3, 1");

      const splitTextElements = (selector, type = "words,chars", addFirstChar = false) => {
        const elements = containerRef.current.querySelectorAll(selector);
        elements.forEach((element) => {
          const splitText = new SplitText(element, {
            type,
            wordsClass: "word",
            charsClass: "char",
          });

          if (type.includes("chars")) {
            splitText.chars.forEach((char, index) => {
              const originalText = char.textContent;
              char.innerHTML = `<span>${originalText}</span>`;
              if (addFirstChar && index === 0) char.classList.add("first-char");
            });
          }
        });
      };

      // Split de los textos
      splitTextElements(".intro-title h1", "words,chars", true);
      splitTextElements(".outro-title h1", "words,chars");
      splitTextElements(".sub-title h1", "words,chars");

      const tl = gsap.timeline({ defaults: { ease: "hop" } });

      // Preloader visible
      tl.set([".preloader", ".split-overlay"], { opacity: 1 });

      // Animación de textos
      tl.to(".preloader .intro-title .char span", { y: "0%", duration: 0.75, stagger: 0.05, opacity: 1 }, 0.5)
        .to(".preloader .intro-title .char span", { y: "100%", duration: 0.75, stagger: 0.05 }, 2)
        .to(".preloader .outro-title .char span", { y: "0%", duration: 0.75, stagger: 0.05 }, 2.5)
        .to(".preloader .sub-title", { opacity: 1, duration: 0.1 }, 3.5)
        .to(".preloader .sub-title .char span", { y: "0%", duration: 0.75, stagger: 0.03, ease: "hop" }, 3.6)
        // Animación split-overlay para revelar contenido
        .to(".split-overlay", { clipPath: "polygon(0% 50%, 100% 50%, 100% 100%, 0% 100%)", duration: 0.75, delay: 0.3 })
        // Preloader desaparece
        .to([".preloader", ".split-overlay"], { y: (i) => (i === 0 ? "-100%" : "100%"), duration: 1 }, "+=0.2")
        // Revela HeaderFooter y contenido
        .to("#header-footer-wrapper", { opacity: 1, duration: 0.5 }, "+=0.2")
        .to("#page-content", { 
          opacity: 1, 
          duration: 0.5, 
          onStart: () => { document.body.style.overflow = "auto"; },
          onComplete: () => { containerRef.current.style.display = "none"; }
        }, "+=0.1");

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="maincontainer-preloder" ref={containerRef}>
      {/* Preloader de textos */}
      <div className="preloader">
        <div className="intro-title"><h1>allthatjazz</h1></div>
        <div className="outro-title"><h1>atelier</h1></div>
        <div className="sub-title"><h1>de creation graphique et digital</h1></div>
      </div>

      {/* Split overlay para animación clip-path */}
      <div className="split-overlay">
        <div className="intro-title"><h1>allthatjazz</h1></div>
        <div className="outro-title"><h1>atelier</h1></div>
        <div className="sub-title"><h1>de creation graphique et digital</h1></div>
      </div>
    </div>
  );
};

export default Preloader5;
