"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import gsap from "gsap";
import AboutSection6 from "../about/index6";
import BerlinClock from "../tools/BerlinClock";

// ── Shader idéntico al AquaSlider ─────────────────────────────────────────────
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture1;
  uniform sampler2D uTexture2;
  uniform float uProgress;
  uniform vec2  uResolution;
  uniform vec2  uTexture1Size;
  uniform vec2  uTexture2Size;
  varying vec2  vUv;

  vec2 getCoverUV(vec2 uv, vec2 textureSize) {
    vec2 s = uResolution / textureSize;
    float scale = max(s.x, s.y);
    vec2 scaledSize = textureSize * scale;
    vec2 offset = (uResolution - scaledSize) * 0.5;
    return (uv * uResolution - offset) / scaledSize;
  }

  vec2 getDistortedUv(vec2 uv, vec2 direction, float factor) {
    vec2 scaledDirection = direction;
    scaledDirection.y *= 2.0;
    return uv - scaledDirection * factor;
  }

  struct LensDistortion {
    vec2 distortedUV;
    float inside;
  };

  LensDistortion getLensDistortion(
    vec2 p, vec2 uv, vec2 sphereCenter,
    float sphereRadius, float focusFactor
  ) {
    vec2  distortionDirection = normalize(p - sphereCenter);
    float focusRadius    = sphereRadius * focusFactor;
    float focusStrength  = sphereRadius / 3000.0;
    float focusSdf       = length(sphereCenter - p) - focusRadius;
    float sphereSdf      = length(sphereCenter - p) - sphereRadius;
    float inside         = smoothstep(0.0, 1.0, -sphereSdf / (sphereRadius * 0.001));
    float magnifierFactor = focusSdf / (sphereRadius - focusRadius);
    float mFactor        = clamp(magnifierFactor * inside, 0.0, 1.0);
    mFactor              = pow(mFactor, 5.0);
    vec2  distortedUV    = getDistortedUv(uv, distortionDirection, mFactor * focusStrength);
    return LensDistortion(distortedUV, inside);
  }

  void main() {
    vec2  center       = vec2(0.5, 0.5);
    vec2  p            = vUv * uResolution;
    vec2  uv1          = getCoverUV(vUv, uTexture1Size);
    vec2  uv2          = getCoverUV(vUv, uTexture2Size);
    float maxRadius    = length(uResolution) * 1.5;
    float bubbleRadius = uProgress * maxRadius;
    vec2  sphereCenter = center * uResolution;
    float dist         = length(sphereCenter - p);

    // mask: 1 = fuera de la burbuja, 0 = dentro
    float mask       = step(bubbleRadius, dist);
    vec4  currentImg = texture2D(uTexture1, uv1);

    LensDistortion d = getLensDistortion(p, uv2, sphereCenter, bubbleRadius, 0.25);
    vec4  newImg     = texture2D(uTexture2, d.distortedUV);

    float finalMask  = max(mask, 1.0 - d.inside);
    gl_FragColor     = mix(newImg, currentImg, finalMask);
  }
