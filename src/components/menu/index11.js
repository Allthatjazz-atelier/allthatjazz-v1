"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import gsap from "gsap";
import BerlinClock from "../tools/BerlinClock";
import AboutSection8 from "../about/index8";
import BerlinClock3 from "../tools/BerlinClock3";
import BerlinClock2 from "../tools/BerlinClock2";

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
    float mask         = step(bubbleRadius, dist);
    vec4  currentImg   = texture2D(uTexture1, uv1);
    LensDistortion d   = getLensDistortion(p, uv2, sphereCenter, bubbleRadius, 0.25);
    vec4  newImg       = texture2D(uTexture2, d.distortedUV);
    float finalMask    = max(mask, 1.0 - d.inside);
    gl_FragColor       = mix(newImg, currentImg, finalMask);
  }
`;

// ── Captura la página sharp ───────────────────────────────────────────────────
function capturePageTexture() {
  const aquaCanvas = document.querySelector("[data-aqua-canvas='true']");
  if (!aquaCanvas) return null;
  const w = window.innerWidth, h = window.innerHeight;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const ctx = off.getContext("2d");
  ctx.drawImage(aquaCanvas, 0, 0, w, h);
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

// ── Captura la página con blur aplicado en canvas ────────────────────────────
function captureBlurredPageTexture() {
  const aquaCanvas = document.querySelector("[data-aqua-canvas='true']");
  if (!aquaCanvas) return null;
  const w = window.innerWidth, h = window.innerHeight;

  const src = document.createElement("canvas");
  src.width = w; src.height = h;
  const sCtx = src.getContext("2d");
  sCtx.drawImage(aquaCanvas, 0, 0, w, h);
  const px = sCtx.getImageData(w >> 1, h >> 1, 1, 1).data;

  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const ctx = off.getContext("2d");

  if (px[0] === 0 && px[1] === 0 && px[2] === 0) {
    const tmp = document.createElement("canvas");
    tmp.width = w; tmp.height = h;
    const tCtx = tmp.getContext("2d");
    const g = tCtx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.7);
    g.addColorStop(0, "#2a2a3a");
    g.addColorStop(1, "#0d0d15");
    tCtx.fillStyle = g; tCtx.fillRect(0, 0, w, h);
    ctx.filter = "blur(20px)";
    ctx.drawImage(tmp, 0, 0, w, h);
  } else {
    ctx.filter = "blur(20px)";
    ctx.drawImage(aquaCanvas, 0, 0, w, h);
  }

  ctx.filter = "none";
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(off);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.userData  = { size: new THREE.Vector2(w, h) };
  return tex;
}

// ── tex transparente — para el closing ───────────────────────────────────────
function createTransparentTexture() {
  const w = window.innerWidth, h = window.innerHeight;
  const data = new Uint8Array([0, 0, 0, 0]);
  const tex  = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.userData    = { size: new THREE.Vector2(w, h) };
  return tex;
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function HeaderFooter11({ children }) {
  const [modalState, setModalState] = useState("closed");

  const h1Ref        = useRef(null);
  const canvasRef    = useRef(null);
  const blurLayerRef = useRef(null);
  const contentRef   = useRef(null);
  const materialRef  = useRef(null);
  const loopIdRef    = useRef(null);
  const animRef      = useRef(false);

  // Texturas precapturadas en hover — evita readback GPU en el momento del click
  const prewarmRef = useRef({ tex1: null, tex2: null, busy: false });

  const words = ["allthatjazz","すべてのジャズ","όλοαυτότζαζ","वह सभी जाज है","allthatjazz"];

  // ── Scramble ──────────────────────────────────────────────────────────────
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

  // ── Three.js ──────────────────────────────────────────────────────────────
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
      vertexShader, fragmentShader, transparent: true,
    });
    materialRef.current = material;
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    const loop = () => { loopIdRef.current = requestAnimationFrame(loop); renderer.render(scene, camera); };
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

  const handleOpen  = useCallback(() => {
    if (modalState !== "closed" || animRef.current) return;
    setModalState("opening");
  }, [modalState]);

  const handleClose = useCallback(() => {
    if (modalState !== "open" || animRef.current) return;
    setModalState("closing");
  }, [modalState]);

  // ── Transiciones ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mat  = materialRef.current;
    const maxR = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);

    // ── OPENING ───────────────────────────────────────────────────────────────
    // Onda invertida: la burbuja parte GRANDE (cubre toda la pantalla) y se
    // contrae hacia el centro — efecto "desde los bordes hacia el centro".
    //
    // Asignación de texturas para progress 1→0:
    //   tex1 = blurred  (visible FUERA de la burbuja = toda la pantalla al inicio)
    //   tex2 = sharp    (visible DENTRO de la burbuja con lens distortion)
    //
    // Al inicio  (progress=1): burbuja ocupa todo → se ve tex2(sharp) con lens ≈ toda la pantalla
    // Al final   (progress=0): burbuja desaparece → se ve tex1(blurred) ≈ fondo del about
    //   El CSS blur toma el relevo en onComplete sin corte visible.
    //
    // El clip-path del contenido crece 0→maxR independientemente (misma dirección
    // de revelado que antes, el about aparece desde el centro).
    if (modalState === "opening") {
      if (animRef.current || !mat) return;
      animRef.current = true;

      // tex1 = blurred (fuera de burbuja), tex2 = sharp (dentro de burbuja)
      // Usar texturas precapturadas en hover si están disponibles — arranque sin retraso
      const pw   = prewarmRef.current;
      const tex1 = pw.tex1 ?? captureBlurredPageTexture();
      const tex2 = pw.tex2 ?? capturePageTexture();
      pw.tex1 = null; pw.tex2 = null; // consumidas
      if (!tex1 || !tex2) { setModalState("open"); animRef.current = false; return; }

      // Blur CSS invisible — tomará el relevo al terminar
      if (blurLayerRef.current) {
        blurLayerRef.current.style.transition = "none";
        blurLayerRef.current.style.opacity    = "0";
        blurLayerRef.current.style.clipPath   = "none";
      }

      // Contenido encima del canvas — clip-path crece 0→maxR
      if (contentRef.current) {
        contentRef.current.style.zIndex   = "1004";
        contentRef.current.style.opacity  = "1";
        contentRef.current.style.clipPath = "circle(0px at 50% 50%)";
        // El texto arranca invisible+blureado — el reveal se lanza en onComplete
        const reveals = contentRef.current.querySelectorAll('[data-reveal]');
        gsap.set(reveals, { filter: 'blur(14px)', opacity: 0 });
      }

      mat.uniforms.uTexture1.value     = tex1;
      mat.uniforms.uTexture2.value     = tex2;
      mat.uniforms.uTexture1Size.value = tex1.userData.size;
      mat.uniforms.uTexture2Size.value = tex2.userData.size;
      // Empezamos en 1 (burbuja grande) y vamos hacia 0 (burbuja desaparece)
      mat.uniforms.uProgress.value     = 1;

      const prog = { v: 1 };

      gsap.to(prog, {
        v: 0,                   // ← invertido respecto al original
        duration: 2.5,
        ease: "power2.inOut",
        onUpdate() {
          mat.uniforms.uProgress.value = prog.v;
          // clip-path del contenido sigue creciendo (0→maxR), independiente del shader
          const r = (1 - prog.v) * maxR * 1.06;
          if (contentRef.current)
            contentRef.current.style.clipPath = `circle(${r}px at 50% 50%)`;
        },
        onComplete() {
          mat.uniforms.uProgress.value = 0;
          tex1.dispose(); tex2.dispose();
          if (blurLayerRef.current) {
            blurLayerRef.current.style.opacity  = "1";
            blurLayerRef.current.style.clipPath = "none";
          }
          if (contentRef.current) {
            contentRef.current.style.zIndex   = "1001";
            contentRef.current.style.clipPath = "none";
          }
          // Lanzar el reveal del texto AHORA que la burbuja ha terminado
          if (contentRef.current) {
            const reveals = contentRef.current.querySelectorAll('[data-reveal]');
            gsap.to(reveals, {
              filter:   'blur(0px)',
              opacity:  1,
              duration: 1.5,
              ease:     'power2.out',
              stagger:  0.18,
            });
          }
          animRef.current = false;
          setModalState("open");
        },
      });
    }

    // ── CLOSING ───────────────────────────────────────────────────────────────
    // Sin cambios — la burbuja crece desde el centro y revela la página.
    // tex1 = transparente  (fuera de burbuja → CSS blur visible debajo)
    // tex2 = página sharp  (dentro de burbuja → se revela con lens distortion)
    if (modalState === "closing") {
      if (animRef.current || !mat) return;
      animRef.current = true;

      const tex1 = createTransparentTexture();
      const tex2 = capturePageTexture();
      if (!tex2) { setModalState("closed"); animRef.current = false; return; }

      if (contentRef.current) contentRef.current.style.clipPath = "none";
      if (blurLayerRef.current) {
        blurLayerRef.current.style.transition = "none";
        blurLayerRef.current.style.opacity    = "1";
        blurLayerRef.current.style.clipPath   = "none";
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
          const r = `circle(${Math.max(0, (1 - prog.v) * maxR * 1.06)}px at 50% 50%)`;
          if (blurLayerRef.current) blurLayerRef.current.style.clipPath = r;
          if (contentRef.current)   contentRef.current.style.clipPath   = r;
        },
        onComplete() {
          mat.uniforms.uProgress.value = 0;
          if (blurLayerRef.current) {
            blurLayerRef.current.style.opacity  = "1";
            blurLayerRef.current.style.clipPath = "circle(0px at 50% 50%)";
          }
          tex1.dispose(); tex2.dispose();
          animRef.current = false;
          setModalState("closed");
        },
      });
    }
  }, [modalState]);

  const isVisible       = modalState !== "closed";
  const showContent     = modalState === "opening" || modalState === "open" || modalState === "closing";
  const isTransitioning = modalState === "opening" || modalState === "closing";

  return (
    <>
      <div className="fixed top-0 left-0 w-full flex justify-center pt-[16px] z-[9999] pointer-events-none">
        <BerlinClock />
      </div>

      <div className="fixed bottom-0 left-0 w-full flex flex-col justify-center items-center pb-2 leading-[2.75rem] z-[9999] HeaderFooter select-none pointer-events-auto">
        <div className="flex" onClick={isVisible ? handleClose : handleOpen} onMouseEnter={() => { if (modalState === "closed" && !animRef.current) { const pw = prewarmRef.current; if (!pw.busy && !pw.tex1) { pw.busy = true; requestAnimationFrame(() => { pw.tex1 = captureBlurredPageTexture(); pw.tex2 = capturePageTexture(); pw.busy = false; }); } } }}>
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

      <div id="main-content" className="w-full h-full">{children}</div>

      {/* Canvas activo en ambas transiciones */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          display: "block", width: "100%", height: "100%",
          zIndex:  isTransitioning ? 1003 : -1,
          opacity: isTransitioning ? 1    : 0,
        }}
      />

      {isVisible && (
        <>
          <div
            ref={blurLayerRef}
            className="fixed inset-0 z-[1000]"
            style={{
              backgroundColor:      "rgba(255, 255, 255, 0.15)",
              backdropFilter:       "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              clipPath:             "none",
              opacity:              0,
              transform:            "translateZ(0)",
              WebkitTransform:      "translateZ(0)",
            }}
          />

          {showContent && (
            <div
              ref={contentRef}
              className="fixed inset-0 z-[1001] overflow-y-auto text-white mix-blend-difference"
              style={{ clipPath: "none" }}
              onClick={handleClose}
            >
              <AboutSection8 skipReveal />
            </div>
          )}
        </>
      )}
    </>
  );
}