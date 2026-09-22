"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const GALLERY_NAMES = [
  "Estudio Norte",
  "Colección Silencio",
  "Archivo Mínimo",
  "Serie Horizontal",
  "Luz residual",
];

const FILTER_OPACITY_LERP = 0.18;

const GALLERY_TITLE_FONT_SIZE_PX = 14;
const GALLERY_TITLE_FONT_WEIGHT = "700";
const GALLERY_TITLE_LINE_HEIGHT = 1.15;
const GALLERY_LIST_GAP_PX = 3;
const GALLERY_TITLE_PADDING_Y_PX = 1;
const GALLERY_TITLE_COLOR = "rgba(0, 0, 0, 0.82)";
const GALLERY_TITLE_COLOR_HOVER = "#0a0a0a";
const GALLERY_UNDERLINE_HEIGHT_PX = 1;
const GALLERY_UNDERLINE_TRANSITION =
  "transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)";

function buildGalleryPaths(imagePool) {
  const n = GALLERY_NAMES.length;
  const per = Math.ceil(imagePool.length / n);
  return GALLERY_NAMES.map((_, i) =>
    imagePool.slice(i * per, (i + 1) * per)
  );
}

const SpiralOrb = ({
  totalItems = 94,
  baseWidth = 1.7,
  baseHeight = 1.1,
  sphereRadius = 4.6,
  backgroundColor = "FFFFFF"
}) => {
  const orbRef = useRef();

  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    const adjustedTotalItems = isMobile ? 56 : totalItems;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(parseInt(backgroundColor, 16));
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    orbRef.current.appendChild(renderer.domElement);

    let hoveredGalleryId = null;

    const galleryListEl = document.createElement("nav");
    Object.assign(galleryListEl.style, {
      position: "absolute",
      top: "20px",
      left: "20px",
      zIndex: "25",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: `${GALLERY_LIST_GAP_PX}px`,
      pointerEvents: "auto",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      letterSpacing: "0.08em",
    });
    orbRef.current.appendChild(galleryListEl);

    const galleryHeading = document.createElement("div");
    galleryHeading.textContent = "Galerías";
    Object.assign(galleryHeading.style, {
      fontSize: "8px",
      color: "rgba(0,0,0,0.4)",
      marginBottom: "2px",
      textTransform: "uppercase",
    });
    galleryListEl.appendChild(galleryHeading);

    galleryListEl.onmouseleave = () => {
      hoveredGalleryId = null;
    };

    GALLERY_NAMES.forEach((name, id) => {
      const row = document.createElement("button");
      row.type = "button";

      const labelWrap = document.createElement("span");
      Object.assign(labelWrap.style, {
        position: "relative",
        display: "inline-block",
      });

      const labelText = document.createElement("span");
      labelText.textContent = name;

      const underline = document.createElement("span");
      Object.assign(underline.style, {
        position: "absolute",
        left: "0",
        bottom: "0",
        width: "100%",
        height: `${GALLERY_UNDERLINE_HEIGHT_PX}px`,
        backgroundColor: "currentColor",
        transform: "scaleX(0)",
        transformOrigin: "left center",
        transition: GALLERY_UNDERLINE_TRANSITION,
        pointerEvents: "none",
      });

      labelWrap.appendChild(labelText);
      labelWrap.appendChild(underline);
      row.appendChild(labelWrap);

      Object.assign(row.style, {
        fontSize: `${GALLERY_TITLE_FONT_SIZE_PX}px`,
        fontWeight: GALLERY_TITLE_FONT_WEIGHT,
        lineHeight: String(GALLERY_TITLE_LINE_HEIGHT),
        color: GALLERY_TITLE_COLOR,
        background: "transparent",
        border: "none",
        padding: `${GALLERY_TITLE_PADDING_Y_PX}px 0`,
        cursor: "pointer",
        textAlign: "left",
      });

      const setTitleHover = (active) => {
        row.style.color = active
          ? GALLERY_TITLE_COLOR_HOVER
          : GALLERY_TITLE_COLOR;
        underline.style.transform = active ? "scaleX(1)" : "scaleX(0)";
      };

      row.onmouseenter = () => {
        hoveredGalleryId = id;
        setTitleHover(true);
      };
      row.onmouseleave = () => {
        setTitleHover(false);
      };
      galleryListEl.appendChild(row);
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;

    const group = new THREE.Group();
    scene.add(group);

    const textureLoader = new THREE.TextureLoader();
    const raycaster = new THREE.Raycaster();

    let mouse = new THREE.Vector2();
    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;

    let hovered = null;
    let mode = "sphere";
    let transition = 0;

    const meshes = [];

    /** Tiempo global al montar la escena — base para stagger de entrada */
    const sceneStartTime = performance.now() / 1000;

    /** Entrada: cada plano emerge desde el núcleo hacia su vértice en la esfera */
    const ENTRANCE_WAVE_SPREAD = 1.35;
    const ENTRANCE_DURATION = 1.05;
    /** Fracción del radio esférico: posición inicial sobre el mismo rayo que spherePos */
    const ENTRANCE_START_RADIUS_FACTOR = 0.14;

    // ---------------- IMAGES ----------------
    const imagePool = [
      "/images/optimized/IMG-20260321-WA0029_md.webp",
      "/images/optimized/IMG-20260321-WA0030_md.webp",
      "/images/optimized/IMG-20260321-WA0033_md.webp",
      "/images/optimized/IMG-20260321-WA0034_md.webp",
      "/images/optimized/IMG-20260321-WA0035_md.webp",
      "/images/optimized/IMG-20260321-WA0036_md.webp",
      "/images/optimized/IMG-20260321-WA0037_md.webp",
      "/images/optimized/IMG-20260321-WA0038_md.webp",
      "/images/optimized/IMG-20260321-WA0039_md.webp",
      "/images/optimized/IMG-20260321-WA0040_md.webp",
      "/images/optimized/IMG-20260321-WA0041_md.webp",
      "/images2/optimized/IMG-20260321-WA0013_md.webp",
      "/images2/optimized/IMG-20260321-WA0014_md.webp",
      "/images2/optimized/IMG-20260321-WA0015_md.webp",
      "/images2/optimized/IMG-20260321-WA0016_md.webp",
      "/images2/optimized/IMG-20260321-WA0017_md.webp",
      "/images2/optimized/IMG-20260321-WA0018_md.webp",
      "/images2/optimized/IMG-20260321-WA0019_md.webp",
      "/images2/optimized/IMG-20260321-WA0020_md.webp",
      "/images2/optimized/IMG-20260321-WA0021_md.webp",
      "/images2/optimized/IMG-20260321-WA0022_md.webp",
      "/images2/optimized/IMG-20260321-WA0023_md.webp",
      "/images2/optimized/IMG-20260321-WA0024_md.webp",
      "/images2/optimized/IMG-20260321-WA0025_md.webp",
      "/images2/optimized/IMG-20260321-WA0026_md.webp",
      "/images2/optimized/IMG-20260321-WA0031_md.webp",
      "/images2/optimized/IMG-20260321-WA0032_md.webp",
      "/images2/optimized/IMG-20260321-WA0042_md.webp"
    ];

    const galleryPaths = buildGalleryPaths(imagePool);

    const pickImageForGallery = (galleryId) => {
      const paths = galleryPaths[galleryId];
      return paths[Math.floor(Math.random() * paths.length)];
    };

    // ---------------- EASING ----------------
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    // Overshoot suave al llegar — toque profesional
    const easeOutBack = (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    // ---------------- EVENTS ----------------
    const handleMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseX = mouse.x;
      mouseY = mouse.y;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const handleClick = (e) => {
      const click = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      raycaster.setFromCamera(click, camera);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hit = intersects.find(
          (h) => h.object.visible && h.object.material.opacity > 0.08
        );
        if (hit) {
          hit.object.userData.isPoppedOut = !hit.object.userData.isPoppedOut;
        }
      }
    };
    window.addEventListener("click", handleClick);

    // ---------------- GEOMETRY ----------------
    const createPlane = (texture) => {
      const aspect = texture.image.width / texture.image.height;
      const scale = isMobile ? 0.55 : 0.65;

      let width = baseWidth * scale;
      let height = baseHeight * scale;

      if (aspect > 1) height = width / aspect;
      else width = height * aspect;

      return new THREE.PlaneGeometry(width * 1.15, height * 1.15);
    };

    // ---------------- CREATE ----------------
    for (let i = 0; i < adjustedTotalItems; i++) {
      const phi = Math.acos(-1 + (2 * i) / adjustedTotalItems);
      const theta = Math.sqrt(adjustedTotalItems * Math.PI) * phi;

      const spherePos = new THREE.Vector3(
        sphereRadius * Math.cos(theta) * Math.sin(phi),
        sphereRadius * Math.sin(theta) * Math.sin(phi),
        sphereRadius * Math.cos(phi)
      );

      const angle = i * 0.35;
      const y = -5 + (i / adjustedTotalItems) * 10;

      const cylinderPos = new THREE.Vector3(
        Math.cos(angle) * 3,
        y,
        Math.sin(angle) * 3
      );

      const galleryId = i % GALLERY_NAMES.length;
      const img = pickImageForGallery(galleryId);

      textureLoader.load(img, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;

        const entranceFrom = spherePos.clone().multiplyScalar(ENTRANCE_START_RADIUS_FACTOR);
        const staggerIndex =
          adjustedTotalItems > 1 ? i / (adjustedTotalItems - 1) : 0;
        const scheduled = sceneStartTime + staggerIndex * ENTRANCE_WAVE_SPREAD;
        const nowLoad = performance.now() / 1000;
        /** Si la textura llega tarde, no se salta el recorrido: arranca ya */
        const entranceDelay = Math.max(scheduled, nowLoad);

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0,
          fog: false,
        });

        const mesh = new THREE.Mesh(createPlane(texture), material);

        mesh.position.copy(entranceFrom);
        mesh.scale.setScalar(0.04);

        mesh.userData = {
          galleryId,
          spherePos,
          cylinderPos,
          isPoppedOut: false,
          entranceDelay,
          entranceProgress: 0,
          entranceComplete: false,
          entranceFrom,
          // --- Shuffle state ---
          shuffleDelay: -1,
          shuffleProgress: 1,
          shuffleFrom: spherePos.clone(),
          shuffleTarget: spherePos.clone(),
        };

        group.add(mesh);
        meshes.push(mesh);
      });
    }

    // ---------------- SHUFFLE ----------------
    const WAVE_SPREAD = 1.2;    // segundos entre el primer y último mesh en arrancar
    const TRAVEL_DURATION = 0.7; // segundos que tarda cada mesh en viajar

    const triggerShuffle = () => {
      if (meshes.length === 0) return;

      // 1. Fisher-Yates sobre los targets
      const positions = meshes.map((m) => ({
        spherePos: m.userData.spherePos.clone(),
        cylinderPos: m.userData.cylinderPos.clone(),
      }));

      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      const now = performance.now() / 1000;
      const t = easeOut(transition);

      meshes.forEach((m, i) => {
        // 2. Delay proporcional al índice — crea la ola
        const normalizedIndex = i / (meshes.length - 1);
        const delay = normalizedIndex * WAVE_SPREAD;

        // 3. Desde dónde parte: posición target actual según modo
        const currentTarget = new THREE.Vector3()
          .copy(m.userData.spherePos)
          .lerp(m.userData.cylinderPos, t);

        // 4. Hacia dónde va: nuevo target según modo actual
        const newTarget = new THREE.Vector3()
          .copy(positions[i].spherePos)
          .lerp(positions[i].cylinderPos, t);

        m.userData.shuffleFrom = currentTarget.clone();
        m.userData.shuffleTarget = newTarget.clone();
        m.userData.shuffleDelay = now + delay;
        m.userData.shuffleProgress = 0;
        m.userData.isPoppedOut = false;

        // 5. Actualizar targets definitivos para el loop post-shuffle
        m.userData.spherePos = positions[i].spherePos;
        m.userData.cylinderPos = positions[i].cylinderPos;
      });
    };

    // ---------------- ANIMATE ----------------
    const animate = () => {
      requestAnimationFrame(animate);

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      group.rotation.y += 0.0015;
      group.rotation.x = targetY * 0.3;
      group.rotation.y += targetX * 0.002;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(meshes, false);
      const visibleHit = intersects.find(
        (hit) =>
          hit.object.visible && hit.object.material.opacity > 0.08
      );
      hovered = visibleHit ? visibleHit.object : null;

      const target = mode === "sphere" ? 0 : 1;
      transition += (target - transition) * 0.05;
      const t = easeOut(transition);

      const time = performance.now() * 0.002;
      const now = performance.now() / 1000;
      const filterActive = hoveredGalleryId !== null;

      const filterFactor = (mesh) =>
        !filterActive || mesh.userData.galleryId === hoveredGalleryId
          ? 1
          : 0;

      meshes.forEach((mesh, i) => {

        // --- Entrada inicial (esfera) ---
        if (!mesh.userData.entranceComplete) {
          const elapsed = now - mesh.userData.entranceDelay;

          if (elapsed < 0) {
            const waitPulse = 0.03 + 0.02 * Math.sin(time * 6 + i);
            mesh.scale.lerp(
              new THREE.Vector3(0.04 + waitPulse, 0.04 + waitPulse, 0.04 + waitPulse),
              0.15
            );
            mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, 0, 0.12);
            mesh.lookAt(camera.position);
            return;
          }

          const raw = Math.min(elapsed / ENTRANCE_DURATION, 1);
          mesh.userData.entranceProgress = raw;

          const easedPos = easeOutBack(raw);
          const posT = Math.min(easedPos, 1);

          const newPos = new THREE.Vector3().lerpVectors(
            mesh.userData.entranceFrom,
            mesh.userData.spherePos,
            posT
          );
          mesh.position.lerp(newPos, 0.28);

          const scaleVal =
            raw < 0.35
              ? THREE.MathUtils.lerp(0.04, 0.85, raw / 0.35)
              : THREE.MathUtils.lerp(0.85, 1.3, (raw - 0.35) / 0.65);

          mesh.scale.lerp(
            new THREE.Vector3(scaleVal, scaleVal, scaleVal),
            0.22
          );

          const baseOp = easeOut(raw);
          const targetOp = baseOp * filterFactor(mesh);
          mesh.material.opacity = THREE.MathUtils.lerp(
            mesh.material.opacity,
            targetOp,
            FILTER_OPACITY_LERP
          );
          mesh.visible = mesh.material.opacity > 0.02;

          if (raw >= 1) {
            mesh.userData.entranceComplete = true;
            mesh.position.copy(mesh.userData.spherePos);
            mesh.scale.setScalar(1.3);
          }

          mesh.lookAt(camera.position);
          return;
        }

        // --- Pop out ---
        if (mesh.userData.isPoppedOut) {
          const dir = mesh.position.clone().normalize();
          const float = Math.sin(time + i) * 0.25;
          mesh.position.lerp(dir.multiplyScalar(7 + float), 0.08);
          mesh.scale.lerp(new THREE.Vector3(2.2, 2.2, 2.2), 0.08);
          const targetOpPop = filterFactor(mesh);
          mesh.material.opacity = THREE.MathUtils.lerp(
            mesh.material.opacity,
            targetOpPop,
            FILTER_OPACITY_LERP
          );
          mesh.visible = mesh.material.opacity > 0.02;
          mesh.lookAt(camera.position);
          return;
        }

        // --- Shuffle en curso ---
        if (mesh.userData.shuffleProgress < 1) {
          const elapsed = now - mesh.userData.shuffleDelay;

          if (elapsed < 0) {
            // Esperando su turno: pulso de escala sutil
            const pulse = 0.9 + 0.04 * Math.sin(time * 8 + i);
            mesh.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.12);
          } else {
            const raw = Math.min(elapsed / TRAVEL_DURATION, 1);
            mesh.userData.shuffleProgress = raw;

            // easeOutBack para la posición — overshoot al llegar
            const easedPos = easeOutBack(raw);

            // Escala: baja al salir, sube al llegar
            const scaleVal = raw < 0.4
              ? THREE.MathUtils.lerp(1.3, 0.8, raw / 0.4)
              : THREE.MathUtils.lerp(0.8, 1.3, (raw - 0.4) / 0.6);

            mesh.scale.lerp(new THREE.Vector3(scaleVal, scaleVal, scaleVal), 0.18);

            // Posición con easing
            const newPos = new THREE.Vector3().lerpVectors(
              mesh.userData.shuffleFrom,
              mesh.userData.shuffleTarget,
              Math.min(easedPos, 1) // clamp para evitar artefactos del overshoot en posición
            );
            mesh.position.lerp(newPos, 0.22);
          }

          const targetOpSh = filterFactor(mesh);
          mesh.material.opacity = THREE.MathUtils.lerp(
            mesh.material.opacity,
            targetOpSh,
            FILTER_OPACITY_LERP
          );
          mesh.visible = mesh.material.opacity > 0.02;
          mesh.lookAt(camera.position);
          return;
        }

        // --- Comportamiento normal ---
        const basePos = new THREE.Vector3()
          .copy(mesh.userData.spherePos)
          .lerp(mesh.userData.cylinderPos, t);

        mesh.position.lerp(basePos, 0.1);

        mesh.scale.lerp(
          mesh === hovered
            ? new THREE.Vector3(1.7, 1.7, 1.7)
            : new THREE.Vector3(1.3, 1.3, 1.3),
          0.08
        );

        const targetOpN = filterFactor(mesh);
        mesh.material.opacity = THREE.MathUtils.lerp(
          mesh.material.opacity,
          targetOpN,
          FILTER_OPACITY_LERP
        );
        mesh.visible = mesh.material.opacity > 0.02;

        mesh.lookAt(camera.position);
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // ---------------- BUTTONS ----------------
    const container = document.createElement("div");

    Object.assign(container.style, {
      position: "absolute",
      bottom: "30px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "10px",
      padding: "6px 10px",
      borderRadius: "999px",
      backdropFilter: "blur(20px)",
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.1)"
    });

    orbRef.current.appendChild(container);

    const createBtn = (label, onClick) => {
      const b = document.createElement("div");
      b.innerText = label;

      Object.assign(b.style, {
        padding: "6px 12px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: "0.7rem",
        cursor: "pointer",
        transition: "background 0.2s"
      });

      b.onmouseenter = () => (b.style.background = "rgba(255,255,255,0.18)");
      b.onmouseleave = () => (b.style.background = "rgba(255,255,255,0.08)");
      b.onclick = onClick;
      container.appendChild(b);
    };

    createBtn("Toggle", () => {
      meshes.forEach((m) => (m.userData.isPoppedOut = false));
      mode = mode === "sphere" ? "cylinder" : "sphere";
    });

    createBtn("Shuffle", triggerShuffle);

    createBtn("Reset", () => {
      meshes.forEach((m) => (m.userData.isPoppedOut = false));
    });

    // ---------------- RESIZE ----------------
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);

      if (orbRef.current?.contains(renderer.domElement)) {
        orbRef.current.removeChild(renderer.domElement);
      }
      if (orbRef.current?.contains(galleryListEl)) {
        orbRef.current.removeChild(galleryListEl);
      }
      if (orbRef.current?.contains(container)) {
        orbRef.current.removeChild(container);
      }
    };
  }, [totalItems, baseWidth, baseHeight, sphereRadius, backgroundColor]);

  return <div ref={orbRef} style={{ width: "100vw", height: "100vh" }} />;
};

export default SpiralOrb;