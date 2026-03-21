"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import gsap from "gsap";
import BerlinClock from "../tools/BerlinClock";
import AboutSection7 from "../about/index7";
import BerlinClock3 from "../tools/BerlinClock3";
import BerlinClock2 from "../tools/BerlinClock2";
import BerlinClock4 from "../tools/BerlinClock4";
import BerlinClock5 from "../tools/BerlinClock5";

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

function capturePageTexture() {
  const aquaCanvas = document.querySelector("[data-aqua-canvas='true']");
  if (!aquaCanvas) return null;
  const w = window.innerWidth, h = window.innerHeight;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const ctx = off.getContext("2d");
  ctx.drawImage(aquaCanvas, 0, 0, w, h);
  const px = ctx.getImageData(w >> 1, h >> 1, 1, 1).data;
  if (px[3] < 10) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
  const tex = new THREE.CanvasTexture(off);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.userData  = { size: new THREE.Vector2(w, h) };
  return tex;
}

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
  if (px[3] < 10) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.filter = "blur(20px)"; ctx.fillRect(0, 0, w, h); ctx.filter = "none";
  } else {
    ctx.filter = "blur(20px)"; ctx.drawImage(aquaCanvas, 0, 0, w, h); ctx.filter = "none";
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(off);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.userData  = { size: new THREE.Vector2(w, h) };
  return tex;
}

function createTransparentTexture() {
  const w = window.innerWidth, h = window.innerHeight;
  const data = new Uint8Array([0, 0, 0, 0]);
  const tex  = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.userData    = { size: new THREE.Vector2(w, h) };
  return tex;
}

