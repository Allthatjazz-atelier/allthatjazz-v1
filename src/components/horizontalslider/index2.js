'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Image from 'next/image';

export default function HorizontalSliderMobile() {
  const sliderRef = useRef(null);
  const sliderWrapperRef = useRef(null);
  const slidesRef = useRef([]);
  const animationRef = useRef(null);
  const dataRef = useRef({
    target: 0,
    current: 0,
    ease: 0.12, // Más suave
    maxScroll: 0
  });

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;

    const data = dataRef.current;
    const sliderWrapper = sliderWrapperRef.current;
    const slides = slidesRef.current;

    if (!sliderWrapper) return;

    // Calcular maxScroll inicial
    const calculateMaxScroll = () => {
      if (sliderWrapper) {
        data.maxScroll = sliderWrapper.scrollWidth - window.innerWidth;
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

    // Loop de animación
    const update = () => {
      data.current = lerp(data.current, data.target, data.ease);

      gsap.set(sliderWrapper, {
        x: -data.current,
      });

      updateScaleAndPosition();

      animationRef.current = requestAnimationFrame(update);
    };

    // Event listeners
    const handleResize = () => {
      calculateMaxScroll();
    };

    // SCROLL VERTICAL para controlar el slider horizontal
    const handleWheel = (e) => {
      // Usar deltaY (scroll vertical) para mover horizontalmente
      data.target += e.deltaY * 1.5; // Multiplicador para más sensibilidad
      data.target = Math.max(0, data.target);
      data.target = Math.min(data.maxScroll, data.target);
    };

    // Touch events para móvil (también vertical)
    let touchStartY = 0;
    let touchStartTarget = 0;

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartTarget = data.target;
    };

    const handleTouchMove = (e) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      
      data.target = touchStartTarget + deltaY * 2; // Multiplicador para sensibilidad
      data.target = Math.max(0, data.target);
      data.target = Math.min(data.maxScroll, data.target);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Iniciar animación
    update();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="slider-container">
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
                draggable={false}
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
          position: relative;
        }

        .slider-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 40px;
          padding: 0 50vw;
          will-change: transform;
        }

        .slide {
          width: 280px;
          height: 380px;
          position: relative;
          flex-shrink: 0;
          pointer-events: none;
        }

        .slide img {
          user-select: none;
          -webkit-user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </div>
  );
}