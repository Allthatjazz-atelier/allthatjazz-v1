'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Image from 'next/image';

export default function HorizontalSlider() {
  const sliderRef = useRef(null);
  const sliderWrapperRef = useRef(null);
  const slidesRef = useRef([]);
  const animationRef = useRef(null);
  const dataRef = useRef({
    target: 0,
    current: 0,
    ease: 0.075,
    slideWidth: 0,
    totalWidth: 0
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const data = dataRef.current;
    const sliderWrapper = sliderWrapperRef.current;
    const slides = slidesRef.current;

    // Calcular dimensiones
    const calculateDimensions = () => {
      if (slides.length > 0 && slides[0]) {
        const slideRect = slides[0].getBoundingClientRect();
        data.slideWidth = slideRect.width + 100; // slide + gap
        // Ancho total de UN set (19 imágenes)
        data.totalWidth = data.slideWidth * 19;
      }
    };

    calculateDimensions();

    const lerp = (start, end, factor) => {
      return start + (end - start) * factor;
    };

    const updateScaleAndPosition = () => {
      slides.forEach((slide) => {
        if (!slide) return;
        
        const rect = slide.getBoundingClientRect();
        const centerPosition = (rect.left + rect.right) / 2;
        const distanceFromCenter = centerPosition - window.innerWidth / 2;

        let scale, offsetX;
        if (distanceFromCenter > 0) {
          scale = Math.min(1.75, 1 + distanceFromCenter / window.innerWidth);
          offsetX = (scale - 1) * 300;
        } else {
          scale = Math.max(0.5, 1 - Math.abs(distanceFromCenter) / window.innerWidth);
          offsetX = 0;
        }

        gsap.set(slide, { scale: scale, x: offsetX });
      });
    };

    const update = () => {
      data.current = lerp(data.current, data.target, data.ease);

      // Loop infinito suave: reposicionar cuando sea necesario
      // Si nos movemos hacia adelante y pasamos el segundo set
      if (data.current > data.totalWidth * 2) {
        data.current -= data.totalWidth;
        data.target -= data.totalWidth;
      }
      // Si nos movemos hacia atrás y pasamos el primer set
      else if (data.current < data.totalWidth) {
        data.current += data.totalWidth;
        data.target += data.totalWidth;
      }

      gsap.set(sliderWrapper, {
        x: -data.current,
      });

      updateScaleAndPosition();

      animationRef.current = requestAnimationFrame(update);
    };

    // Inicializar en el set del medio para permitir scroll en ambas direcciones
    data.current = data.totalWidth;
    data.target = data.totalWidth;

    const handleResize = () => {
      calculateDimensions();
    };

    const handleWheel = (e) => {
      data.target += e.deltaY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('wheel', handleWheel);

    update();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('wheel', handleWheel);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="slider-container">
      <div ref={sliderRef} className="slider">
        <div ref={sliderWrapperRef} className="slider-wrapper">
          {/* Set 1 - Para scroll hacia atrás */}
          {[...Array(19)].map((_, index) => (
            <div
              key={`set1-${index}`}
              ref={(el) => (slidesRef.current[index] = el)}
              className="slide"
            >
              <Image
                src={`/hero/img${index + 1}.png`}
                alt={`Slide ${index + 1}`}
                fill
                style={{ objectFit: 'contain' }}
                priority={index < 3}
              />
            </div>
          ))}
          {/* Set 2 - Set central (inicio visible) */}
          {[...Array(19)].map((_, index) => (
            <div
              key={`set2-${index}`}
              ref={(el) => (slidesRef.current[19 + index] = el)}
              className="slide"
            >
              <Image
                src={`/hero/img${index + 1}.png`}
                alt={`Slide ${index + 1}`}
                fill
                style={{ objectFit: 'contain' }}
              />
            </div>
          ))}
          {/* Set 3 - Para scroll hacia adelante */}
          {[...Array(19)].map((_, index) => (
            <div
              key={`set3-${index}`}
              ref={(el) => (slidesRef.current[38 + index] = el)}
              className="slide"
            >
              <Image
                src={`/hero/img${index + 1}.png`}
                alt={`Slide ${index + 1}`}
                fill
                style={{ objectFit: 'contain' }}
              />
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .slider-container {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          position: relative;
        }

        .slider {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .slider-wrapper {
          position: absolute;
          top: 0;
          width: 24000px;
          padding: 0 600px;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 100px;
        }

        .slide {
          width: 400px;
          height: 500px;
          position: relative;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}