export default function HeaderFooter13({ children }) {
  const [modalState, setModalState] = useState("closed");

  const h1Ref        = useRef(null);
  const canvasRef    = useRef(null);
  const blurLayerRef = useRef(null);
  const contentRef   = useRef(null);
  const materialRef  = useRef(null);
  const loopIdRef    = useRef(null);
  const animRef      = useRef(false);
  const breathRef    = useRef(null);
  const hoveredRef   = useRef(false);
  const svgStateRef  = useRef({ scale: 0, blur: 0, glow: 0, freq: 0.008 });
  const mainTweenRef = useRef(null);
  const mobileTimerRef = useRef(null);
  // Flag para saber si pulseMobile está corriendo — applyHover(false) lo respeta
  const mobileActiveRef = useRef(false);

  // ── Helper SVG update ────────────────────────────────────────────────────
  const getSvgEls = () => ({
    turb: document.getElementById("atj-turb"),
    disp: document.getElementById("atj-disp"),
    blur: document.getElementById("atj-blur"),
    glow: document.getElementById("atj-glow"),
    el:   h1Ref.current,
  });

  const makeUpdate = (els, s) => () => {
    els.disp.setAttribute("scale",         s.scale.toFixed(3));
    els.blur.setAttribute("stdDeviation",  s.blur.toFixed(3));
    els.glow.setAttribute("stdDeviation",  s.glow.toFixed(3));
    els.turb.setAttribute("baseFrequency", `${s.freq.toFixed(4)} ${(s.freq * 1.6).toFixed(4)}`);
  };

  // ── Desktop hover ────────────────────────────────────────────────────────
  const applyHover = useCallback((on) => {
    if (animRef.current) return;
    // En móvil con pulso activo, no interferir
    if (mobileActiveRef.current) return;

    hoveredRef.current = on;
    const els = getSvgEls();
    if (!els.turb || !els.disp || !els.blur || !els.glow || !els.el) return;

    if (mainTweenRef.current) { mainTweenRef.current.kill(); mainTweenRef.current = null; }
    if (breathRef.current)    { breathRef.current.kill();    breathRef.current    = null; }

    const s = svgStateRef.current;
    const update = makeUpdate(els, s);

    if (on) {
      els.el.style.filter = "url(#atj-filter)";
      mainTweenRef.current = gsap.to(s, {
        scale: 9, blur: 0.45, glow: 3.5, freq: 0.012,
        duration: 1.1, ease: "sine.out",
        onUpdate: update,
        onComplete() {
          if (!hoveredRef.current) return;
          breathRef.current = gsap.to(s, {
            scale: 7, glow: 2, freq: 0.008,
            duration: 2.8, ease: "sine.inOut",
            yoyo: true, repeat: -1,
            onUpdate: update,
          });
        },
      });
    } else {
      mainTweenRef.current = gsap.to(s, {
        scale: 0, blur: 0, glow: 0, freq: 0.008,
        duration: 0.5, ease: "sine.inOut",
        onUpdate: update,
        onComplete() {
          if (hoveredRef.current) return;
          els.el.style.filter = "none";
          s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
          update();
        },
      });
    }
  }, []);

  // ── Móvil: pulso de 3s — independiente del modal ─────────────────────────
  const pulseMobile = useCallback(() => {
    const els = getSvgEls();
    if (!els.turb || !els.disp || !els.blur || !els.glow || !els.el) return;

    // Reiniciar timer si ya había uno — cada toque reinicia los 3s
    if (mobileTimerRef.current) clearTimeout(mobileTimerRef.current);
    if (mainTweenRef.current)   { mainTweenRef.current.kill(); mainTweenRef.current = null; }
    if (breathRef.current)      { breathRef.current.kill();    breathRef.current    = null; }

    mobileActiveRef.current = true;

    const s = svgStateRef.current;
    s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
    els.el.style.filter = "url(#atj-filter)";

    const update = makeUpdate(els, s);

    // Entrada
    mainTweenRef.current = gsap.to(s, {
      scale: 10, blur: 0.5, glow: 4, freq: 0.013,
      duration: 0.9, ease: "sine.out",
      onUpdate: update,
      onComplete() {
        // Respiración continua mientras dura el timer
        breathRef.current = gsap.to(s, {
          scale: 6, glow: 2, freq: 0.009,
          duration: 1.2, ease: "sine.inOut",
          yoyo: true, repeat: -1,
          onUpdate: update,
        });
      },
    });

    // Salida después de 3s
    mobileTimerRef.current = setTimeout(() => {
      if (breathRef.current)  { breathRef.current.kill();  breathRef.current  = null; }
      if (mainTweenRef.current) { mainTweenRef.current.kill(); mainTweenRef.current = null; }
      gsap.to(s, {
        scale: 0, blur: 0, glow: 0, freq: 0.008,
        duration: 0.7, ease: "sine.inOut",
        onUpdate: update,
        onComplete() {
          els.el.style.filter = "none";
          s.scale = 0; s.blur = 0; s.glow = 0; s.freq = 0.008;
          update();
          mobileActiveRef.current = false;
        },
      });
    }, 3000);
  }, []);

  // ── Visibilidad ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) applyHover(false); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [applyHover]);

  // ── Scramble ──────────────────────────────────────────────────────────────
  const words = ["allthatjazz","すべてのジャズ","όλοαυτότζαζ","वह सभी जाज है","allthatjazz"];
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
        uTexture1:     { value: null }, uTexture2:     { value: null },
        uProgress:     { value: 0 },   uResolution:   { value: new THREE.Vector2(w, h) },
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
    return () => { cancelAnimationFrame(loopIdRef.current); window.removeEventListener("resize", onResize); renderer.dispose(); };
  }, []);

  // ── Handlers modal — NO llaman applyHover(false) para no interferir con móvil
  const handleOpen  = useCallback(() => {
    if (modalState !== "closed" || animRef.current) return;
    // Solo limpiar hover en desktop (móvil usa mobileActiveRef para protegerse)
    if (!mobileActiveRef.current) applyHover(false);
    setModalState("opening");
  }, [modalState, applyHover]);

  const handleClose = useCallback(() => {
    if (modalState !== "open" || animRef.current) return;
    if (!mobileActiveRef.current) applyHover(false);
    setModalState("closing");
  }, [modalState, applyHover]);

  // ── Transiciones ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mat  = materialRef.current;
    const maxR = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);

    if (modalState === "opening") {
      if (animRef.current || !mat) return;
      animRef.current = true;
      const tex1 = captureBlurredPageTexture();
      const tex2 = capturePageTexture();
      if (!tex1 || !tex2) { setModalState("open"); animRef.current = false; return; }
      if (blurLayerRef.current) {
        blurLayerRef.current.style.transition = "none";
        blurLayerRef.current.style.opacity    = "0";
        blurLayerRef.current.style.clipPath   = "none";
      }
      if (contentRef.current) {
        contentRef.current.style.zIndex   = "1004";
        contentRef.current.style.opacity  = "1";
        contentRef.current.style.clipPath = "circle(0px at 50% 50%)";
        gsap.set(contentRef.current.querySelectorAll('[data-reveal]'), { filter: 'blur(14px)', opacity: 0 });
      }
      mat.uniforms.uTexture1.value     = tex1;
      mat.uniforms.uTexture2.value     = tex2;
      mat.uniforms.uTexture1Size.value = tex1.userData.size;
      mat.uniforms.uTexture2Size.value = tex2.userData.size;
      mat.uniforms.uProgress.value     = 0.667;
      const prog = { v: 0.667 };
      gsap.to(prog, {
        v: 0, duration: 2.0, ease: "power2.out",
        onUpdate() {
          mat.uniforms.uProgress.value = prog.v;
          const r = ((0.667 - prog.v) / 0.667) * maxR * 1.06;
          if (contentRef.current) contentRef.current.style.clipPath = `circle(${r}px at 50% 50%)`;
          const blurOpacity = Math.max(0, (0.667 - prog.v) / 0.667);
          if (blurLayerRef.current) blurLayerRef.current.style.opacity = String(blurOpacity.toFixed(3));
        },
        onComplete() {
          mat.uniforms.uProgress.value = 0;
          tex1.dispose(); tex2.dispose();
          if (blurLayerRef.current) {
            blurLayerRef.current.style.transition = "none";
            blurLayerRef.current.style.opacity    = "1";
            blurLayerRef.current.style.clipPath   = "none";
          }
          if (contentRef.current) {
            contentRef.current.style.zIndex   = "1001";
            contentRef.current.style.clipPath = "none";
            gsap.to(contentRef.current.querySelectorAll('[data-reveal]'), {
              filter: 'blur(0px)', opacity: 1, duration: 1.5, ease: 'power2.out', stagger: 0.18,
            });
          }
          animRef.current = false;
          setModalState("open");
        },
      });
    }

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
        v: 1, duration: 2.5, ease: "power2.inOut",
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

        <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }}>
          <defs>
            <filter id="atj-filter" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence id="atj-turb" type="fractalNoise" baseFrequency="0.008 0.013" numOctaves="2" seed="4" result="noise" />
              <feDisplacementMap id="atj-disp" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur id="atj-blur" in="displaced" stdDeviation="0" result="blurred" />
              <feGaussianBlur id="atj-glow" in="displaced" stdDeviation="0" result="glow-raw" />
              <feColorMatrix id="atj-glow-matrix" in="glow-raw" type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -3" result="glow-boosted" />
              <feMerge result="final">
                <feMergeNode in="glow-boosted" />
                <feMergeNode in="blurred" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        <div className="flex">
          <h1
            ref={h1Ref}
            className="text-[4rem] tracking-[-0.04em] text-black select-none whitespace-nowrap cursor-pointer"
            onMouseEnter={() => applyHover(true)}
            onMouseLeave={() => applyHover(false)}
            onClick={() => {
              const isTouch = window.matchMedia("(pointer: coarse)").matches;
              if (isTouch) {
                // Móvil: siempre lanzar pulso — independiente del modal
                pulseMobile();
              } else {
                // Desktop: limpiar hover
                applyHover(false);
              }
              // Abrir/cerrar modal en ambos casos
              (isVisible ? handleClose : handleOpen)();
            }}
          >
            allthatjazz
          </h1>
        </div>

        <p className="flex text-[1.35rem] text-black MyFont2 tracking-[-0.05em] pointer-none">
          Atelier de création graphique et digitale.
        </p>
      </div>

      <div id="main-content" className="w-full h-full">{children}</div>

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
              <AboutSection7 skipReveal />
            </div>
          )}
        </>
      )}
    </>
  );
}