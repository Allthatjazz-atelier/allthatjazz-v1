"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Simulación de ondas — ShaderToy wdtyDH
const simFrag = `
  precision highp float;
  uniform sampler2D iChannel0;
  uniform vec2  iResolution;
  uniform vec4  iMouse;
  uniform int   iFrame;
  varying vec2  vUv;

  vec4 fetch(vec2 offset) {
    return texture2D(iChannel0, vUv + offset / iResolution);
  }

  void main() {
    if (iFrame == 0) { gl_FragColor = vec4(0.0); return; }

    float pressure = fetch(vec2( 0, 0)).x;
    float pVel     = fetch(vec2( 0, 0)).y;
    float p_right  = fetch(vec2( 1, 0)).x;
    float p_left   = fetch(vec2(-1, 0)).x;
    float p_up     = fetch(vec2( 0, 1)).x;
    float p_down   = fetch(vec2( 0,-1)).x;

    vec2 ts = 1.0 / iResolution;
    if (vUv.x < ts.x)        p_left  = p_right;
    if (vUv.x > 1.0 - ts.x)  p_right = p_left;
    if (vUv.y < ts.y)         p_down  = p_up;
    if (vUv.y > 1.0 - ts.y)  p_up    = p_down;

    const float delta = 1.0;
    pVel     += delta * (-2.0 * pressure + p_right + p_left) / 4.0;
    pVel     += delta * (-2.0 * pressure + p_up    + p_down) / 4.0;
    pressure += delta * pVel;
    pVel     -= 0.005 * delta * pressure;
    pVel     *= 1.0 - 0.002 * delta;
    pressure *= 0.999;

    if (iMouse.z > 1.0) {
      vec2 mouseUV = vec2(iMouse.x, iResolution.y - iMouse.y) / iResolution;
      float dist   = length((vUv - mouseUV) * iResolution);
      if (dist <= 20.0) pressure += 1.0 - dist / 20.0;
    }

    gl_FragColor = vec4(pressure, pVel,
      (p_right - p_left) / 2.0,
      (p_up    - p_down) / 2.0);
  }
`;

// Display — distorsiona la textura viva del AquaSlider + especular de agua
const displayFrag = `
  precision highp float;
  uniform sampler2D iChannel0; // datos de onda
  uniform sampler2D iChannel1; // frame vivo del AquaSlider
  varying vec2 vUv;

  void main() {
    vec4  data  = texture2D(iChannel0, vUv);
    vec2  grad  = data.zw;

    // Refracción — el gradiente desplaza los UVs del fondo
    vec2  distortUV = vUv + grad * 0.25;
    vec4  bg        = texture2D(iChannel1, distortUV);

    // Especular de superficie de agua
    vec3  normal = normalize(vec3(-grad.x * 2.5, 0.5, -grad.y * 2.5));
    vec3  light  = normalize(vec3(-3.0, 10.0, 3.0));
    float spec   = pow(max(0.0, dot(normal, light)), 60.0) * 1.5;

    gl_FragColor = bg + vec4(vec3(spec), 0.0);
  }
`;

