"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const HeroCarousel_Responsive2 = () => {
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detectar si es móvil
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);

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
    camera.position.z = isMobile ? 9.5 : 5;

    const settings = {
      wheelSensitivity: 0.01,
      touchSensitivity: 0.01,
      momentumMultiplier: 2,
      smoothing: 0.1,
      slideLerp: 0.075,
      distortionDecay: 0.95,
      maxDistortion: isMobile ? 1.6 : 2.5,
      distortionSensitivity: 0.15,
      distortionSmoothing: 0.075,
    };

    // Configuración dinámica según orientación
    const slideWidth = isMobile ? 3.0 : 2.0;
    const slideHeight = isMobile ? 3.0 : 2.5;
    const gap = isMobile ? 0.1 : 0.05;
    const slideCount = 10;
    const imagesCount = 19;
    
    const isVertical = isMobile;
    const slideUnit = isVertical ? (slideHeight + gap) : (slideWidth + gap);
    const totalSize = slideCount * slideUnit;

    const slides = [];
    let currentPosition = 0;
    let targetPosition = 0;
    let isScrolling = false;
    let autoScrollSpeed = 0;
    let lastTime = 0;
    let touchStart = 0;
    let touchLast = 0;

    let currentDistortionFactor = 0;
    let targetDistortionFactor = 0;
    let peakVelocity = 0;
    let velocityHistory = [0, 0, 0, 0, 0];

    let selectedSlide = null;
    let detailProgress = 0;
    const detailSpeed = 0.08;

    const correctImageColor = (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const createSlide = (index) => {
      const geometry = new THREE.PlaneGeometry(slideWidth, slideHeight, 32, 16);

      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffffff),
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      if (isVertical) {
        mesh.position.y = index * slideUnit;
      } else {
        mesh.position.x = index * slideUnit;
      }
      
      mesh.userData = {
        originalVertices: [...geometry.attributes.position.array],
        index,
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
          const slideAspect = slideWidth / slideHeight;

          if (imgAspect > slideAspect) {
            mesh.scale.x = 1;
            mesh.scale.y = slideAspect / imgAspect;
          } else {
            mesh.scale.x = imgAspect / slideAspect;
            mesh.scale.y = 1;
          }
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
      if (isVertical) {
        slide.position.y -= totalSize / 2;
        slide.userData.targetPos = slide.position.y;
        slide.userData.currentPos = slide.position.y;
      } else {
        slide.position.x -= totalSize / 2;
        slide.userData.targetPos = slide.position.x;
        slide.userData.currentPos = slide.position.x;
      }
      slide.userData.baseScale = { x: 1, y: 1 };
    });

    const updateCurve = (
      mesh,
      worldPosition,
      distortionFactor,
      isSelected = false
    ) => {
      const positionAttr = mesh.geometry.attributes.position;
      const original = mesh.userData.originalVertices;
    
      // 🔥 CONTROLES FINOS
      const centerRadius = isVertical ? slideHeight * 0.6 : 1.8;
      const globalRadius = isVertical ? slideHeight * 2.5 : 4.0;
    
      const centerStrength = distortionFactor * (isMobile ? 1.8 : 1.0);
      const globalStrength = distortionFactor * 0.4;
    
      for (let i = 0; i < positionAttr.count; i++) {
        const x = original[i * 3];
        const y = original[i * 3 + 1];
    
        const axisPos = isVertical
          ? worldPosition + y
          : worldPosition + x;
    
        // 🔵 DISTORSIÓN CENTRAL (bulge)
        let dCenter = Math.abs(axisPos) / centerRadius;
        dCenter = Math.min(dCenter, 1);
    
        let bulge =
          Math.sin((1 - dCenter) * Math.PI * 0.5) *
          settings.maxDistortion *
          centerStrength;
    
        bulge = Math.pow(bulge, 1.1); // pico más agresivo
    
        // 🟢 DISTORSIÓN GLOBAL (afecta extremos)
        let dGlobal = Math.abs(axisPos) / globalRadius;
        dGlobal = Math.min(dGlobal, 1);
    
        const globalWave =
          Math.sin((1 - dGlobal) * Math.PI) *
          settings.maxDistortion *
          globalStrength;
    
        // ✨ Mezcla final
        let curveZ = bulge + globalWave;
    
        // ✨ Vida extra al seleccionado
        if (isSelected) {
          curveZ += Math.sin(Date.now() * 0.004 + i) * 0.25;
        }
    
        positionAttr.setZ(i, curveZ);
      }
    
      positionAttr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    };
    

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handleClick = (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(slides);

      if (intersects.length > 0) {
        const clickedSlide = intersects[0].object;
        selectedSlide = selectedSlide === clickedSlide ? null : clickedSlide;
      }
    };

    window.addEventListener("click", handleClick);

    const handleKeyDown = (e) => {
      const isUpLeft = isVertical ? e.key === "ArrowUp" : e.key === "ArrowLeft";
      const isDownRight = isVertical ? e.key === "ArrowDown" : e.key === "ArrowRight";
      
      if (isUpLeft) {
        targetPosition += slideUnit;
        targetDistortionFactor = Math.min(1.0, targetDistortionFactor + 0.3);
      } else if (isDownRight) {
        targetPosition -= slideUnit;
        targetDistortionFactor = Math.min(1.0, targetDistortionFactor + 0.3);
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const wheelStrength = Math.abs(e.deltaY) * 0.001;
      targetDistortionFactor = Math.min(
        1.0,
        targetDistortionFactor + wheelStrength
      );

      targetPosition -= e.deltaY * settings.wheelSensitivity;
      isScrolling = true;
      autoScrollSpeed =
        Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);

      clearTimeout(window.scrollTimeout);
      window.scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 150);
    };

    const handleTouchStart = (e) => {
      touchStart = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      touchLast = touchStart;
      isScrolling = false;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touchCurrent = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
      const delta = touchCurrent - touchLast;
      touchLast = touchCurrent;

      const touchStrength = Math.abs(delta) * 0.05;
      targetDistortionFactor = Math.min(
        1.0,
        targetDistortionFactor + touchStrength
      );

      targetPosition -= delta * settings.touchSensitivity;
      isScrolling = true;
    };

    const handleTouchEnd = () => {
      const velocity = (touchLast - touchStart) * 0.005;
      if (Math.abs(velocity) > 0.5) {
        autoScrollSpeed = -velocity * settings.momentumMultiplier * 0.05;
        targetDistortionFactor = Math.min(
          1.0,
          Math.abs(velocity) * 3 * settings.distortionSensitivity
        );
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
      checkMobile();
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

      const prevPos = currentPosition;

      if (isScrolling) {
        targetPosition += autoScrollSpeed;
        const speedBasedDecay = 0.97 - Math.abs(autoScrollSpeed) * 0.5;
        autoScrollSpeed *= Math.max(0.92, speedBasedDecay);

        if (Math.abs(autoScrollSpeed) < 0.001) autoScrollSpeed = 0;
      }

      currentPosition += (targetPosition - currentPosition) * settings.smoothing;

      const currentVelocity = Math.abs(currentPosition - prevPos) / deltaTime;
      velocityHistory.push(currentVelocity);
      velocityHistory.shift();

      const avgVelocity =
        velocityHistory.reduce((sum, val) => sum + val, 0) / velocityHistory.length;

      if (avgVelocity > peakVelocity) peakVelocity = avgVelocity;

      const velocityRatio = avgVelocity / (peakVelocity + 0.001);
      const isDecelerating = velocityRatio < 0.7 && peakVelocity > 0.5;

      peakVelocity *= 0.99;

      const movementDistortion = Math.min(1.0, currentVelocity * 0.1);
      if (currentVelocity > 0.05) {
        targetDistortionFactor = Math.max(
          targetDistortionFactor,
          movementDistortion
        );
      }

      if (isDecelerating || avgVelocity < 0.2) {
        const decayRate = isDecelerating
          ? settings.distortionDecay
          : settings.distortionDecay * 0.9;
        targetDistortionFactor *= decayRate;
      }

      currentDistortionFactor +=
        (targetDistortionFactor - currentDistortionFactor) * settings.distortionSmoothing;

      detailProgress += (selectedSlide ? 1 : 0 - detailProgress) * detailSpeed;

      slides.forEach((slide, i) => {
        let basePos = i * slideUnit - currentPosition;
        basePos = ((basePos % totalSize) + totalSize) % totalSize;
        if (basePos > totalSize / 2) basePos -= totalSize;

        const threshold = isVertical ? slideHeight : slideWidth;
        const isWrapping = Math.abs(basePos - slide.userData.targetPos) > threshold * 2;
        if (isWrapping) slide.userData.currentPos = basePos;

        slide.userData.targetPos = basePos;
        slide.userData.currentPos +=
          (slide.userData.targetPos - slide.userData.currentPos) * settings.slideLerp;

        if (isVertical) {
          slide.position.y = slide.userData.currentPos;
        } else {
          slide.position.x = slide.userData.currentPos;
        }

        if (!slide.userData.baseScale) {
          slide.userData.baseScale = { x: slide.scale.x, y: slide.scale.y };
        }

        if (slide === selectedSlide) {
          slide.position.z += (1.5 - slide.position.z) * 0.1;
          const scaleFactor = 1 + 0.3 * detailProgress;
          slide.scale.set(
            slide.userData.baseScale.x * scaleFactor,
            slide.userData.baseScale.y * scaleFactor,
            1
          );
        } else {
          slide.position.z += (-0.8 - slide.position.z) * 0.1;
          const scaleFactor = 1 - 0.15 * detailProgress;
          slide.scale.set(
            slide.userData.baseScale.x * scaleFactor,
            slide.userData.baseScale.y * scaleFactor,
            1
          );
        }

        if (slide.material.map) {
          slide.material.transparent = true;
          slide.material.opacity = slide === selectedSlide
            ? 1
            : 0.4 + 0.6 * (1 - detailProgress);
          slide.material.needsUpdate = true;
        }

        const worldPos = isVertical ? slide.position.y : slide.position.x;
        updateCurve(slide, worldPos, currentDistortionFactor, slide === selectedSlide);
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
      window.removeEventListener("click", handleClick);
      renderer.dispose();
    };
  }, [isMobile]);

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

export default HeroCarousel_Responsive2;