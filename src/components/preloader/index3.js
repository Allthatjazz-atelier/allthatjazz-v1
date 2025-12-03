"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const Preloader3 = () => {
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

      // split intro, outro y subtítulo
      splitTextElements(".intro-title h1", "words,chars", true);
      splitTextElements(".outro-title h1", "words,chars");
      splitTextElements(".sub-title h1", "words,chars");

      const tl = gsap.timeline({ defaults: { ease: "hop" } });

      // animación de ALLTHATJAZZ
      tl.to(".preloader .intro-title .char span", { y: "0%", duration: 0.75, stagger: 0.05 }, 0.5)
        .to(".preloader .intro-title .char span", { y: "100%", duration: 0.75, stagger: 0.05 }, 2)
        // animación de ATELIER
        .to(".preloader .outro-title .char span", { y: "0%", duration: 0.75, stagger: 0.05 }, 2.5)
        // animación del subtítulo debajo de ATELIER
        .to(".preloader .sub-title", { opacity: 1, duration: 0.1 }, 3.5)
        .to(".preloader .sub-title .char span", { y: "0%", duration: 0.75, stagger: 0.03, ease: "hop" }, 3.6);

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
          <h1>atelier</h1>
        </div>
        <div className="sub-title">
          <h1>de creation graphique et digital</h1>
        </div>
      </div>
    </div>
  );
};

export default Preloader3;
