"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const HeroCarousel2_3 = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 5);

    const settings = {
      wheelSensitivity: 0.008,
      touchSensitivity: 0.008,
      momentumMultiplier: 1.5,
      smoothing: 0.08,
      slideLerp: 0.1,
      depthLerp: 0.12,
      maxDepth: 2.5,
      depthDecay: 0.92,
    };

    // Dimensiones relativas al viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // El slider ocupa 30% del ancho de la pantalla en reposo
    const baseWidthPercent = 0.30;
    const expandedWidthPercent = 0.40;
    
    // Calculamos el tamaño de las slides basado en el 30% del viewport
    // Usamos una escala para convertir pixeles a unidades Three.js
    const fov = 45;
    const cameraZ = 5;
    const vFOV = (fov * Math.PI) / 180;
    const planeHeight = 2 * Math.tan(vFOV / 2) * cameraZ;
    const planeWidth = planeHeight * camera.aspect;
    
    const baseSlideWidth = (baseWidthPercent * planeWidth);
    const slideHeight = baseSlideWidth * 1.25; // Ratio 4:5
    const gap = 0.15;
    const slideCount = 10;
    const imagesCount = 19;
    const totalHeight = slideCount * (slideHeight + gap);
    const slideUnit = slideHeight + gap;

    // Posición X: completamente pegado a la derecha
    // El borde derecho del plano visible es planeWidth/2
    // Restamos la mitad del ancho del slide para que su borde derecho coincida
    const sliderXPosition = (planeWidth / 2) - (baseSlideWidth / 2);

    const slides = [];
    let currentPosition = 0;
    let targetPosition = 0;
    let isScrolling = false;
    let autoScrollSpeed = 0;
    let lastTime = 0;
    let touchStartY = 0;
    let touchLastY = 0;

    let currentDepth = 0;
    let targetDepth = 0;

    const correctImageColor = (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const createSlide = (index) => {
      const geometry = new THREE.PlaneGeometry(baseSlideWidth, slideHeight, 1, 1);

      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffffff),
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = -index * (slideHeight + gap);
      mesh.position.x = sliderXPosition;
      mesh.userData = {
        index,
        baseX: sliderXPosition,
        baseWidth: baseSlideWidth,
      };

      const imageIndex = (index % imagesCount) + 1;
      const imagePath = `/story/story${imageIndex}.png`;

      new THREE.TextureLoader().load(
        imagePath,
        (texture) => {
          correctImageColor(texture);
          material.map = texture;
          material.needsUpdate = true;

          const imgAspect = texture.image.width / texture.image.height;
          const slideAspect = baseSlideWidth / slideHeight;

          if (imgAspect > slideAspect) {
            mesh.scale.x = 1;
            mesh.scale.y = slideAspect / imgAspect;
          } else {
            mesh.scale.x = imgAspect / slideAspect;
            mesh.scale.y = 1;
          }

          mesh.userData.baseScale = { x: mesh.scale.x, y: mesh.scale.y };
        },
        undefined,
        (err) => console.warn(`Couldn't load image ${imagePath}`, err)
      );

      scene.add(mesh);
      slides.push(mesh);
    };

    for (let i = 0; i < slideCount; i++) {
      createSlide(i);
    }

    slides.forEach((slide) => {
      slide.position.y += totalHeight / 2;
      slide.userData.targetY = slide.position.y;
      slide.userData.currentY = slide.position.y;
      slide.userData.currentDepth = 0;
      slide.userData.currentScale = 1;
    });

    const handleKeyDown = (e) => {
      if (e.key === "ArrowUp") {
        targetPosition -= slideUnit;
        targetDepth = settings.maxDepth;
        isScrolling = true;
      } else if (e.key === "ArrowDown") {
        targetPosition += slideUnit;
        targetDepth = settings.maxDepth;
        isScrolling = true;
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      
      targetPosition += e.deltaY * settings.wheelSensitivity;
      targetDepth = settings.maxDepth;
      isScrolling = true;
      
      autoScrollSpeed = Math.min(Math.abs(e.deltaY) * 0.0003, 0.03) * Math.sign(e.deltaY);

      clearTimeout(window.scrollTimeout);
      window.scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 150);
    };

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      touchLastY = touchStartY;
      isScrolling = false;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchLastY;
      touchLastY = touchY;

      targetPosition -= deltaY * settings.touchSensitivity;
      targetDepth = settings.maxDepth;
      isScrolling = true;
    };

    const handleTouchEnd = () => {
      const velocity = (touchLastY - touchStartY) * 0.003;
      if (Math.abs(velocity) > 0.3) {
        autoScrollSpeed = velocity * settings.momentumMultiplier * 0.03;
        targetDepth = settings.maxDepth;
        isScrolling = true;
        setTimeout(() => {
          isScrolling = false;
        }, 800);
      }
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      // Recalcular posición al redimensionar
      const vFOV = (45 * Math.PI) / 180;
      const planeHeight = 2 * Math.tan(vFOV / 2) * 5;
      const planeWidth = planeHeight * camera.aspect;
      const newSliderX = (planeWidth / 2) - (baseSlideWidth / 2);
      
      slides.forEach(slide => {
        slide.userData.baseX = newSliderX;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("resize", handleResize);

    const animate = (time) => {
      requestAnimationFrame(animate);

      const deltaTime = lastTime ? (time - lastTime) / 1000 : 0.016;
      lastTime = time;

      if (isScrolling) {
        targetPosition += autoScrollSpeed;
        const speedBasedDecay = 0.96 - Math.abs(autoScrollSpeed) * 0.3;
        autoScrollSpeed *= Math.max(0.90, speedBasedDecay);

        if (Math.abs(autoScrollSpeed) < 0.001) {
          autoScrollSpeed = 0;
        }
      }

      // Cuando no hay scroll, la profundidad vuelve a 0
      if (!isScrolling) {
        targetDepth *= settings.depthDecay;
      }

      currentPosition += (targetPosition - currentPosition) * settings.smoothing;
      currentDepth += (targetDepth - currentDepth) * settings.depthLerp;

      slides.forEach((slide, i) => {
        let baseY = -i * slideUnit + currentPosition;
        baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
        if (baseY > totalHeight / 2) baseY -= totalHeight;

        const isWrapping = Math.abs(baseY - slide.userData.targetY) > slideHeight * 2;
        if (isWrapping) slide.userData.currentY = baseY;

        slide.userData.targetY = baseY;
        slide.userData.currentY += (slide.userData.targetY - slide.userData.currentY) * settings.slideLerp;

        slide.position.y = slide.userData.currentY;

        // Efecto de profundidad: el lado izquierdo se va hacia atrás
        // El lado derecho SIEMPRE permanece pegado a la derecha de la interface
        slide.userData.currentDepth += (currentDepth - slide.userData.currentDepth) * settings.depthLerp;
        
        // Escala: crece de 30% a 40% (33% de aumento)
        const scaleIncrease = (expandedWidthPercent - baseWidthPercent) / baseWidthPercent;
        const scaleFactor = 1 + (slide.userData.currentDepth / settings.maxDepth) * scaleIncrease;
        slide.userData.currentScale += (scaleFactor - slide.userData.currentScale) * settings.depthLerp;
        
        // Calcular el nuevo ancho del slide con la escala
        const currentSlideWidth = baseSlideWidth * slide.userData.currentScale;
        
        // Mantener el borde derecho fijo: ajustamos X según el nuevo ancho
        // Cuando crece, el centro se mueve a la izquierda para mantener el borde derecho fijo
        const vFOV = (45 * Math.PI) / 180;
        const planeHeight = 2 * Math.tan(vFOV / 2) * 5;
        const planeWidth = planeHeight * camera.aspect;
        const rightEdge = planeWidth / 2;
        
        // Posición X = borde derecho - (mitad del ancho actual del slide)
        slide.position.x = rightEdge - (currentSlideWidth / 2);
        
        // Rotación en Y para crear el efecto de profundidad
        // Solo el lado izquierdo rota hacia atrás
        slide.rotation.y = -slide.userData.currentDepth * 0.2;
        
        if (slide.userData.baseScale) {
          slide.scale.set(
            slide.userData.baseScale.x * slide.userData.currentScale,
            slide.userData.baseScale.y * slide.userData.currentScale,
            1
          );
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="canvas"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
    />
  );
};

export default HeroCarousel2_3;