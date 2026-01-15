"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const HeroCarousel2_4 = () => {
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
      stretchLerp: 0.12,
      maxStretch: 1.5,
      stretchDecay: 0.92,
    };

    // Dimensiones relativas al viewport
    const sliderWidthPercent = 0.50; // 50% cada slider
    
    const fov = 45;
    const cameraZ = 5;
    const vFOV = (fov * Math.PI) / 180;
    const planeHeight = 2 * Math.tan(vFOV / 2) * cameraZ;
    const planeWidth = planeHeight * camera.aspect;
    
    const baseSlideWidth = sliderWidthPercent * planeWidth;
    const slideHeight = baseSlideWidth * 1.25; // Ratio 4:5
    const gap = 0.15;
    const slideCount = 10;
    const imagesCount = 19;
    const totalHeight = slideCount * (slideHeight + gap);
    const slideUnit = slideHeight + gap;

    // Posiciones X para cada slider
    // Slider izquierdo: de -planeWidth/2 a 0
    const leftSliderX = -(planeWidth / 4);
    // Slider derecho: de 0 a planeWidth/2
    const rightSliderX = (planeWidth / 4);

    const leftSlides = [];
    const rightSlides = [];
    let currentPosition = 0;
    let targetPosition = 0;
    let isScrolling = false;
    let autoScrollSpeed = 0;
    let lastTime = 0;
    let touchStartY = 0;
    let touchLastY = 0;

    let currentStretch = 0;
    let targetStretch = 0;

    const correctImageColor = (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    // Crear orden aleatorio para el segundo slider
    const shuffledIndices = Array.from({ length: imagesCount }, (_, i) => i + 1);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
    }

    const createSlide = (index, isLeft, xPosition) => {
      const geometry = new THREE.PlaneGeometry(baseSlideWidth, slideHeight, 32, 32);

      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffffff),
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = -index * (slideHeight + gap);
      mesh.position.x = xPosition;
      mesh.userData = {
        index,
        baseX: xPosition,
        baseWidth: baseSlideWidth,
        originalVertices: [...geometry.attributes.position.array],
        isLeft,
      };

      // Para el slider derecho, usar orden aleatorio
      const imageIndex = isLeft 
        ? (index % imagesCount) + 1 
        : shuffledIndices[index % imagesCount];
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
      if (isLeft) {
        leftSlides.push(mesh);
      } else {
        rightSlides.push(mesh);
      }
    };

    // Crear sliders
    for (let i = 0; i < slideCount; i++) {
      createSlide(i, true, leftSliderX);  // Slider izquierdo
      createSlide(i, false, rightSliderX); // Slider derecho
    }

    // Inicializar posiciones
    [...leftSlides, ...rightSlides].forEach((slide) => {
      slide.position.y += totalHeight / 2;
      slide.userData.targetY = slide.position.y;
      slide.userData.currentY = slide.position.y;
      slide.userData.currentStretch = 0;
    });

    // Función para deformar los vértices con curvatura
    const applyStretchDeformation = (mesh, stretchAmount, isLeft) => {
      const positionAttribute = mesh.geometry.attributes.position;
      const originalVertices = mesh.userData.originalVertices;

      for (let i = 0; i < positionAttribute.count; i++) {
        const x = originalVertices[i * 3];
        const y = originalVertices[i * 3 + 1];
        const z = originalVertices[i * 3 + 2];

        const normalizedX = (x / (baseSlideWidth / 2));
        
        let stretchX = x;
        let stretchZ = z;
        
        if (isLeft) {
          // Slider izquierdo: el lado IZQUIERDO (externo) se estira hacia fuera
          // El lado derecho (centro) permanece fijo
          if (normalizedX < 0) {
            const stretchFactor = Math.pow(Math.abs(normalizedX), 1.2);
            stretchX = x - (stretchFactor * stretchAmount * 0.8);
            
            const normalizedY = (y / (slideHeight / 2));
            const curvatureFactor = (1 - Math.pow(normalizedY, 2)) * stretchFactor;
            stretchZ = curvatureFactor * stretchAmount * 0.6;
          }
        } else {
          // Slider derecho: el lado DERECHO (externo) se estira hacia fuera
          // El lado izquierdo (centro) permanece fijo
          if (normalizedX > 0) {
            const stretchFactor = Math.pow(normalizedX, 1.2);
            stretchX = x + (stretchFactor * stretchAmount * 0.8);
            
            const normalizedY = (y / (slideHeight / 2));
            const curvatureFactor = (1 - Math.pow(normalizedY, 2)) * stretchFactor;
            stretchZ = curvatureFactor * stretchAmount * 0.6;
          }
        }

        const edgeFactor = Math.abs(normalizedX);
        const stretchY = y + (Math.sin(normalizedX * Math.PI) * stretchAmount * 0.12 * edgeFactor);

        positionAttribute.setXYZ(i, stretchX, stretchY, stretchZ);
      }

      positionAttribute.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    };

    const handleKeyDown = (e) => {
      if (e.key === "ArrowUp") {
        targetPosition -= slideUnit;
        targetStretch = settings.maxStretch;
        isScrolling = true;
      } else if (e.key === "ArrowDown") {
        targetPosition += slideUnit;
        targetStretch = settings.maxStretch;
        isScrolling = true;
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      
      targetPosition += e.deltaY * settings.wheelSensitivity;
      targetStretch = settings.maxStretch;
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
      targetStretch = settings.maxStretch;
      isScrolling = true;
    };

    const handleTouchEnd = () => {
      const velocity = (touchLastY - touchStartY) * 0.003;
      if (Math.abs(velocity) > 0.3) {
        autoScrollSpeed = velocity * settings.momentumMultiplier * 0.03;
        targetStretch = settings.maxStretch;
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
      
      const vFOV = (45 * Math.PI) / 180;
      const planeHeight = 2 * Math.tan(vFOV / 2) * 5;
      const planeWidth = planeHeight * camera.aspect;
      
      const newLeftX = -(planeWidth / 4);
      const newRightX = (planeWidth / 4);
      
      leftSlides.forEach(slide => {
        slide.userData.baseX = newLeftX;
      });
      rightSlides.forEach(slide => {
        slide.userData.baseX = newRightX;
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

      if (!isScrolling) {
        targetStretch *= settings.stretchDecay;
      }

      currentPosition += (targetPosition - currentPosition) * settings.smoothing;
      currentStretch += (targetStretch - currentStretch) * settings.stretchLerp;

      // Animar slider izquierdo (va hacia abajo cuando scrolleas)
      leftSlides.forEach((slide, i) => {
        let baseY = -i * slideUnit + currentPosition;
        baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
        if (baseY > totalHeight / 2) baseY -= totalHeight;

        const isWrapping = Math.abs(baseY - slide.userData.targetY) > slideHeight * 2;
        if (isWrapping) slide.userData.currentY = baseY;

        slide.userData.targetY = baseY;
        slide.userData.currentY += (slide.userData.targetY - slide.userData.currentY) * settings.slideLerp;
        slide.position.y = slide.userData.currentY;

        slide.userData.currentStretch += (currentStretch - slide.userData.currentStretch) * settings.stretchLerp;
        
        // El lado derecho (centro) permanece fijo, el izquierdo se estira
        slide.position.x = slide.userData.baseX; // Posición base fija
        
        applyStretchDeformation(slide, slide.userData.currentStretch, true);
        slide.rotation.y = -slide.userData.currentStretch * 0.15;
      });

      // Animar slider derecho (va hacia arriba cuando scrolleas - dirección opuesta)
      rightSlides.forEach((slide, i) => {
        let baseY = -i * slideUnit - currentPosition; // Negativo para dirección opuesta
        baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
        if (baseY > totalHeight / 2) baseY -= totalHeight;

        const isWrapping = Math.abs(baseY - slide.userData.targetY) > slideHeight * 2;
        if (isWrapping) slide.userData.currentY = baseY;

        slide.userData.targetY = baseY;
        slide.userData.currentY += (slide.userData.targetY - slide.userData.currentY) * settings.slideLerp;
        slide.position.y = slide.userData.currentY;

        slide.userData.currentStretch += (currentStretch - slide.userData.currentStretch) * settings.stretchLerp;
        
        // El lado izquierdo (centro) permanece fijo, el derecho se estira
        slide.position.x = slide.userData.baseX; // Posición base fija
        
        applyStretchDeformation(slide, slide.userData.currentStretch, false);
        slide.rotation.y = slide.userData.currentStretch * 0.15;
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

export default HeroCarousel2_4;