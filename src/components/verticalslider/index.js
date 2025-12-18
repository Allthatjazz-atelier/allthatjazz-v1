'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Image from 'next/image';

export default function VerticalSlider() {
  const sliderRef = useRef(null);
  const sliderWrapperRef = useRef(null);
  const slidesRef = useRef([]);
  const animationRef = useRef(null);
  const dataRef = useRef({
    target: 0,
    current: 0,
    ease: 0.075,
    maxScroll: 0
  });

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;

    const data = dataRef.current;
    const sliderWrapper = sliderWrapperRef.current;
    const slides = slidesRef.current;

    // Calcular maxScroll inicial
    const calculateMaxScroll = () => {
      if (sliderWrapper) {
        data.maxScroll = sliderWrapper.offsetHeight - window.innerHeight;
      }
    };

    calculateMaxScroll();

    // Función lerp
    const lerp = (start, end, factor) => {
      return start + (end - start) * factor;
    };

    // Actualizar escala y posición de los slides
    const updateScaleAndPosition = () => {
      slides.forEach((slide) => {
        if (!slide) return;
        
        const rect = slide.getBoundingClientRect();
        const centerPosition = (rect.top + rect.bottom) / 2;
        const distanceFromCenter = centerPosition - window.innerHeight / 2;

        let scale, offsetY;
        if (distanceFromCenter > 0) {
          // Slides que vienen desde abajo
          scale = Math.min(1.75, 1 + distanceFromCenter / window.innerHeight);
          offsetY = (scale - 1) * 300;
        } else {
          // Slides que van saliendo por arriba
          scale = Math.max(0.5, 1 - Math.abs(distanceFromCenter) / window.innerHeight);
          offsetY = 0;
        }

        gsap.set(slide, { scale: scale, y: offsetY });
      });
    };

    // Loop de animación
    const update = () => {
      data.current = lerp(data.current, data.target, data.ease);

      gsap.set(sliderWrapper, {
        y: -data.current,
      });

      updateScaleAndPosition();

      animationRef.current = requestAnimationFrame(update);
    };

    // Event listeners
    const handleResize = () => {
      calculateMaxScroll();
    };

    const handleWheel = (e) => {
      data.target += e.deltaY;
      data.target = Math.max(0, data.target);
      data.target = Math.min(data.maxScroll, data.target);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('wheel', handleWheel);

    // Iniciar animación
    update();

    // Cleanup
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
      <div className='absolute w-screen flex justify-center items-center min-h-screen text-[1.35rem] text-black mix-blend-difference z-200'>
        <p className='bg-white px-6'>coming soon</p>
      </div>
      <div ref={sliderRef} className="slider">
        <div ref={sliderWrapperRef} className="slider-wrapper">
          {[...Array(19)].map((_, index) => (
            <div
              key={index}
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
          left: 0;
          height: 12200px;
          padding: 600px 0;
          width: 100%;
          display: flex;
          flex-direction: column;
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