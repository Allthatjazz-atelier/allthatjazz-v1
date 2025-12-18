'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Image from 'next/image';

export default function VerticalSlider() {
  const wrapperRef = useRef(null);
  const slidesRef = useRef([]);
  const rafRef = useRef(null);

  const data = useRef({
    current: 0,
    target: 0,
    ease: 0.06,
    maxScroll: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const wrapper = wrapperRef.current;
    const slides = slidesRef.current;

    const calcMaxScroll = () => {
      data.current.maxScroll =
        wrapper.scrollHeight - window.innerHeight;
    };

    const lerp = (a, b, n) => a + (b - a) * n;

    const updateSlides = () => {
      slides.forEach(slide => {
        if (!slide) return;

        const rect = slide.getBoundingClientRect();
        const center =
          (rect.top + rect.bottom) / 2 - window.innerHeight / 2;

        const progress = Math.min(
          Math.abs(center) / window.innerHeight,
          1
        );

        gsap.set(slide, {
          opacity: 1 - progress * 0.35,
        });
      });
    };

    const animate = () => {
      data.current.current = lerp(
        data.current.current,
        data.current.target,
        data.current.ease
      );

      gsap.set(wrapper, {
        y: -data.current.current,
      });

      updateSlides();
      rafRef.current = requestAnimationFrame(animate);
    };

    const onWheel = e => {
      data.current.target += e.deltaY;
      data.current.target = Math.max(0, data.current.target);
      data.current.target = Math.min(
        data.current.maxScroll,
        data.current.target
      );
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', calcMaxScroll);

    calcMaxScroll();
    animate();

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', calcMaxScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="editorial-slider">
      <div ref={wrapperRef} className="editorial-wrapper">
        {[...Array(19)].map((_, i) => (
          <section
            key={i}
            ref={el => (slidesRef.current[i] = el)}
            className="editorial-slide"
          >
            <div className="image-frame">
              <Image
                src={`/hero/img${i + 1}.png`}
                alt={`Editorial ${i + 1}`}
                fill
                priority={i === 0}
                style={{ objectFit: 'contain' }}
              />
            </div>
          </section>
        ))}
      </div>

      <style jsx>{`
        .editorial-slider {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: white;
        }

        .editorial-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
        }

        /* SLIDES PEGADOS */
        .editorial-slide {
          width: 100%;
          height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .image-frame {
          position: relative;
          width: 60vw;
          height: 100%;
        }

        @media (max-width: 768px) {
          .image-frame {
            width: 85vw;
          }
        }
      `}</style>
    </div>
  );
}
