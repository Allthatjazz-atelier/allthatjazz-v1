"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const Preloader = () => {
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

              if (addFirstChar && index === 0) {
                char.classList.add("first-char");
              }

              if (index === 3) {
                char.classList.add("stay-char");
              }
            });
          }
        });
      };

      // split intro/outro
      splitTextElements(".intro-title h1", "words,chars", true);
      splitTextElements(".outro-title h1");

      // referencia a elementos ya creados
      const tChar = containerRef.current.querySelector(
        ".intro-title .stay-char"
      );
      const outro = containerRef.current.querySelector(
        ".preloader .outro-title"
      );

      let offsetX = 0;
      if (tChar && outro) {
        const tRect = tChar.getBoundingClientRect();
        const outroRect = outro.getBoundingClientRect();
        offsetX = tRect.right - outroRect.left;
      }

      const isMobile = window.innerWidth <= 1000;

      gsap.set(
        [
          ".split-overlay .intro-title .first-char span",
          ".split-overlay .outro-title .char span",
        ],
        { y: "0%" }
      );

      gsap.set(".split-overlay .intro-title .first-char", {
        fontWeight: "900",
      });

      gsap.set(".split-overlay .outro-title .char", {
        x: isMobile ? "-3rem" : "-8rem",
        fontSize: isMobile ? "6rem" : "14rem",
        fontWeight: "500",
      });

      const tl = gsap.timeline({ defaults: { ease: "hop" } });
      const tags = gsap.utils.toArray(".tag");

      tags.forEach((tag, index) => {
        tl.to(
          tag.querySelectorAll("p .word"),
          {
            y: "0%",
            duration: 0.75,
          },
          0.5 + index * 0.1
        );
      });

      tl.to(
        ".preloader .intro-title .char span",
        {
          y: "0%",
          duration: 0.75,
          stagger: 0.05,
        },
        0.5
      )
        .to(
          ".preloader .intro-title .char:not(.first-char):not(.stay-char) span",
          {
            y: "100%",
            duration: 0.75,
            stagger: 0.05,
          },
          2
        )
        .to(
          ".preloader .outro-title .char span",
          {
            y: "0%",
            duration: 0.75,
            stagger: 0.075,
          },
          2.5
        )
        .to(
          ".preloader .intro-title .first-char",
          {
            x: isMobile ? "9rem" : "21.25rem",
            duration: 1,
          },
          3.5
        )
        .to(
          ".preloader .outro-title .char",
          {
            x: isMobile ? "-3rem" : "-8rem",
            duration: 1,
          },
          3.5
        )
        .to(
          ".preloader .intro-title .first-char",
          {
            x: `-=${isMobile ? "0.5rem" : "18.3rem"}`,
            y: 0,
            scale: 1,
            fontWeight: "900",
            duration: 0.75,
          },
          4.5
        )
        .to(
          outro,
          {
            x: `+=${offsetX}`,
            duration: 1,
            ease: "hop",
          },
          3.5
        )
        .to(
          ".preloader .outro-title .char",
          {
            x: 0,
            fontWeight: "500",
            duration: 1,
            onComplete: () => {
              gsap.set(".preloader", {
                clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)",
              });
              gsap.set(".split-overlay", {
                clipPath: "polygon(0 50%, 100% 50%, 100% 100%, 0 100%)",
              });
            },
          },
          4.5
        );
    }, containerRef);

    return () => ctx.revert(); // cleanup
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
      </div>
      <div className="split-overlay">
        <div className="intro-title">
          <h1>allthatjazz</h1>
        </div>
        <div className="outro-title">
          <h1>elier</h1>
        </div>
      </div>
    </div>
  );
};

export default Preloader;