export default function BerlinClock() {
  const [time, setTime]     = useState("");
  const [active, setActive] = useState(false);

  const canvasRef  = useRef(null);
  const glRef      = useRef(null);
  const rafRef     = useRef(null);
  const activeRef  = useRef(false);

  // ── Reloj ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const upd = () => setTime(new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(new Date()));
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, []);

  // ── WebGL ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    activeRef.current = active;
    cancelAnimationFrame(rafRef.current);

    if (glRef.current) {
      try {
        glRef.current.renderer.dispose();
        glRef.current.rtA.dispose();
        glRef.current.rtB.dispose();
        glRef.current.bgTexture?.dispose();
      } catch(e) {}
      glRef.current = null;
    }

    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = window.innerWidth, h = window.innerHeight;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
      renderer.setSize(w, h);
      renderer.setPixelRatio(1);
    } catch(e) { return; }

    const type = renderer.capabilities.isWebGL2
      ? THREE.HalfFloatType : THREE.UnsignedByteType;

    const rtOpts = {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat, type,
    };
    const rtA = new THREE.WebGLRenderTarget(w, h, rtOpts);
    const rtB = new THREE.WebGLRenderTarget(w, h, rtOpts);

    // Canvas offscreen para capturar el AquaSlider cada frame
    const offCanvas = document.createElement("canvas");
    offCanvas.width = w; offCanvas.height = h;
    const bgTexture = new THREE.CanvasTexture(offCanvas);
    bgTexture.minFilter = bgTexture.magFilter = THREE.LinearFilter;

    const geo = new THREE.PlaneGeometry(2, 2);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const simMat = new THREE.ShaderMaterial({
      uniforms: {
        iChannel0:   { value: null },
        iResolution: { value: new THREE.Vector2(w, h) },
        iMouse:      { value: new THREE.Vector4(0, 0, 0, 0) },
        iFrame:      { value: 0 },
      },
      vertexShader, fragmentShader: simFrag,
    });

    const dispMat = new THREE.ShaderMaterial({
      uniforms: {
        iChannel0: { value: null },
        iChannel1: { value: bgTexture },
      },
      vertexShader, fragmentShader: displayFrag,
      transparent: false,
    });

    const simScene  = new THREE.Scene();
    const dispScene = new THREE.Scene();
    simScene.add(new THREE.Mesh(geo, simMat));
    dispScene.add(new THREE.Mesh(geo, dispMat));

    const mouse    = new THREE.Vector4(0, 0, 0, 0);
    const pressing = { v: false };

    const onMove = (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (pressing.v) { mouse.z = e.clientX; mouse.w = e.clientY; }
    };
    const onDown = (e) => {
      pressing.v = true;
      mouse.z = e.clientX; mouse.w = e.clientY;
    };
    const onUp = () => { pressing.v = false; mouse.z = 0; mouse.w = 0; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup",   onUp);

    glRef.current = {
      renderer, simMat, dispMat, simScene, dispScene, cam,
      rtA, rtB, bgTexture, offCanvas, frame: 0, mouse,
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const g = glRef.current;
      if (!g || !activeRef.current) return;

      // Captura el AquaSlider vivo cada frame → textura viva
      const aquaCanvas = document.querySelector("[data-aqua-canvas='true']");
      if (aquaCanvas) {
        const ctx = g.offCanvas.getContext("2d");
        ctx.drawImage(aquaCanvas, 0, 0, w, h);
        g.bgTexture.needsUpdate = true; // re-sube a GPU cada frame
      }

      const read  = g.frame % 2 === 0 ? g.rtA : g.rtB;
      const write = g.frame % 2 === 0 ? g.rtB : g.rtA;

      try {
        // Sim pass
        g.simMat.uniforms.iChannel0.value = read.texture;
        g.simMat.uniforms.iFrame.value    = g.frame;
        g.simMat.uniforms.iMouse.value.copy(mouse);
        g.renderer.setRenderTarget(write);
        g.renderer.render(g.simScene, g.cam);

        // Display pass
        g.dispMat.uniforms.iChannel0.value = write.texture;
        g.renderer.setRenderTarget(null);
        g.renderer.render(g.dispScene, g.cam);
      } catch(e) {
        cancelAnimationFrame(rafRef.current);
        return;
      }

      g.frame++;
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup",   onUp);
      try {
        renderer.dispose(); rtA.dispose(); rtB.dispose(); bgTexture.dispose();
      } catch(e) {}
    };
  }, [active]);

  return (
    <>
      {/* Cuando activo: canvas encima del contenido (z-9998) pintando la versión distorsionada */}
      {/* BerlinClock en z-9999 — siempre visible para poder desactivar                       */}
      <canvas
        ref={canvasRef}
        style={{
          position:      "fixed",
          inset:         0,
          width:         "100%",
          height:        "100%",
          // z-900: encima del contenido, debajo del modal about (z-1000+)
          zIndex:        active ? 900 : -1,
          pointerEvents: "none",
          display:       "block",
          opacity:       active ? 1 : 0,
          transition:    "opacity 0.4s ease",
          // Excluye header (top 60px) y footer (bottom 80px)
          // — BerlinClock, allthatjazz y Atelier siempre sobre fondo original
          clipPath:      "inset(60px 0px 80px 0px)",
        }}
      />

      <div className="flex items-center gap-1 text-[0.875rem] text-black tabular-nums">
        <span>Berlin, {time}</span>
        <img
          src="/avatar/✦.svg"
          alt="avatar"
          onClick={() => setActive(v => !v)}
          className="w-[14px] h-[14px] pointer-events-auto transition-transform duration-700 ease-in-out hover:rotate-[360deg] cursor-pointer"
          style={{
            transformOrigin: "center",
            opacity:    active ? 1 : 0.5,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    </>
  );
}