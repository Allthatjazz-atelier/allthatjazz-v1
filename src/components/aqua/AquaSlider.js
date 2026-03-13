"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import gsap from "gsap";

// ─── Image sources (colócalas en /public/story/) ─────────────────────────────
const IMAGES = [
  "/story/story1.png",
  "/story/story2.png",
  "/story/story3.png",
  "/story/story4.png",
];

// ─── Vertex shader ────────────────────────────────────────────────────────────
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Fragment shader — burbuja con distorsión de lente (del tutorial) ─────────
const fragmentShader = `
  uniform sampler2D uTexture1;
  uniform sampler2D uTexture2;
  uniform float uProgress;
  uniform vec2 uResolution;
  uniform vec2 uTexture1Size;
  uniform vec2 uTexture2Size;
  varying vec2 vUv;

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
    vec2 p,
    vec2 uv,
    vec2 sphereCenter,
    float sphereRadius,
    float focusFactor
  ) {
    vec2 distortionDirection = normalize(p - sphereCenter);
    float focusRadius = sphereRadius * focusFactor;
    float focusStrength = sphereRadius / 3000.0;
    float focusSdf = length(sphereCenter - p) - focusRadius;
    float sphereSdf = length(sphereCenter - p) - sphereRadius;
    float inside = smoothstep(0.0, 1.0, -sphereSdf / (sphereRadius * 0.001));

    float magnifierFactor = focusSdf / (sphereRadius - focusRadius);
    float mFactor = clamp(magnifierFactor * inside, 0.0, 1.0);
    mFactor = pow(mFactor, 5.0);

    float distortionFactor = mFactor * focusStrength;

    vec2 distortedUV = getDistortedUv(uv, distortionDirection, distortionFactor);

    return LensDistortion(distortedUV, inside);
  }

  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 p = vUv * uResolution;

    vec2 uv1 = getCoverUV(vUv, uTexture1Size);
    vec2 uv2 = getCoverUV(vUv, uTexture2Size);

    float maxRadius = length(uResolution) * 1.5;
    float bubbleRadius = uProgress * maxRadius;
    vec2 sphereCenter = center * uResolution;
    float focusFactor = 0.25;

    float dist = length(sphereCenter - p);
    float mask = step(bubbleRadius, dist);

    vec4 currentImg = texture2D(uTexture1, uv1);

    LensDistortion distortion = getLensDistortion(
      p, uv2, sphereCenter, bubbleRadius, focusFactor
    );

    vec4 newImg = texture2D(uTexture2, distortion.distortedUV);

    float finalMask = max(mask, 1.0 - distortion.inside);
    vec4 color = mix(newImg, currentImg, finalMask);

    gl_FragColor = color;
  }
`;

// ─── Componente ───────────────────────────────────────────────────────────────
export default function AquaSlider() {
  const canvasRef = useRef(null);

  // Toda la lógica mutable vive en una ref para no provocar re-renders
  const state = useRef({
    currentIndex: 0,
    isTransitioning: false,
    textures: [],
    material: null,
    renderer: null,
  });

  // ── Setup Three.js ──────────────────────────────────────────────────────
  useEffect(() => {
    const s      = state.current;
    const canvas = canvasRef.current;

    const scene  = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    s.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    s.renderer.setSize(window.innerWidth, window.innerHeight);
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    s.material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture1:    { value: null },
        uTexture2:    { value: null },
        uProgress:    { value: 0.0 },
        uResolution:  { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uTexture1Size:{ value: new THREE.Vector2(1, 1) },
        uTexture2Size:{ value: new THREE.Vector2(1, 1) },
      },
      vertexShader,
      fragmentShader,
    });

    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), s.material));

    // ── Carga de texturas ─────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();
    Promise.all(
      IMAGES.map(
        (src) =>
          new Promise((resolve) =>
            loader.load(src, (tex) => {
              tex.minFilter = tex.magFilter = THREE.LinearFilter;
              tex.userData  = {
                size: new THREE.Vector2(tex.image.width, tex.image.height),
              };
              resolve(tex);
            })
          )
      )
    ).then((textures) => {
      s.textures = textures;
      s.material.uniforms.uTexture1.value     = textures[0];
      s.material.uniforms.uTexture2.value     = textures[1];
      s.material.uniforms.uTexture1Size.value = textures[0].userData.size;
      s.material.uniforms.uTexture2Size.value = textures[1].userData.size;
    });

    // ── Render loop ────────────────────────────────────────────────────────
    let animId;
    const render = () => {
      animId = requestAnimationFrame(render);
      s.renderer.render(scene, camera);
    };
    render();

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      s.renderer.setSize(window.innerWidth, window.innerHeight);
      s.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      s.renderer.dispose();
    };
  }, []);

  // ── Transición al siguiente slide ───────────────────────────────────────
  const handleClick = useCallback(() => {
    const s = state.current;
    if (s.isTransitioning || s.textures.length === 0) return;

    s.isTransitioning       = true;
    const nextIndex         = (s.currentIndex + 1) % IMAGES.length;

    // Asigna texturas actuales al shader
    s.material.uniforms.uTexture1.value     = s.textures[s.currentIndex];
    s.material.uniforms.uTexture2.value     = s.textures[nextIndex];
    s.material.uniforms.uTexture1Size.value = s.textures[s.currentIndex].userData.size;
    s.material.uniforms.uTexture2Size.value = s.textures[nextIndex].userData.size;

    // Anima uProgress de 0 → 1
    gsap.fromTo(
      s.material.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration: 2.5,
        ease: "power2.inOut",
        onComplete: () => {
          // Resetea: la textura de destino se convierte en la nueva "actual"
          s.material.uniforms.uProgress.value    = 0;
          s.material.uniforms.uTexture1.value     = s.textures[nextIndex];
          s.material.uniforms.uTexture1Size.value = s.textures[nextIndex].userData.size;
          s.currentIndex      = nextIndex;
          s.isTransitioning   = false;
        },
      }
    );
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-screen h-screen overflow-hidden cursor-pointer select-none"
      onClick={handleClick}
    >
      {/* Canvas WebGL — ocupa todo el contenedor */}
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Indicador de navegación */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {IMAGES.map((_, i) => (
          <span
            key={i}
            className={`block w-1.5 h-1.5 rounded-full transition-all duration-500 ${
              i === 0
                ? "bg-white scale-125"
                : "bg-white/40"
            }`}
          />
        ))}
      </div>

      {/* Hint click */}
      <p className="absolute bottom-8 right-8 z-10 text-white/40 text-xs tracking-[0.25em] uppercase font-light">
        tap to advance
      </p>
    </div>
  );
}