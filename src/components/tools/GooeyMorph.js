'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// SVG paths for each vowel, within a 256×256 viewBox
const VOWEL_PATHS = {
  A: "M60,210 L128,46 L196,210 M85,150 L171,150",
  E: "M170,50 L86,50 L86,210 L170,210 M86,130 L152,130",
  I: "M100,50 L156,50 M128,50 L128,210 M100,210 L156,210",
  O: "M128,46 C88,46 60,82 60,128 C60,174 88,210 128,210 C168,210 196,174 196,128 C196,82 168,46 128,46",
  U: "M80,46 L80,168 C80,205 176,205 176,168 L176,46",
};

const VOWELS = Object.keys(VOWEL_PATHS);
const VOWEL_DEFS = Object.values(VOWEL_PATHS);
const NB_CIRCLES = 35;
const RADIUS = 16;

export default function GooeyMorph() {
  const [index, setIndex] = useState(0);
  const circlesRef = useRef([]);
  const pathsRef = useRef([]);

  useEffect(() => {
    const currentPath = pathsRef.current[index];
    if (!currentPath) return;

    const length = currentPath.getTotalLength();
    const step = length / NB_CIRCLES;

    circlesRef.current.forEach((circle, i) => {
      if (!circle) return;
      const { x, y } = currentPath.getPointAtLength(i * step);
      animate(
        circle,
        { cx: x, cy: y },
        { delay: i * 0.02, duration: 0.6, ease: 'easeOut' }
      );
    });
  }, [index]);

  return (
    <main className="h-screen flex items-center justify-center gap-12"
      style={{ background: '#ffffff' }}>

      {/* Vowel selector */}
      <nav className="flex flex-col gap-5">
        {VOWELS.map((vowel, i) => (
          <button
            key={vowel}
            onClick={() => setIndex(i)}
            className="relative text-4xl font-black tracking-widest transition-all duration-300 cursor-pointer select-none"
            style={{
              fontFamily: "'Georgia', serif",
              color: i === index ? '#111111' : '#bbbbbb',
              textShadow: 'none',
              transform: i === index ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {vowel}
            {i === index && (
              <span
                className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full"
                style={{ background: '#111111' }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Gooey SVG */}
      <div className="relative">
        

        <svg
          viewBox="0 0 256 256"
          style={{
            width: '420px',
            filter: "url('#gooey-filter')",
          }}
        >
          <defs>
            <filter id="gooey-filter">
              <feGaussianBlur in="SourceAlpha" stdDeviation="18" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12"
                result="filtered"
              />
            </filter>
          </defs>

          {/* Hidden paths — only used for measurements */}
          <g style={{ display: 'none' }}>
            {VOWEL_DEFS.map((d, i) => (
              <path
                key={`path-${i}`}
                ref={(el) => (pathsRef.current[i] = el)}
                d={d}
              />
            ))}
          </g>

          {/* Animated circles */}
          <g>
            {[...Array(NB_CIRCLES)].map((_, i) => (
              <circle
                key={`circle-${i}`}
                ref={(el) => (circlesRef.current[i] = el)}
                cx="128"
                cy="128"
                r={RADIUS}
                fill="#111111"
              />
            ))}
          </g>
        </svg>
      </div>
    </main>
  );
}