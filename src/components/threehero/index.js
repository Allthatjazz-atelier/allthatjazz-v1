import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Configuración de las capas
const LAYER_CONFIGS = {
  // Capa frontal - más cerca, más grande, menos elementos
  front: {
    rows: 4,
    columns: 5,
    spacing: 12,
    imageWidth: 8,
    imageHeight: 5,
    baseZ: 10, // Más cerca de la cámara
    curvature: 3,
    verticalCurvature: 0.3,
    parallaxStrength: 2.5,
    oscillationStrength: 0.15,
    scale: 1,
  },
  // Capa trasera - más lejos, más pequeña, más elementos
  back: {
    rows: 6,
    columns: 8,
    spacing: 8,
    imageWidth: 6,
    imageHeight: 3.5,
    baseZ: -20, // Más lejos de la cámara
    curvature: 5,
    verticalCurvature: 0.5,
    parallaxStrength: 0.8,
    oscillationStrength: 0.08,
    scale: 0.7, // 70% del tamaño original
  },
};

const CAMERA_CONFIG = {
  fov: 25,
  near: 0.1,
  far: 1000,
  positionZ: 40,
  lookAtRange: 20,
};

const ThreeJSGallery = () => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const layersRef = useRef({ front: [], back: [] });
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const headerRotationRef = useRef({ x: 0, y: 0, z: 0 });
  const lookAtTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const animationFrameRef = useRef(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const isAnimatingRef = useRef(false);

  // Array de imágenes (19 imágenes)
  const images = Array.from({ length: 19 }, (_, i) => `/hero/img${i + 1}.png`);
  
  // Array de videos
  const videos = ['/motion/promojohnny.mp4', '/motion/motionatj.mp4'];
  
  // Combinar imágenes y videos
  const mediaItems = [...images, ...videos];

  useEffect(() => {
    if (!containerRef.current) return;

    // Inicializar escena
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Configurar cámara
    const camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      window.innerWidth / window.innerHeight,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far
    );
    camera.position.set(0, 0, CAMERA_CONFIG.positionZ);
    cameraRef.current = camera;

    // Configurar renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xffffff, 1);
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    // Funciones de cálculo para cada capa
    const calculateRotations = (x, y, config) => {
      const a = 1 / (10 * config.curvature);
      const slopeY = -2 * a * x;
      const rotationY = Math.atan(slopeY);

      const verticalFactor = config.verticalCurvature;
      const maxYDistance = (config.rows * config.spacing) / 2;
      const normalizedY = y / maxYDistance;
      const rotationX = normalizedY * verticalFactor;

      return { rotationX, rotationY };
    };

    const calculatePosition = (row, col, config) => {
      let x = (col - config.columns / 2) * config.spacing;
      let y = (row - config.rows / 2) * config.spacing;

      // Curvatura horizontal
      let z = (x * x) / (10 * config.curvature);

      // Curvatura vertical
      const normalizedY = y / ((config.rows * config.spacing) / 2);
      z += Math.abs(normalizedY) * normalizedY * config.verticalCurvature * 5;

      // Añadir la profundidad base de la capa
      z += config.baseZ;

      const { rotationX, rotationY } = calculateRotations(x, y, config);

      return { x, y, z, rotationX, rotationY };
    };

    // Crear plano con imagen o video
    const createMediaPlane = (row, col, config, layerName) => {
      const mediaPath = mediaItems[Math.floor(Math.random() * mediaItems.length)];
      const isVideo = mediaPath.endsWith('.mp4');

      const geometry = new THREE.PlaneGeometry(
        config.imageWidth,
        config.imageHeight
      );

      let texture;
      let mediaElement = null;

      if (isVideo) {
        const video = document.createElement('video');
        video.src = mediaPath;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.play();
        
        texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        mediaElement = video;
      } else {
        const textureLoader = new THREE.TextureLoader();
        texture = textureLoader.load(mediaPath);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
      }

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: layerName === 'back' ? 0.7 : 1,
      });

      const plane = new THREE.Mesh(geometry, material);
      const { x, y, z, rotationX, rotationY } = calculatePosition(row, col, config);

      plane.position.set(x, y, z);
      plane.rotation.x = rotationX;
      plane.rotation.y = rotationY;
      plane.scale.setScalar(config.scale);

      // Guardar datos para animación
      plane.userData = {
        basePosition: { x, y, z },
        baseRotation: { x: rotationX, y: rotationY, z: 0 },
        parallaxFactor: (Math.random() * 0.5 + 0.5) * config.parallaxStrength,
        randomOffset: {
          x: Math.random() * 2 - 1,
          y: Math.random() * 2 - 1,
          z: Math.random() * 2 - 1,
        },
        rotationModifier: {
          x: Math.random() * 0.15 - 0.075,
          y: Math.random() * 0.15 - 0.075,
          z: Math.random() * 0.2 - 0.1,
        },
        phaseOffset: Math.random() * Math.PI * 2,
        oscillationStrength: config.oscillationStrength,
        baseScale: config.scale,
        currentLayer: layerName,
        mediaElement,
      };

      return plane;
    };

    // Crear ambas capas
    const createLayers = () => {
      // Crear capa frontal
      for (let row = 0; row < LAYER_CONFIGS.front.rows; row++) {
        for (let col = 0; col < LAYER_CONFIGS.front.columns; col++) {
          const plane = createMediaPlane(row, col, LAYER_CONFIGS.front, 'front');
          layersRef.current.front.push(plane);
          scene.add(plane);
        }
      }

      // Crear capa trasera
      for (let row = 0; row < LAYER_CONFIGS.back.rows; row++) {
        for (let col = 0; col < LAYER_CONFIGS.back.columns; col++) {
          const plane = createMediaPlane(row, col, LAYER_CONFIGS.back, 'back');
          layersRef.current.back.push(plane);
          scene.add(plane);
        }
      }
    };

    createLayers();

    // Event listeners
    const handleMouseMove = (event) => {
      mouseRef.current.x = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      mouseRef.current.y = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);

      headerRotationRef.current.x = -mouseRef.current.y * 30;
      headerRotationRef.current.y = mouseRef.current.x * 30;
      headerRotationRef.current.z = Math.abs(mouseRef.current.x * mouseRef.current.y) * 50;
    };

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Loop de animación
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const { x: mouseX, y: mouseY, targetX, targetY } = mouseRef.current;
      
      // Actualizar targets suavemente
      mouseRef.current.targetX += (mouseX - targetX) * 0.05;
      mouseRef.current.targetY += (mouseY - targetY) * 0.05;

      const newTargetX = mouseRef.current.targetX;
      const newTargetY = mouseRef.current.targetY;

      lookAtTargetRef.current.x = newTargetX * CAMERA_CONFIG.lookAtRange;
      lookAtTargetRef.current.y = -newTargetY * CAMERA_CONFIG.lookAtRange;
      lookAtTargetRef.current.z = 0;

      const time = performance.now() * 0.001;

      // Actualizar todas las capas
      const allPlanes = [...layersRef.current.front, ...layersRef.current.back];
      
      allPlanes.forEach((plane) => {
        const {
          basePosition,
          baseRotation,
          parallaxFactor,
          randomOffset,
          rotationModifier,
          phaseOffset,
          oscillationStrength,
        } = plane.userData;

        const mouseDistance = Math.sqrt(newTargetX * newTargetX + newTargetY * newTargetY);
        const parallaxX = newTargetX * parallaxFactor * randomOffset.x;
        const parallaxY = newTargetY * parallaxFactor * randomOffset.y;
        const oscillation = Math.sin(time + phaseOffset) * mouseDistance * oscillationStrength;

        // Actualizar posición
        plane.position.x = basePosition.x + parallaxX + oscillation * randomOffset.x;
        plane.position.y = basePosition.y + parallaxY + oscillation * randomOffset.y;
        plane.position.z = basePosition.z + oscillation * randomOffset.z * parallaxFactor * 0.5;

        // Actualizar rotación
        plane.rotation.x =
          baseRotation.x +
          newTargetY * rotationModifier.x * mouseDistance +
          oscillation * rotationModifier.x * 0.2;

        plane.rotation.y =
          baseRotation.y +
          newTargetX * rotationModifier.y * mouseDistance +
          oscillation * rotationModifier.y * 0.2;

        plane.rotation.z =
          baseRotation.z +
          newTargetX * newTargetY * rotationModifier.z * 2 +
          oscillation * rotationModifier.z * 0.3;
      });

      cameraRef.current.lookAt(lookAtTargetRef.current);
      rendererRef.current.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const allPlanes = [...layersRef.current.front, ...layersRef.current.back];
      allPlanes.forEach((plane) => {
        if (plane.userData.mediaElement) {
          plane.userData.mediaElement.pause();
          plane.userData.mediaElement.remove();
        }
        plane.geometry.dispose();
        plane.material.map?.dispose();
        plane.material.dispose();
        scene.remove(plane);
      });

      layersRef.current = { front: [], back: [] };
      renderer.dispose();
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleSwapLayers = () => {
    const allPlanes = [...layersRef.current.front, ...layersRef.current.back];
    if (allPlanes.length === 0 || isAnimatingRef.current) return;
    
    isAnimatingRef.current = true;
    const duration = 2000; // 2 segundos
    const startTime = performance.now();

    // Función de easing suave
    const easeInOutCubic = (t) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    // Guardar configuraciones iniciales
    allPlanes.forEach(plane => {
      const currentLayer = plane.userData.currentLayer;
      const currentConfig = LAYER_CONFIGS[currentLayer];
      const targetLayer = currentLayer === 'front' ? 'back' : 'front';
      const targetConfig = LAYER_CONFIGS[targetLayer];

      // Calcular la nueva posición base en el target layer
      const currentBaseZ = currentConfig.baseZ;
      const targetBaseZ = targetConfig.baseZ;
      const zOffset = plane.userData.basePosition.z - currentBaseZ;

      plane.userData.animationStart = {
        z: plane.userData.basePosition.z,
        x: plane.userData.basePosition.x,
        y: plane.userData.basePosition.y,
        opacity: plane.material.opacity,
        parallax: plane.userData.parallaxFactor,
        oscillation: plane.userData.oscillationStrength,
        scale: plane.scale.x,
      };

      plane.userData.animationTarget = {
        z: targetBaseZ + zOffset,
        x: plane.userData.basePosition.x,
        y: plane.userData.basePosition.y,
        opacity: targetLayer === 'back' ? 0.7 : 1,
        parallax: (plane.userData.parallaxFactor / currentConfig.parallaxStrength) * targetConfig.parallaxStrength,
        oscillation: targetConfig.oscillationStrength,
        scale: targetConfig.scale,
        targetLayer,
      };
    });

    const animateSwap = (currentTime) => {
      const elapsed = currentTime - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);
      const progress = easeInOutCubic(rawProgress);

      // Calcular el arco circular
      // 0 -> 0°, 0.5 -> 90°, 1 -> 180°
      const arcAngle = progress * Math.PI;
      const arcRadius = 30; // Radio del arco

      layersRef.current.front.forEach(plane => {
        const start = plane.userData.animationStart;
        const target = plane.userData.animationTarget;
        
        // Movimiento en arco hacia arriba (front -> back)
        const arcY = Math.sin(arcAngle) * arcRadius;
        const arcZ = (1 - Math.cos(arcAngle)) * arcRadius * 0.5;
        
        plane.userData.basePosition.x = start.x + (target.x - start.x) * progress;
        plane.userData.basePosition.y = start.y + (target.y - start.y) * progress + arcY;
        plane.userData.basePosition.z = start.z + (target.z - start.z) * progress - arcZ;
        
        plane.material.opacity = start.opacity + (target.opacity - start.opacity) * progress;
        plane.userData.parallaxFactor = start.parallax + (target.parallax - start.parallax) * progress;
        plane.userData.oscillationStrength = start.oscillation + (target.oscillation - start.oscillation) * progress;
        
        const newScale = start.scale + (target.scale - start.scale) * progress;
        plane.scale.setScalar(newScale);
        
        plane.material.transparent = true;
      });

      layersRef.current.back.forEach(plane => {
        const start = plane.userData.animationStart;
        const target = plane.userData.animationTarget;
        
        // Movimiento en arco hacia abajo (back -> front)
        const arcY = -Math.sin(arcAngle) * arcRadius;
        const arcZ = (1 - Math.cos(arcAngle)) * arcRadius * 0.5;
        
        plane.userData.basePosition.x = start.x + (target.x - start.x) * progress;
        plane.userData.basePosition.y = start.y + (target.y - start.y) * progress + arcY;
        plane.userData.basePosition.z = start.z + (target.z - start.z) * progress + arcZ;
        
        plane.material.opacity = start.opacity + (target.opacity - start.opacity) * progress;
        plane.userData.parallaxFactor = start.parallax + (target.parallax - start.parallax) * progress;
        plane.userData.oscillationStrength = start.oscillation + (target.oscillation - start.oscillation) * progress;
        
        const newScale = start.scale + (target.scale - start.scale) * progress;
        plane.scale.setScalar(newScale);
        
        plane.material.transparent = plane.material.opacity < 1;
      });

      if (rawProgress < 1) {
        requestAnimationFrame(animateSwap);
      } else {
        // Finalizar animación e intercambiar referencias
        allPlanes.forEach(plane => {
          plane.userData.currentLayer = plane.userData.animationTarget.targetLayer;
          plane.userData.baseScale = plane.userData.animationTarget.scale;
        });

        const temp = layersRef.current.front;
        layersRef.current.front = layersRef.current.back;
        layersRef.current.back = temp;
        
        isAnimatingRef.current = false;
        setIsSwapped(!isSwapped);
      }
    };

    requestAnimationFrame(animateSwap);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white">
      {/* Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* Botón para intercambiar capas */}
      <button
        onClick={handleSwapLayers}
        disabled={isAnimatingRef.current}
        className="fixed bottom-8 right-8 z-[9999] bg-black text-white px-6 py-3 rounded-full font-medium text-sm uppercase tracking-wider hover:bg-gray-800 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          fontFamily: '"Cy Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <span className="flex items-center gap-2">
          <svg 
            className="w-5 h-5" 
            fill="none" 
            strokeWidth="2" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" 
            />
          </svg>
          Cambiar Profundidad
        </span>
      </button>
      
      {/* Header con efecto 3D */}
      {/* <div 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10 pointer-events-none"
        style={{
          transformStyle: 'preserve-3d',
          perspective: '1000px',
          willChange: 'transform',
          transform: `translate(-50%, -50%) perspective(1000px) rotateX(${headerRotationRef.current.x}deg) rotateY(${headerRotationRef.current.y}deg) translateZ(${headerRotationRef.current.z}px)`,
          transition: 'transform 0.5s cubic-bezier(0.215, 0.61, 0.355, 1)',
        }}
      >
        <h1 
          className="uppercase font-bold text-[7.5vw] tracking-tighter leading-none"
          style={{
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            fontFamily: '"Cy Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          TU TÍTULO
        </h1>
      </div> */}
    </div>
  );
};

export default ThreeJSGallery;