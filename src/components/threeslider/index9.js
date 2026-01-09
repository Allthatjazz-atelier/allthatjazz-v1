"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const HeroCarousel2_2 = () => {
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
    camera.position.z = 5;

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

    const slideWidth = 3.0;
    const slideHeight = 1.5;
    const gap = 0.1;
    const slideCount = 10;
    const imagesCount = 19;
    const totalWidth = slideCount * (slideWidth + gap);
    const slideUnit = slideWidth + gap;

    const slides = [];
    let currentPosition = 0;
    let targetPosition = 0;
    let isScrolling = false;
    let autoScrollSpeed = 0;
    let lastTime = 0;
    let touchStartX = 0;
    let touchLastX = 0;

    let currentDistortionFactor = 0;
    let targetDistortionFactor = 0;
    let peakVelocity = 0;
    let velocityHistory = [0, 0, 0, 0, 0];

    // --- ESTADO DE DETALLE CON SUCCIÓN ---
    let selectedSlide = null;
    let detailProgress = 0;
    let isClosing = false;
    let suctionEffect = 0;
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
      mesh.position.x = index * (slideWidth + gap);
      mesh.userData = {
        originalVertices: [...geometry.attributes.position.array],
        index,
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
          } else {
            mesh.scale.x = imgAspect / slideAspect;
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
      slide.position.x -= totalWidth / 2;
      slide.userData.targetX = slide.position.x;
      slide.userData.currentX = slide.position.x;
    });

    const updateCurve = (mesh, worldPositionX, distortionFactor, isSelected = false, suction = 0) => {
      const distortionCenter = new THREE.Vector2(0, 0);
      const distortionRadius = 2.0;
      const maxCurvature = settings.maxDistortion * distortionFactor;

      const positionAttribute = mesh.geometry.attributes.position;
      const originalVertices = mesh.userData.originalVertices;

      for (let i = 0; i < positionAttribute.count; i++) {
        const x = originalVertices[i * 3];
        const y = originalVertices[i * 3 + 1];

        const vertexWorldPosX = worldPositionX + x;
        const distFromCenter = Math.sqrt(
          Math.pow(vertexWorldPosX - distortionCenter.x, 2) +
            Math.pow(y - distortionCenter.y, 2)
        );

        let curveZ =
          Math.pow(Math.sin((Math.max(0, 1 - distFromCenter / distortionRadius) * Math.PI) / 2), 1.5) *
          maxCurvature;

        // Efecto de ondas suave cuando está seleccionada
        if (isSelected && !isClosing) {
          curveZ += Math.sin(Date.now() * 0.005 + i) * 0.3;
        }

        // EFECTO DE SUCCIÓN: los vértices se "hunden" hacia el centro
        if (suction > 0) {
          const normalizedDist = distFromCenter / distortionRadius;
          // Crear un efecto de "embudo" o succión hacia el centro
          const suctionIntensity = Math.pow(1 - normalizedDist, 2) * suction * 1.2;
          curveZ -= suctionIntensity; // Resta para crear el efecto de hundimiento
          
          // Añadir un poco de ondulación durante la succión
          const ripple = Math.sin(normalizedDist * 8 - Date.now() * 0.008) * suction * 0.3;
          curveZ += ripple;
        }

        positionAttribute.setZ(i, curveZ);
      }

      positionAttribute.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    };

    // --- RAYCAST PARA CLIC ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handleClick = (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(slides);

      if (intersects.length > 0) {
        const clickedSlide = intersects[0].object;
        
        if (selectedSlide === clickedSlide) {
          // Segundo clic: iniciar succión
          isClosing = true;
          suctionEffect = 1.0;
        } else {
          // Primer clic: seleccionar
          selectedSlide = clickedSlide;
          isClosing = false;
          suctionEffect = 0;
        }
      }
    };

    window.addEventListener("click", handleClick);

    // --- OTROS EVENTOS ---
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        targetPosition += slideUnit;
        targetDistortionFactor = Math.min(1.0, targetDistortionFactor + 0.3);
      } else if (e.key === "ArrowRight") {
        targetPosition -= slideUnit;
        targetDistortionFactor = Math.min(1.0, targetDistortionFactor + 0.3);
      } else if (e.key === "Escape" && selectedSlide) {
        isClosing = true;
        suctionEffect = 1.0;
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
      touchStartX = e.touches[0].clientX;
      touchLastX = touchStartX;
      isScrolling = false;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touchX = e.touches[0].clientX;
      const deltaX = touchX - touchLastX;
      touchLastX = touchX;

      const touchStrength = Math.abs(deltaX) * 0.02;
      targetDistortionFactor = Math.min(
        1.0,
        targetDistortionFactor + touchStrength
      );

      targetPosition -= deltaX * settings.touchSensitivity;
      isScrolling = true;
    };

    const handleTouchEnd = () => {
      const velocity = (touchLastX - touchStartX) * 0.005;
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
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("resize", handleResize);

    // --- ANIMACIÓN ---
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

      // --- MANEJO DEL CIERRE CON SUCCIÓN ---
      if (isClosing) {
        detailProgress -= detailSpeed * 1.2;
        suctionEffect -= 0.08; // Decay gradual del efecto de succión
        
        if (detailProgress <= 0) {
          detailProgress = 0;
          suctionEffect = 0;
          isClosing = false;
          selectedSlide = null;
        }
      } else if (selectedSlide) {
        detailProgress += (1 - detailProgress) * detailSpeed;
      }

      slides.forEach((slide, i) => {
        let baseX = i * slideUnit - currentPosition;
        baseX = ((baseX % totalWidth) + totalWidth) % totalWidth;
        if (baseX > totalWidth / 2) baseX -= totalWidth;

        const isWrapping =
          Math.abs(baseX - slide.userData.targetX) > slideWidth * 2;
        if (isWrapping) slide.userData.currentX = baseX;

        slide.userData.targetX = baseX;
        slide.userData.currentX +=
          (slide.userData.targetX - slide.userData.currentX) * settings.slideLerp;

        slide.position.x = slide.userData.currentX;

        // --- EFECTOS DE DETALLE ---
        if (slide === selectedSlide) {
          // Subir y escalar la slide seleccionada (mantener efecto original)
          slide.position.z += (1.5 - slide.position.z) * 0.1;
          const scale = 1 + 0.3 * detailProgress;
          slide.scale.set(scale, scale, 1);
        } else {
          // Slides no seleccionadas se alejan y se hacen un poco más pequeñas
          slide.position.z += (-0.8 - slide.position.z) * 0.1;
          const scale = 1 - 0.15 * detailProgress;
          slide.scale.set(scale, scale, 1);
        }

        // Opacidad de slides
        if (slide.material.map) {
          slide.material.transparent = true;
          slide.material.opacity = slide === selectedSlide
            ? 1
            : 0.4 + 0.6 * (1 - detailProgress);
          slide.material.needsUpdate = true;
        }

        // Aplicar efecto de succión solo a la slide seleccionada
        const slideSuction = (slide === selectedSlide && isClosing) ? suctionEffect : 0;
        updateCurve(
          slide, 
          slide.position.x, 
          currentDistortionFactor, 
          slide === selectedSlide,
          slideSuction
        );
      });

      renderer.render(scene, camera);
    };

    animate();

    // --- LIMPIEZA ---
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

export default HeroCarousel2_2;