`;

// ── Captura el canvas del AquaSlider ─────────────────────────────────────────
function capturePageTexture() {
  const aquaCanvas = document.querySelector("[data-aqua-canvas='true']");
  if (!aquaCanvas) return null;
  const w = window.innerWidth, h = window.innerHeight;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const ctx = off.getContext("2d");
  ctx.drawImage(aquaCanvas, 0, 0, w, h);
  // Fallback Safari
  const px = ctx.getImageData(w >> 1, h >> 1, 1, 1).data;
  if (px[0] === 0 && px[1] === 0 && px[2] === 0) {
    const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.7);
    g.addColorStop(0, "#2a2a3a");
    g.addColorStop(1, "#0d0d15");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const tex = new THREE.CanvasTexture(off);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.userData  = { size: new THREE.Vector2(w, h) };
  return tex;
}

// tex1 TRANSPARENTE — fuera de la burbuja el shader es alpha=0
// así el blur CSS sigue visible debajo durante el cierre
function createTransparentTexture() {
  const w = window.innerWidth, h = window.innerHeight;
  const data = new Uint8Array([0, 0, 0, 0]);   // rgba totalmente transparente
  const tex  = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.userData    = { size: new THREE.Vector2(w, h) };
  return tex;
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function HeaderFooter8({ children }) {
  const [modalState, setModalState] = useState("closed");

  const h1Ref        = useRef(null);
  const canvasRef    = useRef(null);
  const blurLayerRef = useRef(null);
  const contentRef   = useRef(null);
  const materialRef  = useRef(null);
  const loopIdRef    = useRef(null);
  const animRef      = useRef(false);

  const words = ["allthatjazz","すべてのジャズ","όλοαυτότζαζ","वह सभी जाज है","allthatjazz"];

  // ── Scramble ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!h1Ref.current) return;
    const el    = h1Ref.current;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789あいうえお漢字العربيةРусскийΑλφάβητοไทย";
    const rand  = () => chars[Math.floor(Math.random() * chars.length)];
    const scramble = (word) => new Promise(res => {
      const letters = word.split(""), out = Array(letters.length).fill(""); let it = 0;
      const id = setInterval(() => {
        it++;
        for (let i = 0; i < letters.length; i++) out[i] = it < 7 ? rand() : letters[i];
        el.textContent = out.join("");
        if (it >= 15) { clearInterval(id); res(); }
      }, 40);
    });
    (async () => {
      el.textContent = "allthatjazz";
      await new Promise(r => setTimeout(r, 800));
      for (const w of words) { await scramble(w); await new Promise(r => setTimeout(r, 500)); }
      el.textContent = "allthatjazz";
    })();
  }, []);

  // ── Three.js setup — una sola vez ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const w = window.innerWidth, h = window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);

    const scene    = new THREE.Scene();
    const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture1:     { value: null },
        uTexture2:     { value: null },
        uProgress:     { value: 0 },
        uResolution:   { value: new THREE.Vector2(w, h) },
        uTexture1Size: { value: new THREE.Vector2(w, h) },
        uTexture2Size: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader, fragmentShader,
      transparent: true,
    });
    materialRef.current = material;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    const loop = () => {
      loopIdRef.current = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(loopIdRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  const handleOpen = useCallback(() => {
    if (modalState !== "closed" || animRef.current) return;
    setModalState("opening");
  }, [modalState]);

  const handleClose = useCallback(() => {
    if (modalState !== "open" || animRef.current) return;
    setModalState("closing");
  }, [modalState]);

  // ── Transiciones ───────────────────────────────────────────────────────────
  useEffect(() => {
    const maxR = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);

    // ── OPENING: solo clip-path, sin WebGL, sin blanco ───────────────────────
    if (modalState === "opening") {
      if (animRef.current) return;
      animRef.current = true;

      const bl = blurLayerRef.current;
      if (bl) {
        bl.style.transition = "none";
        bl.style.opacity    = "1";
        bl.style.clipPath   = "circle(0px at 50% 50%)";
      }

      const prog = { v: 0 };
      gsap.to(prog, {
        v: 1,
        duration: 1.6,
        ease: "power2.inOut",
        onUpdate() {
          if (blurLayerRef.current)
            blurLayerRef.current.style.clipPath =
              `circle(${prog.v * maxR * 1.06}px at 50% 50%)`;
        },
        onComplete() {
          if (blurLayerRef.current) blurLayerRef.current.style.clipPath = "none";
          animRef.current = false;
          setModalState("open");
        },
      });
    }

    // ── CLOSING ───────────────────────────────────────────────────────────────
    // La burbuja crece desde el centro revelando la página con lens distortion.
    // Fuera de la burbuja: el blur CSS sigue visible (tex1 transparente).
    // Dentro de la burbuja: tex2 (página sharp) con lens distortion.
    // El blur CSS se contrae sincronizado con la burbuja que crece.
    if (modalState === "closing") {
      if (animRef.current) return;
      animRef.current = true;

      const mat = materialRef.current;
      if (!mat) return;

      const tex1 = createTransparentTexture(); // fuera de burbuja → transparente
      const tex2 = capturePageTexture();       // dentro de burbuja → página sharp
      if (!tex2) { setModalState("closed"); animRef.current = false; return; }

      // Fade out del texto del about — simultáneo, rápido
      if (contentRef.current)
        gsap.to(contentRef.current, { opacity: 0, duration: 0.25, ease: "power2.in" });

      // Blur layer: empieza full y se contrae conforme la burbuja crece
      const bl = blurLayerRef.current;
      if (bl) {
        bl.style.transition = "none";
        bl.style.opacity    = "1";
        bl.style.clipPath   = "none"; // cubre toda la pantalla
      }

      mat.uniforms.uTexture1.value     = tex1;
      mat.uniforms.uTexture2.value     = tex2;
      mat.uniforms.uTexture1Size.value = tex1.userData.size;
      mat.uniforms.uTexture2Size.value = tex2.userData.size;
      mat.uniforms.uProgress.value     = 0;

      const prog = { v: 0 };
      gsap.to(prog, {
        v: 1,
        duration: 2.5,
        ease: "power2.inOut",
        onUpdate() {
          mat.uniforms.uProgress.value = prog.v;

          // El blur se contrae al mismo ritmo que la burbuja crece
          // → fuera de la burbuja: blur visible  |  dentro: shader (página sharp)
          const r = prog.v * maxR * 1.06;
          if (blurLayerRef.current)
            blurLayerRef.current.style.clipPath =
              `circle(${Math.max(0, maxR * 1.06 - r)}px at 50% 50%)`;
        },
        onComplete() {
          mat.uniforms.uProgress.value = 0;
          if (blurLayerRef.current) {
            blurLayerRef.current.style.opacity  = "1";
            blurLayerRef.current.style.clipPath = "circle(0px at 50% 50%)";
          }
          tex1.dispose();
          tex2.dispose();
          animRef.current = false;
          setModalState("closed");
        },
      });
    }
  }, [modalState]);

  // ── Fade in contenido ─────────────────────────────────────────────────────
  useEffect(() => {
    if (modalState !== "open" || !contentRef.current) return;
    gsap.fromTo(contentRef.current,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }
    );
  }, [modalState]);

  const isVisible   = modalState !== "closed";
  const showContent = modalState === "open" || modalState === "closing";
  const isClosing   = modalState === "closing";

  return (
    <>
      {/* Clock */}
      <div className="fixed top-0 left-0 w-full flex justify-center pt-[16px] z-[9999] pointer-events-none">
        <BerlinClock />
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 w-full flex flex-col justify-center items-center pb-2 leading-[2.75rem] z-[9999] HeaderFooter select-none pointer-events-auto">
        <div className="flex" onClick={isVisible ? handleClose : handleOpen}>
          <h1
            ref={h1Ref}
            className="text-[4rem] tracking-[-0.04em] text-black select-none whitespace-nowrap cursor-pointer"
          >
            allthatjazz
          </h1>
        </div>
        <p className="flex text-[1.35rem] text-black MyFont2 tracking-[-0.05em] pointer-none">
          Atelier de création graphique et digitale.
        </p>
      </div>

      {/* Contenido principal */}
      <div className="w-full h-full">{children}</div>

      {/* Canvas WebGL — solo activo en cierre, fondo transparente */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          display: "block", width: "100%", height: "100%",
          zIndex:  isClosing ? 1003 : -1,
          opacity: isClosing ? 1    : 0,
        }}
      />

      {isVisible && (
        <>
          {/* Blur layer — clip-path animado en ambas transiciones */}
          <div
            ref={blurLayerRef}
            className="fixed inset-0 z-[1000]"
            style={{
              backgroundColor:      "rgba(255, 255, 255, 0.15)",
              backdropFilter:       "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              clipPath:             "circle(0px at 50% 50%)",
              transform:            "translateZ(0)",
              WebkitTransform:      "translateZ(0)",
            }}
          />

          {/* Contenido about + mix-blend */}
          {showContent && (
            <div
              ref={contentRef}
              className="fixed inset-0 z-[1001] overflow-y-auto text-white mix-blend-difference"
              style={{ opacity: 0 }}
              onClick={handleClose}
            >
              <AboutSection6 />
            </div>
          )}
        </>
      )}
    </>
  );
}