'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Image from 'next/image';

export default function HorizontalSliderMobile() {
  const sliderRef = useRef(null);
  const sliderWrapperRef = useRef(null);
  const slidesRef = useRef([]);
  const animationRef = useRef(null);
  const touchRef = useRef({
    lastY: 0,
    lastTime: 0,
    velocity: 0
  });
  const dataRef = useRef({
    target: 0,
    current: 0,
    ease: 0.075, // Igual que desktop
    maxScroll: 0
  });

  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;

    const data = dataRef.current;
    const touch = touchRef.current;
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

    // Wheel event - ahora usando deltaX para scroll horizontal
    const handleWheel = (e) => {
      // Usar deltaX para scroll horizontal, fallback a deltaY si no hay deltaX
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      data.target += delta;
      data.target = Math.max(0, data.target);
      data.target = Math.min(data.maxScroll, data.target);
    };

    // Touch events - scroll HORIZONTAL
    const handleTouchStart = (e) => {
      touch.lastY = e.touches[0].clientX; // Ahora usa clientX
      touch.lastTime = Date.now();
      touch.velocity = 0;
    };

    const handleTouchMove = (e) => {
      const currentX = e.touches[0].clientX; // clientX para horizontal
      const currentTime = Date.now();
      const deltaX = touch.lastY - currentX; // Delta horizontal
      const deltaTime = currentTime - touch.lastTime;
      
      // Calcular velocidad
      if (deltaTime > 0) {
        touch.velocity = deltaX / deltaTime;
      }
      
      // Aplicar el delta directamente, como en desktop
      data.target += deltaX;
      data.target = Math.max(0, data.target);
      data.target = Math.min(data.maxScroll, data.target);
      
      touch.lastY = currentX;
      touch.lastTime = currentTime;
    };

    const handleTouchEnd = () => {
      // Aplicar inercia suave basada en velocidad
      const inertia = touch.velocity * 50;
      data.target += inertia;
      data.target = Math.max(0, data.target);
      data.target = Math.min(data.maxScroll, data.target);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // Iniciar animación
    update();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
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
          touch-action: pan-x; /* Permite scroll horizontal */
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