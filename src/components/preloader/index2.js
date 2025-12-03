"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const Preloader2 = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(async () => {
      const { CustomEase } = await import("gsap/CustomEase");
      const { SplitText } = await import("gsap/SplitText");

      gsap.registerPlugin(CustomEase, SplitText);
      CustomEase.create("hop", ".8, 0, .3, 1");

      const splitTextElements = (
        selector,
        type = "words,chars",
        addFirstChar = false
      ) => {
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
              if (index === 3) char.classList.add("stay-char"); // char que se queda
            });
          }
        });
      };

      // split intro, outro y subtítulo
      splitTextElements(".intro-title h1", "words,chars", true);
      splitTextElements(".outro-title h1");
      splitTextElements(".sub-title h1", "words,chars");

      const isMobile = window.innerWidth <= 1000;

      // subtítulo inicial fuera de vista
      gsap.set(".preloader .sub-title .char span", {
        y: "100%",
        fontSize: isMobile ? "1rem" : "1.5rem",
        fontWeight: "300",
      });

      // referencias
      const tChar = containerRef.current.querySelector(".intro-title .stay-char");
      const outro = containerRef.current.querySelector(".preloader .outro-title");

      let offsetX = 0;
      if (tChar && outro) {
        const tRect = tChar.getBoundingClientRect();
        const outroRect = outro.getBoundingClientRect();
        offsetX = tRect.right - outroRect.left;
      }

      const tl = gsap.timeline({ defaults: { ease: "hop" } });

      // animaciones principales de ATELIER
      tl.to(".preloader .intro-title .char span", { y: "0%", duration: 0.75, stagger: 0.05 }, 0.5)
        .to(".preloader .intro-title .char:not(.first-char):not(.stay-char) span", { y: "100%", duration: 0.75, stagger: 0.05 }, 2)
        .to(".preloader .outro-title .char span", { y: "0%", duration: 0.75, stagger: 0.075 }, 2.5)
        .to(".preloader .intro-title .first-char", { x: isMobile ? "9rem" : "21.25rem", duration: 1 }, 3.5)
        .to(".preloader .outro-title .char", { x: isMobile ? "-3rem" : "-8rem", duration: 1 }, 3.5)
        .to(".preloader .intro-title .first-char", { x: `-=${isMobile ? "0.5rem" : "14rem"}`, y: 0, scale: 1, fontWeight: "900", duration: 0.75 }, 4.5)
        .to(outro, { x: `+=${offsetX}`, duration: 1, ease: "hop" }, 3.5)
        .to(".preloader .outro-title .char", { x: isMobile ? "-3rem" : "2rem", fontWeight: "500", duration: 1 }, 4.5)
        // ajustar manualmente chars para centrar ATELIER
        .to(".preloader .intro-title .stay-char", { x: "2rem", duration: 0.5 }, 4.6) // mover T completa
        .to(".preloader .intro-title .char:nth-child(1)", { x: "1.5rem", duration: 0.5 }, 4.6) // ejemplo mover A
        // animación del subtítulo
        .to(".preloader .sub-title", { opacity: 1, duration: 0.1 }, 5.5)
        .to(".preloader .sub-title .char span", { y: "0%", duration: 0.75, stagger: 0.03, ease: "hop" }, 5.6);

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="maincontainer-preloder" ref={containerRef}>
      <div className="preloader">
        <div className="intro-title">
          <h1>allthatjazz</h1>
        </div>
        <div className="outro-title">
          <h1>elier</h1>
        </div>
        <div className="sub-title">
          <h1>de creation graphique et digital</h1>
        </div>
      </div>
    </div>
  );
};

export default Preloader2;
