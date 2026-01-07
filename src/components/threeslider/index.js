import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const ThreeSlider = () => {
  const containerRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const sceneRef = useRef(null);
  const materialRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const dragRef = useRef({ isDragging: false, startX: 0, currentX: 0 });

  // Array de imágenes - desde tu carpeta public/hero
  const images = Array.from({ length: 19 }, (_, i) => `/hero/img${i + 1}.png`);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(
      70,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Vertex Shader
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Fragment Shader con efecto de distorsión
    const fragmentShader = `
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D disp;
      uniform float dispFactor;
      uniform float effectFactor;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv;
        
        vec4 disp = texture2D(disp, uv);
        
        vec2 distortedPosition = vec2(uv.x + dispFactor * (disp.r * effectFactor), uv.y);
        vec2 distortedPosition2 = vec2(uv.x - (1.0 - dispFactor) * (disp.r * effectFactor), uv.y);
        
        vec4 _texture1 = texture2D(texture1, distortedPosition);
        vec4 _texture2 = texture2D(texture2, distortedPosition2);
        
        gl_FragColor = mix(_texture1, _texture2, dispFactor);
      }
    `;

    // Crear textura de displacement (ruido)
    const dispCanvas = document.createElement('canvas');
    dispCanvas.width = 512;
    dispCanvas.height = 512;
    const dispCtx = dispCanvas.getContext('2d');
    const imageData = dispCtx.createImageData(512, 512);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() * 255;
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
      imageData.data[i + 3] = 255;
    }
    
    dispCtx.putImageData(imageData, 0, 0);
    const dispTexture = new THREE.CanvasTexture(dispCanvas);

    // Cargar texturas
    const loader = new THREE.TextureLoader();
    const textures = images.map(url => loader.load(url));

    // Material con shaders personalizados
    const material = new THREE.ShaderMaterial({
      uniforms: {
        texture1: { value: textures[0] },
        texture2: { value: textures[1] },
        disp: { value: dispTexture },
        dispFactor: { value: 0.0 },
        effectFactor: { value: 0.5 }
      },
      vertexShader,
      fragmentShader,
      transparent: true
    });
    
    materialRef.current = material;

    // Geometry - imágenes más pequeñas
    const geometry = new THREE.PlaneGeometry(1.5, 1, 1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const transitionTo = (index) => {
    if (isAnimatingRef.current || index === currentSlide) return;
    
    isAnimatingRef.current = true;
    const material = materialRef.current;
    
    if (material) {
      const loader = new THREE.TextureLoader();
      material.uniforms.texture1.value = loader.load(images[currentSlide]);
      material.uniforms.texture2.value = loader.load(images[index]);
      
      // Animación de transición
      const duration = 1.5;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease in-out
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        material.uniforms.dispFactor.value = eased;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCurrentSlide(index);
          material.uniforms.dispFactor.value = 0;
          isAnimatingRef.current = false;
        }
      };
      
      animate();
    }
  };

  const goToNext = () => {
    const nextIndex = (currentSlide + 1) % images.length;
    transitionTo(nextIndex);
  };

  const goToPrev = () => {
    const prevIndex = (currentSlide - 1 + images.length) % images.length;
    transitionTo(prevIndex);
  };

  // Drag functionality
  const handleDragStart = (e) => {
    if (isAnimatingRef.current) return;
    dragRef.current.isDragging = true;
    dragRef.current.startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    dragRef.current.currentX = dragRef.current.startX;
  };

  const handleDragMove = (e) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
  };

  const handleDragEnd = () => {
    if (!dragRef.current.isDragging) return;
    
    const diff = dragRef.current.startX - dragRef.current.currentX;
    const threshold = 50; // Mínimo de píxeles para considerar un drag válido
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    
    dragRef.current.isDragging = false;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Mouse events
    container.addEventListener('mousedown', handleDragStart);
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);

    // Touch events
    container.addEventListener('touchstart', handleDragStart);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      container.removeEventListener('mousedown', handleDragStart);
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      container.removeEventListener('touchstart', handleDragStart);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [currentSlide]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ userSelect: 'none' }}
      />
      
      {/* Navigation Controls */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-3 z-10">
        {/* Slide indicators */}
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => transitionTo(index)}
            className={`transition-all duration-300 ${
              index === currentSlide
                ? 'w-12 h-1.5 bg-white'
                : 'w-8 h-1.5 bg-white/30 hover:bg-white/50'
            }`}
            disabled={isAnimatingRef.current}
          />
        ))}
      </div>

      {/* Info overlay */}
      <div className="absolute top-10 left-10 z-10 text-white">
        <h1 className="text-4xl font-light mb-2">Three.js Slider</h1>
        <p className="text-sm text-white/60">Arrastra para navegar</p>
      </div>

      {/* Slide counter */}
      <div className="absolute top-10 right-10 z-10 text-white">
        <div className="text-2xl font-light">
          {String(currentSlide + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
};

export default ThreeSlider;