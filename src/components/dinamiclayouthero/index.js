'use client';

import React, { useEffect, useRef, useState } from 'react';

const DynamicGallery = () => {
  const [activeLayout, setActiveLayout] = useState('layout-1-gallery');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredImage, setHoveredImage] = useState('img1'); // Imagen activa en stack
  const galleryRef = useRef(null);
  const imgPreviewsRef = useRef(null);
  const minimapRef = useRef(null);
  const namesListRef = useRef(null);
  const isTransitioning = useRef(false);
  const gsapRef = useRef(null);
  const FlipRef = useRef(null);
  const ScrollToPluginRef = useRef(null);

  

  // 19 imágenes desde tu carpeta public/hero
  const images = Array.from({ length: 19 }, (_, i) => ({
    id: `img${i + 1}`,
    src: `/hero/img${i + 1}.png`,
    alt: `Image ${i + 1}`,
    name: `Nombre ${i + 1}`
  }));

  const layouts = [
    { id: 'layout-1-gallery', label: 'grid' },
    { id: 'layout-2-gallery', label: 'scroll' },
    { id: 'layout-3-gallery', label: 'stack' }
  ];

  // Cargar GSAP dinámicamente
  useEffect(() => {
    const loadGSAP = async () => {
      try {
        const gsapModule = await import('gsap');
        const flipModule = await import('gsap/Flip');
        const scrollToModule = await import('gsap/ScrollToPlugin');
        
        gsapRef.current = gsapModule.gsap;
        FlipRef.current = flipModule.Flip;
        ScrollToPluginRef.current = scrollToModule.ScrollToPlugin;
        
        gsapRef.current.registerPlugin(FlipRef.current, ScrollToPluginRef.current);
        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading GSAP:', error);
      }
    };

    loadGSAP();
  }, []);

  // Efecto para manejar el scroll en layout-2
  useEffect(() => {
    if (!isLoaded || !gsapRef.current) return;

    const handleScroll = () => {
      if (activeLayout !== 'layout-2-gallery' || !galleryRef.current || !imgPreviewsRef.current || !minimapRef.current) return;

      const imgPreviewsHeight = imgPreviewsRef.current.scrollHeight;
      const galleryHeight = galleryRef.current.scrollHeight;
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      const scrollFraction = scrollY / (imgPreviewsHeight - windowHeight);
      const galleryTranslateY = -scrollFraction * (galleryHeight - windowHeight) * 1.525;
      const minimapTranslateY = scrollFraction * (windowHeight - minimapRef.current.offsetHeight) * 0.425;

      gsapRef.current.to(galleryRef.current, {
        y: galleryTranslateY,
        ease: 'none',
        duration: 0.1,
      });

      gsapRef.current.to(minimapRef.current, {
        y: minimapTranslateY,
        ease: 'none',
        duration: 0.1,
      });
    };

    if (activeLayout === 'layout-2-gallery') {
      window.addEventListener('scroll', handleScroll);
      handleScroll();
    } else {
      window.removeEventListener('scroll', handleScroll);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeLayout, isLoaded]);

  const switchLayout = (newLayout) => {
    if (newLayout === activeLayout || isTransitioning.current || !isLoaded) return;

    isTransitioning.current = true;

    if (activeLayout === 'layout-2-gallery' && window.scrollY > 0) {
      gsapRef.current.to(window, {
        scrollTo: { y: 0 },
        duration: 0.5,
        ease: 'power3.out',
        onComplete: () => switchLayoutHandler(newLayout),
      });
    } else {
      switchLayoutHandler(newLayout);
    }
  };

  const switchLayoutHandler = (newLayout) => {
    if (!galleryRef.current || !FlipRef.current || !gsapRef.current) return;

    const state = FlipRef.current.getState(galleryRef.current.querySelectorAll('.img-item'));

    setActiveLayout(newLayout);

    // Esperar al siguiente frame para que React actualice el DOM
    requestAnimationFrame(() => {
      let staggerValue = 0.025;
      if (
        (activeLayout === 'layout-1-gallery' && newLayout === 'layout-2-gallery') ||
        (activeLayout === 'layout-3-gallery' && newLayout === 'layout-2-gallery')
      ) {
        staggerValue = 0;
      }

      FlipRef.current.from(state, {
        duration: 1.5,
        ease: 'power2.inOut',
        stagger: staggerValue,
        onComplete: () => {
          isTransitioning.current = false;
        }
      });

      if (newLayout === 'layout-2-gallery') {
        gsapRef.current.to([imgPreviewsRef.current, minimapRef.current], {
          autoAlpha: 1,
          duration: 0.3,
          delay: 0.5,
        });
        gsapRef.current.to(namesListRef.current, {
          autoAlpha: 0,
          duration: 0.3,
        });
      } else if (newLayout === 'layout-3-gallery') {
        gsapRef.current.to([imgPreviewsRef.current, minimapRef.current], {
          autoAlpha: 0,
          duration: 0.3,
        });
        gsapRef.current.to(namesListRef.current, {
          autoAlpha: 1,
          duration: 0.3,
          delay: 0.5,
        });
        if (galleryRef.current) {
          gsapRef.current.set(galleryRef.current, { clearProps: 'y' });
        }
        if (minimapRef.current) {
          gsapRef.current.set(minimapRef.current, { clearProps: 'y' });
        }
      } else {
        gsapRef.current.to([imgPreviewsRef.current, minimapRef.current, namesListRef.current], {
          autoAlpha: 0,
          duration: 0.3,
        });
        if (galleryRef.current) {
          gsapRef.current.set(galleryRef.current, { clearProps: 'y' });
        }
        if (minimapRef.current) {
          gsapRef.current.set(minimapRef.current, { clearProps: 'y' });
        }
      }
    });
  };

  // Estilos específicos para cada layout y cada imagen
  const getImageStyle = (imgId) => {
    const baseStyle = 'img-item object-contain';
    
    if (activeLayout === 'layout-1-gallery') {
      // Posiciones específicas para el grid disperso con 19 imágenes
      // Sin tamaño fijo, solo posición - mantienen proporciones originales
      const positions = {
        img1: 'absolute top-0 left-8 max-w-[150px] max-h-[200px]',
        img2: 'absolute top-0 left-[15%] max-w-[150px] max-h-[200px]',
        img3: 'absolute top-0 left-[45%] max-w-[150px] max-h-[200px]',
        img4: 'absolute top-0 left-[65%] max-w-[150px] max-h-[200px]',
        img5: 'absolute top-[25%] left-8 max-w-[150px] max-h-[200px]',
        img6: 'absolute top-[25%] left-[25%] max-w-[150px] max-h-[200px]',
        img7: 'absolute top-[25%] right-[15%] max-w-[150px] max-h-[200px]',
        img8: 'absolute top-[25%] right-8 max-w-[150px] max-h-[200px]',
        img9: 'absolute top-[50%] left-[45%] max-w-[150px] max-h-[200px]',
        img10: 'absolute top-[50%] left-[65%] max-w-[150px] max-h-[200px]',
        img11: 'absolute top-[75%] left-8 max-w-[150px] max-h-[200px]',
        img12: 'absolute top-[75%] left-[65%] max-w-[150px] max-h-[200px]',
        img13: 'absolute top-[75%] left-[75%] max-w-[150px] max-h-[200px]',
        img14: 'absolute top-[75%] right-8 max-w-[150px] max-h-[200px]',
        img15: 'absolute top-[100%] left-[20%] max-w-[150px] max-h-[200px]',
        img16: 'absolute top-[100%] left-[50%] max-w-[150px] max-h-[200px]',
        img17: 'absolute top-[100%] right-[20%] max-w-[150px] max-h-[200px]',
        img18: 'absolute top-[125%] left-[35%] max-w-[150px] max-h-[200px]',
        img19: 'absolute top-[125%] right-[35%] max-w-[150px] max-h-[200px]',
      };
      return `${baseStyle} ${positions[imgId] || ''}`;
    }
    
    if (activeLayout === 'layout-2-gallery') {
      return `${baseStyle} w-[75px] h-[100px] mb-4`;
    }
    
    if (activeLayout === 'layout-3-gallery') {
      // Todas las imágenes apiladas en la misma posición
      // Sin tamaño fijo - cada una mantiene sus proporciones originales
      // Esto crea un efecto asimétrico con bordes y extremos visibles
      const isActive = imgId === hoveredImage;
      return `${baseStyle} absolute top-16 right-16 max-w-[400px] max-h-[500px] ${
        isActive ? 'z-10' : 'z-0'
      }`;
    }
    
    return baseStyle;
  };

  const getGalleryContainerStyle = () => {
    if (activeLayout === 'layout-1-gallery') {
      return 'relative w-full min-h-[2000px]';
    }
    if (activeLayout === 'layout-2-gallery') {
      return 'fixed top-[25%] left-[10%] pt-2';
    }
    if (activeLayout === 'layout-3-gallery') {
      return 'relative w-full h-full';
    }
    return '';
  };

  if (!isLoaded) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 right-0 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex">
            {layouts.map((layout) => (
              <button
                key={layout.id}
                onClick={() => switchLayout(layout.id)}
                className={`px-2 py-2 transition-all ${
                  activeLayout === layout.id
                    ? 'text-black font-semibold'
                    : 'text-gray-700 hover:bg-gray-300'
                }`}
              >
                {layout.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Gallery Container */}
      <div className="pt-24 w-full min-h-screen">
        {/* Image Previews (solo visible en layout-2) */}
        <div
          ref={imgPreviewsRef}
          className="absolute top-[25%] left-1/2 -translate-x-1/2 w-[30%] opacity-0 invisible"
        >
          {images.map((img) => (
            <img
              key={`preview-${img.id}`}
              src={img.src}
              alt={img.alt}
              className="w-full h-[700px] object-cover py-4"
            />
          ))}
        </div>

        {/* Gallery */}
        <div
          ref={galleryRef}
          className={getGalleryContainerStyle()}
        >
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

        {/* Minimap */}
        <div
          ref={minimapRef}
          className="fixed top-[25%] left-[12.5%] -translate-x-1/2 w-[140px] h-[90px] border-2 border-black rounded-sm z-10 opacity-0 invisible bg-white/50"
        />

        {/* Names List (solo visible en layout-3) */}
        <div
          ref={namesListRef}
          className="fixed top-32 left-16 opacity-0 invisible z-20"
        >
          <ul className="space-y-2">
            {images.map((img) => (
              <li
                key={`name-${img.id}`}
                onMouseEnter={() => setHoveredImage(img.id)}
                className={`text-2xl font-light cursor-pointer transition-all duration-300 ${
                  hoveredImage === img.id
                    ? 'text-black font-medium translate-x-2'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {img.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DynamicGallery;