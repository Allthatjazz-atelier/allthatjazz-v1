'use client';

import React, { useEffect, useRef, useState } from 'react';


const DynamicGallery2 = () => {
  const [activeLayout, setActiveLayout] = useState('layout-grid');
  const [isLoaded, setIsLoaded] = useState(false);
  const galleryRef = useRef(null);
  const isTransitioning = useRef(false);
  const gsapRef = useRef(null);
  const FlipRef = useRef(null);
  const ScrollToPluginRef = useRef(null);

  // 19 imágenes
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

  const switchLayout = (newLayout) => {
    if (newLayout === activeLayout || isTransitioning.current || !isLoaded) return;

    isTransitioning.current = true;

    // Si estamos en scroll y hay scroll, volver arriba primero
    if (activeLayout === 'layout-scroll' && window.scrollY > 0) {
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

    requestAnimationFrame(() => {
      FlipRef.current.from(state, {
        duration: 1.5,
        ease: 'power2.inOut',
        stagger: 0.025,
        onComplete: () => {
          isTransitioning.current = false;
        }
      });

      // Limpiar transformaciones del scroll cuando volvemos a grid
      if (newLayout === 'layout-grid' && galleryRef.current) {
        gsapRef.current.set(galleryRef.current, { clearProps: 'all' });
      }
    });
  };

  // Estilos específicos para cada layout
  const getImageStyle = (imgId) => {
    const baseStyle = 'img-item object-contain';
    
    if (activeLayout === 'layout-grid') {
      // Grid disperso que cabe en viewport - posiciones en % de viewport
      const positions = {
        img1: 'absolute top-[5%] left-[5%] max-w-[100px] max-h-[120px]',
        img2: 'absolute top-[2%] left-[15%] max-w-[100px] max-h-[120px]',
        img3: 'absolute top-[8%] left-[28%] max-w-[100px] max-h-[120px]',
        img4: 'absolute top-[3%] left-[42%] max-w-[100px] max-h-[120px]',
        img5: 'absolute top-[6%] left-[56%] max-w-[100px] max-h-[120px]',
        img6: 'absolute top-[2%] left-[70%] max-w-[100px] max-h-[120px]',
        img7: 'absolute top-[5%] right-[5%] max-w-[100px] max-h-[120px]',
        img8: 'absolute top-[35%] left-[8%] max-w-[100px] max-h-[120px]',
        img9: 'absolute top-[38%] left-[22%] max-w-[100px] max-h-[120px]',
        img10: 'absolute top-[32%] left-[38%] max-w-[100px] max-h-[120px]',
        img11: 'absolute top-[36%] left-[52%] max-w-[100px] max-h-[120px]',
        img12: 'absolute top-[33%] left-[68%] max-w-[100px] max-h-[120px]',
        img13: 'absolute top-[37%] right-[6%] max-w-[100px] max-h-[120px]',
        img14: 'absolute top-[68%] left-[6%] max-w-[100px] max-h-[120px]',
        img15: 'absolute top-[65%] left-[18%] max-w-[100px] max-h-[120px]',
        img16: 'absolute top-[70%] left-[34%] max-w-[100px] max-h-[120px]',
        img17: 'absolute top-[66%] left-[50%] max-w-[100px] max-h-[120px]',
        img18: 'absolute top-[68%] left-[66%] max-w-[100px] max-h-[120px]',
        img19: 'absolute top-[65%] right-[7%] max-w-[100px] max-h-[120px]',
      };
      return `${baseStyle} ${positions[imgId] || ''}`;
    }
    
    if (activeLayout === 'layout-scroll') {
      // Layout scroll - imágenes grandes que se pueden scrollear
      return `${baseStyle} w-full max-w-[400px] h-auto mx-auto mb-8`;
    }
    
    return baseStyle;
  };

  const getGalleryContainerStyle = () => {
    if (activeLayout === 'layout-grid') {
      return 'relative w-full h-[calc(100vh-6rem)]';
    }
    if (activeLayout === 'layout-scroll') {
      return 'w-full max-w-7xl mx-auto px-8 pb-20';
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
      <nav className="fixed top-0 right-0 z-50 bg-white/80 backdrop-blur-sm">
        <div className="flex">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => switchLayout(layout.id)}
              className={`px-6 py-3 transition-all ${
                activeLayout === layout.id
                  ? 'text-black font-semibold bg-gray-100'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              {layout.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Gallery Container */}
      <div className="pt-24 w-full min-h-screen">
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
      </div>
    </div>
  );
};

export default DynamicGallery2;