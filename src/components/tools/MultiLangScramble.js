import { useEffect, useRef } from "react";

export default function useMultilangScramble(
  ref,
  {
    duration = 0.3,
    iterations = 5,
    wordDelay = 800,
    words = [],
    finalText = "allthatjazz",
    firstWordEnglish = null, // <-- nuevo parámetro opcional
  } = {}
) {
  const firstHoverDone = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;

    let isHovering = false;
    let hoverInterval = null;
    let letterIntervals = [];

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789あいうえお漢字العربيةРусскийΑλφάβητοไทย";
    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];

    const scrambleWord = (word) => {
      letterIntervals.forEach(clearInterval);
      letterIntervals = [];

      const spans = word.split("").map((c) => {
        const span = document.createElement("span");
        span.textContent = c;
        element.appendChild(span);
        return span;
      });

      spans.forEach((span, i) => {
        let count = 0;
        const interval = setInterval(() => {
          if (!isHovering) {
            clearInterval(interval);
            element.textContent = finalText;
            return;
          }
          span.textContent = randomChar();
          count++;
          if (count >= iterations) {
            clearInterval(interval);
            span.textContent = word[i];
          }
        }, (duration * 1000) / iterations);

        letterIntervals.push(interval);
      });
    };

    const startScramble = () => {
      if (hoverInterval) return;
      isHovering = true;
      let index = 0;

      // preparar array temporal
      const scrambleWords =
        !firstHoverDone.current && firstWordEnglish
          ? [firstWordEnglish, ...words.filter((w) => w !== firstWordEnglish)]
          : words;

      const next = () => {
        if (!isHovering) return;
        element.textContent = "";
        scrambleWord(scrambleWords[index]);
        index = (index + 1) % scrambleWords.length;
      };

      next();
      firstHoverDone.current = true;

      hoverInterval = setInterval(() => {
        if (!isHovering) {
          clearInterval(hoverInterval);
          hoverInterval = null;
          letterIntervals.forEach(clearInterval);
          letterIntervals = [];
          element.textContent = finalText;
          return;
        }
        next();
      }, wordDelay);
    };

    const stopScramble = () => {
      isHovering = false;
      if (hoverInterval) {
        clearInterval(hoverInterval);
        hoverInterval = null;
      }
      letterIntervals.forEach(clearInterval);
      letterIntervals = [];
      element.textContent = finalText;
    };

    element.addEventListener("mouseenter", startScramble);
    element.addEventListener("mouseleave", stopScramble);

    return () => {
      element.removeEventListener("mouseenter", startScramble);
      element.removeEventListener("mouseleave", stopScramble);
      stopScramble();
    };
  }, [ref, duration, iterations, wordDelay, words, finalText, firstWordEnglish]);
}
