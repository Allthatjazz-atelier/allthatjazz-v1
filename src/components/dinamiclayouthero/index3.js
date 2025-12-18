'use client';

import React, { useEffect, useRef, useState } from 'react';

const DynamicGallery3 = () => {
  const [activeLayout, setActiveLayout] = useState('layout-grid');
  const [isLoaded, setIsLoaded] = useState(false);

  const galleryRef = useRef(null);
  const titleRefs = useRef({});
  const isTransitioning = useRef(false);

  const gsapRef = useRef(null);
  const FlipRef = useRef(null);
  const ScrollToPluginRef = useRef(null);

  const images = Array.from({ length: 19 }, (_, i) => ({
    id: `img${i + 1}`,
    src: `/hero/img${i + 1}.png`,
    alt: `Image ${i + 1}`,
    name: `Nombre ${i + 1}`
  }));

  const layouts = [
    { id: 'layout-grid', label: 'grid' },
    { id: 'layout-scroll', label: 'scroll' }
  ];

  // ─────────────────────────────────────────────
  // GSAP
  // ─────────────────────────────────────────────
  useEffect(() => {
    const loadGSAP = async () => {
      const gsapModule = await import('gsap');
      const flipModule = await import('gsap/Flip');
      const scrollToModule = await import('gsap/ScrollToPlugin');

      gsapRef.current = gsapModule.gsap;
      FlipRef.current = flipModule.Flip;
      ScrollToPluginRef.current = scrollToModule.ScrollToPlugin;

      gsapRef.current.registerPlugin(
        FlipRef.current,
        ScrollToPluginRef.current
      );

      setIsLoaded(true);
    };

    loadGSAP();
  }, []);

  // ─────────────────────────────────────────────
  // Layout switch
  // ─────────────────────────────────────────────
  const switchLayout = (newLayout) => {
    if (newLayout === activeLayout || isTransitioning.current || !isLoaded)
      return;

    isTransitioning.current = true;

    if (activeLayout === 'layout-scroll' && window.scrollY > 0) {
      gsapRef.current.to(window, {
        scrollTo: { y: 0 },
        duration: 0.5,
        ease: 'power3.out',
        onComplete: () => switchLayoutHandler(newLayout)
      });
    } else {
      switchLayoutHandler(newLayout);
    }
  };

  const switchLayoutHandler = (newLayout) => {
    if (!galleryRef.current) return;

    const state = FlipRef.current.getState(
      galleryRef.current.querySelectorAll('.img-item')
    );

    setActiveLayout(newLayout);

    requestAnimationFrame(() => {
      FlipRef.current.from(state, {
        duration: 1.5,
        ease: 'power2.inOut',
        stagger: 0.025,
        onComplete: () => {
          isTransitioning.current = false;
        }
      });

      if (newLayout === 'layout-grid') {
        gsapRef.current.set(galleryRef.current, { clearProps: 'all' });
      }
    });
  };

  // ─────────────────────────────────────────────
  // SCROLL → TÍTULOS (columna fija izquierda)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (activeLayout !== 'layout-scroll') return;

    const stackLeft = 24; // columna fija
    const stackStartTop = 24;
    const stackGap = 18;

    const onScroll = () => {
      images.forEach((img, index) => {
        const imgEl = document.getElementById(img.id);
        const titleEl = titleRefs.current[img.id];
        if (!imgEl || !titleEl) return;

        const imgRect = imgEl.getBoundingClientRect();
        const stackTop = stackStartTop + index * stackGap;

        if (imgRect.top <= stackTop) {
          // ─── STACK ───
          titleEl.style.position = 'fixed';
          titleEl.style.top = `${stackTop}px`;
          titleEl.style.left = `${stackLeft}px`;
          titleEl.style.transform = 'none';
          titleEl.style.zIndex = '40';
        } else {
          // ─── VIAJE VERTICAL ───
          titleEl.style.position = 'absolute';
          titleEl.style.top = `${imgRect.top + window.scrollY}px`;
          titleEl.style.left = `${stackLeft}px`;
          titleEl.style.transform = 'translateY(-100%)';
          titleEl.style.zIndex = '10';
        }
      });
    };

    window.addEventListener('scroll', onScroll);
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, [activeLayout, images]);

  // ─────────────────────────────────────────────
  // Styles (NO TOCADOS)
  // ─────────────────────────────────────────────
  const getImageStyle = (imgId) => {
    const baseStyle = 'img-item object-contain';

    if (activeLayout === 'layout-grid') {
      const positions = {
        img1: 'absolute top-[5%] left-[5%] max-w-[100px]',
        img2: 'absolute top-[2%] left-[15%] max-w-[100px]',
        img3: 'absolute top-[8%] left-[28%] max-w-[100px]',
        img4: 'absolute top-[3%] left-[42%] max-w-[100px]',
        img5: 'absolute top-[6%] left-[56%] max-w-[100px]',
        img6: 'absolute top-[2%] left-[70%] max-w-[100px]',
        img7: 'absolute top-[5%] right-[5%] max-w-[100px]',
        img8: 'absolute top-[35%] left-[8%] max-w-[100px]',
        img9: 'absolute top-[38%] left-[22%] max-w-[100px]',
        img10: 'absolute top-[32%] left-[38%] max-w-[100px]',
        img11: 'absolute top-[36%] left-[52%] max-w-[100px]',
        img12: 'absolute top-[33%] left-[68%] max-w-[100px]',
        img13: 'absolute top-[37%] right-[6%] max-w-[100px]',
        img14: 'absolute top-[68%] left-[6%] max-w-[100px]',
        img15: 'absolute top-[65%] left-[18%] max-w-[100px]',
        img16: 'absolute top-[70%] left-[34%] max-w-[100px]',
        img17: 'absolute top-[66%] left-[50%] max-w-[100px]',
        img18: 'absolute top-[68%] left-[66%] max-w-[100px]',
        img19: 'absolute top-[65%] right-[7%] max-w-[100px]'
      };

      return `${baseStyle} ${positions[imgId] || ''}`;
    }

    return `${baseStyle} w-full max-w-[400px] mx-auto mb-32`;
  };

  const getGalleryContainerStyle = () => {
    if (activeLayout === 'layout-grid') {
      return 'relative w-full h-[calc(100vh-6rem)]';
    }
    return 'w-full max-w-7xl mx-auto px-8 pb-20 relative';
  };

  if (!isLoaded) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white">
      {/* NAV */}
      <nav className="fixed top-0 right-0 z-50  backdrop-blur-sm">
        <div className="flex">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => switchLayout(layout.id)}
              className={`px-2 pt-4 ${
                activeLayout === layout.id
                  
              }`}
            >
              {layout.label}
            </button>
          ))}
        </div>
      </nav>

      {/* TITULOS */}
      {activeLayout === 'layout-scroll' &&
        images.map((img) => (
          <div
            key={img.id}
            ref={(el) => (titleRefs.current[img.id] = el)}
            className="text-base font-semibold bg-white leading-none w-fit pointer-events-none absolute"
          >
            {img.name}
          </div>
        ))}

      {/* GALLERY */}
      <div className="pt-24 w-full min-h-screen">
        <div ref={galleryRef} className={getGalleryContainerStyle()}>
          {images.map((img) => (
            <img
              key={img.id}
              id={img.id}
              src={img.src}
              alt={img.alt}
              className={getImageStyle(img.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DynamicGallery3;
