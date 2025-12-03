import { useEffect } from "react";

export default function useScramble(ref, { duration = 0.5, charDelay = 0.05, iterations = 5 } = {}) {
  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;

    const scramble = () => {
      const originalText = element.textContent;
      const chars = originalText.split("");

      // limpiar antes de empezar
      element.textContent = originalText;

      chars.forEach((c, i) => {
        let count = 0;
        const interval = setInterval(() => {
          element.textContent = 
            element.textContent
              .split("")
              .map((ch, idx) => (idx === i ? randomChar() : ch))
              .join("");

          count++;
          if (count >= iterations) {
            clearInterval(interval);
            // restaurar el carácter original
            element.textContent = 
              element.textContent
                .split("")
                .map((ch, idx) => (idx === i ? c : ch))
                .join("");
          }
        }, (duration * 1000) / iterations);
      });
    };

    const randomChar = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      return chars[Math.floor(Math.random() * chars.length)];
    };

    element.addEventListener("mouseenter", scramble);
    return () => element.removeEventListener("mouseenter", scramble);
  }, [ref, duration, charDelay, iterations]);
}
