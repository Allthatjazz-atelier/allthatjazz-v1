"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const HeroCarousel4 = () => {
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
    camera.position.z = 7;

    const settings = {
      wheelSensitivity: 0.01,
      touchSensitivity: 0.01,
      momentumMultiplier: 2,
      smoothing: 0.1,
      slideLerp: 0.075,
      distortionDecay: 0.95,
      maxDistortion: 2.5,
      distortionSensitivity: 0.15,
      distortionSmoothing: 0.075,
    };

    const slideWidth = 5.0;
    const slideHeight = 2.5;
    const gap = 0.1;
    const slideCount = 10;
    const imagesCount = 19;
    const totalHeight = slideCount * (slideHeight + gap);
    const slideUnit = slideHeight + gap;

    const slides = [];
    let currentPosition = 0;
    let targetPosition = 0;
    let isScrolling = false;
    let autoScrollSpeed = 0;
    let lastTime = 0;
    let touchStartY = 0;
    let touchLastY = 0;

    let currentDistortionFactor = 0;
    let targetDistortionFactor = 0;
    let peakVelocity = 0;
    let velocityHistory = [0, 0, 0, 0, 0];

    let selectedSlide = null;
    let windTime = 0;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

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
      mesh.position.y = index * (slideHeight + gap);
      mesh.userData = {
        originalVertices: [...geometry.attributes.position.array],
        index,
        targetScale: 1.0,
        currentScale: 1.0,
        originalScaleX: 1.0,
        originalScaleY: 1.0,
      };

      const imageIndex = (index % imagesCount) + 1;
      const imagePath = `/hero/img${imageIndex}.png`;

      new THREE.TextureLoader().load(
        imagePath,
        (texture) => {
          correctImageColor(texture);
          material.map = texture;
          material.needsUpdate = true;

          const imgAspect = texture.image.width / texture.image.height;
          const slideAspect = slideWidth / slideHeight;

          if (imgAspect > slideAspect) {
            mesh.scale.y = slideAspect / imgAspect;
            mesh.userData.originalScaleY = slideAspect / imgAspect;
          } else {
            mesh.scale.x = imgAspect / slideAspect;
            mesh.userData.originalScaleX = imgAspect / slideAspect;
          }
        },
        undefined,
        (err) => console.warn(`Couldn't load image ${imagePath}`, err)
      );

      scene.add(mesh);
      slides.push(mesh);
    };

    for (let i = 0; i < slideCount; i++) createSlide(i);

    slides.forEach((slide) => {
      slide.position.y -= totalHeight / 2;
      slide.userData.targetY = slide.position.y;
      slide.userData.currentY = slide.position.y;
    });

    const updateCurve = (mesh, worldPositionY, distortionFactor) => {
      const distortionCenter = new THREE.Vector2(0, 0);
      const distortionRadius = slideHeight * 1.5;
      const maxCurvature = settings.maxDistortion * distortionFactor;

      const positionAttribute = mesh.geometry.attributes.position;
      const originalVertices = mesh.userData.originalVertices;

      const isSelected = selectedSlide === mesh;
      const windStrength = isSelected ? 0.15 : 0;
      const windFrequency = 3.0;
      const windSpeed = 2.0;

      for (let i = 0; i < positionAttribute.count; i++) {
        const x = originalVertices[i * 3];
        const y = originalVertices[i * 3 + 1];

        const vertexWorldPosY = worldPositionY + y;
        const distFromCenter = Math.sqrt(
          Math.pow(x - distortionCenter.x, 2) +
            Math.pow(vertexWorldPosY - distortionCenter.y, 2)
        );

        let distortionStrength = 1 - distFromCenter / distortionRadius;
        distortionStrength = Math.max(0, distortionStrength);
        distortionStrength = Math.pow(distortionStrength, 0.7);

        const curveZ = Math.sin((distortionStrength * Math.PI) / 2) * maxCurvature;

        let windZ = 0;
        if (isSelected) {
          const wave1 = Math.sin(x * windFrequency + windTime * windSpeed) * windStrength;
          const wave2 = Math.sin(y * windFrequency * 0.7 + windTime * windSpeed * 1.3) * windStrength * 0.5;
          windZ = (wave1 + wave2) * (1 - Math.abs(x) / (slideWidth / 2));
        }

        positionAttribute.setZ(i, curveZ + windZ);
      }

      positionAttribute.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    };

    const handleClick = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(slides);

      if (intersects.length > 0) {
        const clickedSlide = intersects[0].object;
        
        if (selectedSlide === clickedSlide) {
          selectedSlide = null;
          slides.forEach(slide => {
            slide.userData.targetScale = 1.0;
          });
        } else {
          selectedSlide = clickedSlide;
          slides.forEach(slide => {
            if (slide === selectedSlide) {
              slide.userData.targetScale = 1.0;
            } else {
              slide.userData.targetScale = 0.20;
            }
          });
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "ArrowUp") {
        targetPosition += slideUnit;
        targetDistortionFactor = Math.min(1.0, targetDistortionFactor + 0.3);
      } else if (e.key === "ArrowDown") {
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
      touchStartY = e.touches[0].clientY;
      touchLastY = touchStartY;
      isScrolling = false;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchLastY;
      touchLastY = touchY;

      const touchStrength = Math.abs(deltaY) * 0.02;
      targetDistortionFactor = Math.min(
        1.0,
        targetDistortionFactor + touchStrength
      );

      targetPosition -= deltaY * settings.touchSensitivity;
      isScrolling = true;
    };

    const handleTouchEnd = () => {
      const velocity = (touchLastY - touchStartY) * 0.005;
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
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClick);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("resize", handleResize);

    const animate = (time) => {
      requestAnimationFrame(animate);

      const deltaTime = lastTime ? (time - lastTime) / 1000 : 0.016;
      lastTime = time;

      if (selectedSlide) {
        windTime += deltaTime;
      }

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

      slides.forEach((slide, i) => {
        let baseY = i * slideUnit - currentPosition;
        baseY = ((baseY % totalHeight) + totalHeight) % totalHeight;
        if (baseY > totalHeight / 2) baseY -= totalHeight;

        const isWrapping =
          Math.abs(baseY - slide.userData.targetY) > slideHeight * 2;
        if (isWrapping) slide.userData.currentY = baseY;

        slide.userData.targetY = baseY;
        slide.userData.currentY +=
          (slide.userData.targetY - slide.userData.currentY) * settings.slideLerp;

        slide.userData.currentScale +=
          (slide.userData.targetScale - slide.userData.currentScale) * 0.08;
        
        slide.scale.x = slide.userData.originalScaleX * slide.userData.currentScale;
        slide.scale.y = slide.userData.originalScaleY * slide.userData.currentScale;

        const wrapThreshold = totalHeight / 2 + slideHeight;
        if (Math.abs(slide.userData.currentY) < wrapThreshold * 1.5) {
          slide.position.y = slide.userData.currentY;
          updateCurve(slide, slide.position.y, currentDistortionFactor);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
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
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}
    />
  );
};

export default HeroCarousel4;