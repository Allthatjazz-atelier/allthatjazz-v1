'use client';

import { useEffect, useRef, useState } from 'react';

// ── VERT — sin cambios ────────────────────────────────────────────────────────
const VERT = /* glsl */ `
  varying vec2  vUv;
  varying float vViewDepth;
  uniform float uDistort;

  void main() {
    vUv = uv;
    vec3 p = position;
    p.x += sin(uv.y * 3.14159265) * uDistort * 0.09;
    vec4 mvPos  = modelViewMatrix * vec4(p, 1.0);
    vViewDepth  = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`;

// ── FRAG — depthFade eliminado, imágenes siempre a full opacity ───────────────
const FRAG = /* glsl */ `
  varying vec2  vUv;
  varying float vViewDepth;
  uniform sampler2D uTex;
  uniform float     uDistort;

  void main() {
    float ab = uDistort * 0.008;
    float r  = texture2D(uTex, vUv + vec2( ab, 0.0)).r;
    float g  = texture2D(uTex, vUv                 ).g;
    float b  = texture2D(uTex, vUv - vec2( ab, 0.0)).b;
    float a  = texture2D(uTex, vUv                 ).a;

    vec2  vig      = vUv - 0.5;
    float vignette = 1.0 - smoothstep(0.22, 0.70, length(vig) * 1.5);
    vec3  col      = vec3(r, g, b) * (0.60 + vignette * 0.40);

    // depthFade eliminado — todas las imágenes visibles al 100%
    gl_FragColor = vec4(col, a);
  }
`;

const DEFAULT_IMAGES = Array.from({ length: 15 }, (_, i) => `/story/story${i + 1}.png`);
const DEFAULT_VIDEOS = [
  '/motion/Allthatjazz cinematic©Feb26.mp4',
  '/motion/ATJ About Cuaderno.mp4',
  '/motion/ATJ_AboutMotion 02.mp4',
  '/motion/JC_Reel 4_5_1.mp4',
  '/motion/motionatj.mp4',
  '/motion/Playground_Carhartt-WIP_24012026 (1)_1.mp4',
  '/motion/Portfolio-Gallery-4-5.mp4',
  '/motion/promojohnny.mp4',
];

function buildMediaList(images, videos, totalSlots) {
  const pool = [];
  const step = Math.max(1, Math.floor(totalSlots / (videos.length || 1)));
  let vi = 0, ii = 0;
  for (let i = 0; i < totalSlots; i++) {
    if (vi < videos.length && i % step === Math.floor(step / 2)) {
      pool.push({ url: videos[vi++], type: 'video' });
    } else {
      pool.push({ url: images[ii++ % images.length], type: 'image' });
    }
  }
  return pool;
}

// ── Knob SVG — potenciómetro draggable ───────────────────────────────────────
function Knob({ value, min, max, onChange }) {
  const dragging = useRef(false);
  const lastY    = useRef(0);

  const START_DEG = 220, END_DEG = 500;
  const t   = (value - min) / (max - min);
  const deg = START_DEG + t * (END_DEG - START_DEG);
  const R_  = 27;

  const toRad = d => d * Math.PI / 180;
  const px = (r, d) => 36 + r * Math.cos(toRad(d));
  const py = (r, d) => 36 + r * Math.sin(toRad(d));

  const sx = px(R_, START_DEG), sy = py(R_, START_DEG);
  const ex = px(R_, deg),       ey = py(R_, deg);
  const large = (deg - START_DEG) > 180 ? 1 : 0;
  const arcD = `M ${sx} ${sy} A ${R_} ${R_} 0 ${large} 1 ${ex} ${ey}`;

  useEffect(() => {
    const onMove = e => {
      if (!dragging.current) return;
      const y = e.clientY ?? e.touches?.[0].clientY;
      const dy = lastY.current - y;
      lastY.current = y;
      onChange(prev => Math.min(max, Math.max(min, prev + dy * (max - min) / 120)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [min, max, onChange]);

  const onDown = e => {
    dragging.current = true;
    lastY.current = e.clientY ?? e.touches?.[0].clientY;
    e.preventDefault();
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 4, userSelect: 'none',
    }}>
      <svg
        width={72} height={72} viewBox="0 0 72 72"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onMouseDown={onDown}
        onTouchStart={onDown}
      >
        {/* anillo exterior */}
        <circle cx={36} cy={36} r={30}
          fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.12)" strokeWidth={0.5} />
        {/* cara del knob */}
        <circle cx={36} cy={36} r={24}
          fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.08)" strokeWidth={0.5} />
        {/* arco de progreso */}
        <path d={arcD} fill="none" stroke="rgba(0,0,0,0.55)"
          strokeWidth={2.5} strokeLinecap="round" />
        {/* aguja */}
        <line x1={36} y1={36}
          x2={px(18, deg)} y2={py(18, deg)}
          stroke="rgba(0,0,0,0.75)" strokeWidth={1.8} strokeLinecap="round" />
      </svg>
      <span style={{
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '0.55rem', letterSpacing: '0.1em',
        color: 'rgba(0,0,0,0.30)',
      }}>
        R {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function RingSlider2({
  images      = DEFAULT_IMAGES,
  videos      = DEFAULT_VIDEOS,
  r           = 1.65,
  cols        = 8,
  rows        = 3,
  cameraZ     = 13,
  tilt        = 0.28,
  friction    = 0.91,
  sensitivity = 0.0009,
}) {
  const canvasRef   = useRef(null);
  const counterRef  = useRef(null);
  const progressRef = useRef(null);
  const hintRef     = useRef(null);

  // R se guarda en un ref para que el render loop lo lea sin re-montar
  const [R, setR]   = useState(3.8);   // ← añadir useState al import
  const Rref        = useRef(R);
  useEffect(() => { Rref.current = R; }, [R]);

  // Ref para las posiciones de los planos (se actualizan cuando R cambia)
  const planesRef = useRef([]);
  const groupRef  = useRef(null);

  useEffect(() => {
    const totalSlots = cols * rows;
    const media      = buildMediaList(images, videos, totalSlots);
    const N          = images.length;
    let raf;

    const boot = async () => {
      const T        = await import('three');
      const { gsap } = await import('gsap');

      const renderer = new T.WebGLRenderer({
        canvas: canvasRef.current, antialias: true, alpha: true,
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.setClearColor(0x000000, 0);

      const scene  = new T.Scene();
      const camera = new T.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
      camera.position.set(0, 1.2, cameraZ);
      camera.lookAt(0, 0, 0);

      const group = new T.Group();
      group.rotation.x = tilt;
      groupRef.current = group;
      scene.add(group);

      const loader   = new T.TextureLoader();
      const planes   = [];
      const videoEls = [];

      // Guardamos phi y theta de cada slot para recalcular posición cuando R cambia
      const slotAngles = [];
      const PHI_SPREAD = 0.72;

      media.forEach(({ url, type }, idx) => {
        const col = Math.floor(idx / rows);
        const row = idx % rows;

        const theta = (col / cols) * Math.PI * 2;
        const phi   = ((row / (rows - 1)) - 0.5) * Math.PI * PHI_SPREAD;
        slotAngles.push({ theta, phi });

        const curR = Rref.current;
        const px = (curR + r * Math.cos(phi)) * Math.cos(theta);
        const py =         r * Math.sin(phi);
        const pz = (curR + r * Math.cos(phi)) * Math.sin(theta);
        const nx = Math.cos(phi) * Math.cos(theta);
        const ny = Math.sin(phi);
        const nz = Math.cos(phi) * Math.sin(theta);

        const uniforms = {
          uTex:     { value: new T.Texture() },
          uDistort: { value: 0 },
        };
        const mat = new T.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG,
          uniforms, transparent: true, side: T.DoubleSide,
        });
        const geo  = new T.PlaneGeometry(1.38, 1.90, 24, 24);
        const mesh = new T.Mesh(geo, mat);
        mesh.position.set(px, py, pz);
        mesh.lookAt(new T.Vector3(px + nx, py + ny, pz + nz));
        group.add(mesh);
        planes.push({ mesh, uniforms });
        planesRef.current = planes;

        if (type === 'video') {
          const vid = document.createElement('video');
          vid.src = url; vid.crossOrigin = 'anonymous';
          vid.loop = true; vid.muted = true;
          vid.playsInline = true; vid.autoplay = true;
          vid.style.display = 'none';
          document.body.appendChild(vid);
          const tex = new T.VideoTexture(vid);
          tex.colorSpace = T.SRGBColorSpace;
          uniforms.uTex.value = tex;
          videoEls.push(vid);
          vid.play().catch(() => {});
        } else {
          loader.load(url, tex => {
            tex.colorSpace = T.SRGBColorSpace;
            uniforms.uTex.value = tex;
          });
        }

        // Función para reubicar todos los planos cuando R cambia
        // Se llama desde el render loop
        mesh.userData = { theta, phi };
      });

      // ── Física ────────────────────────────────────────────────────────────
      let velocity = 0;
      const anim   = { distort: 0, sx: 1 };
      let hintDone = false, inertiaT;

      const applyDelta = delta => {
        if (!hintDone && hintRef.current) {
          gsap.to(hintRef.current, { opacity: 0, duration: 0.5, ease: 'power2.out' });
          hintDone = true;
        }
        velocity += delta * sensitivity;
        const speed = Math.abs(delta);
        gsap.to(anim, {
          distort: Math.min(speed / 160, 2.4),
          sx:      1 + Math.min(speed / 4600, 0.13),
          duration: 0.45, ease: 'power2.out', overwrite: true,
        });
        clearTimeout(inertiaT);
        inertiaT = setTimeout(() => {
          gsap.to(anim, { distort: 0, sx: 1, duration: 1.1, ease: 'power3.out' });
        }, 140);
      };

      // ── Tilt drag ──────────────────────────────────────────────────────────
      const drag = { active: false, startY: 0, startTilt: tilt, currentTilt: tilt };
      const TILT_MIN = -0.6, TILT_MAX = 1.1;

      const onMouseDown = e => {
        drag.active = true; drag.startY = e.clientY;
        drag.startTilt = drag.currentTilt;
        canvasRef.current.style.cursor = 'grabbing';
      };
      const onMouseMove = e => {
        if (!drag.active) return;
        const dy = e.clientY - drag.startY;
        drag.currentTilt = Math.min(TILT_MAX, Math.max(TILT_MIN, drag.startTilt + dy / 300));
      };
      const onMouseUp = () => { drag.active = false; canvasRef.current.style.cursor = 'grab'; };

      let lastTX = null, lastTY = null;
      const onTouchStart = e => { lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY; drag.startTilt = drag.currentTilt; };
      const onTouchMove  = e => {
        e.preventDefault();
        if (lastTX === null) return;
        const dx = lastTX - e.touches[0].clientX;
        const dy = lastTY - e.touches[0].clientY;
        lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY;
        if (Math.abs(dx) >= Math.abs(dy)) applyDelta(dx * 2.6);
        else drag.currentTilt = Math.min(TILT_MAX, Math.max(TILT_MIN, drag.currentTilt + dy / 300));
      };
      const onTouchEnd = () => { lastTX = null; lastTY = null; };
      const onWheel    = e => { e.preventDefault(); applyDelta(e.deltaY); };
      const onKey      = e => {
        if (['ArrowRight','ArrowDown'].includes(e.key)) { e.preventDefault(); applyDelta(200); }
        if (['ArrowLeft','ArrowUp'].includes(e.key))   { e.preventDefault(); applyDelta(-200); }
      };

      const cv = canvasRef.current;
      cv.addEventListener('wheel',      onWheel,      { passive: false });
      cv.addEventListener('touchstart', onTouchStart, { passive: true  });
      cv.addEventListener('touchmove',  onTouchMove,  { passive: false });
      cv.addEventListener('touchend',   onTouchEnd);
      cv.addEventListener('mousedown',  onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup',   onMouseUp);
      window.addEventListener('keydown',   onKey);

      const onResize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      };
      window.addEventListener('resize', onResize);

      // ── Render loop ────────────────────────────────────────────────────────
      const wp = new T.Vector3();
      let totalRY = 0;
      let lastR   = Rref.current;

      const tick = t => {
        raf = requestAnimationFrame(tick);

        totalRY  += velocity;
        velocity *= friction;

        const idleAmp    = Math.max(0, 1 - Math.abs(velocity) * 80);
        const idleWobble = Math.sin(t * 0.00022) * 0.003 * idleAmp;
        group.rotation.y = totalRY + idleWobble;
        group.rotation.x += (drag.currentTilt - group.rotation.x) * 0.08;
        group.scale.set(anim.sx, 1, 1);

        // ── Reubicar planos si R cambió ──────────────────────────────────
        const curR = Rref.current;
        if (Math.abs(curR - lastR) > 0.001) {
          planes.forEach(({ mesh }) => {
            const { theta, phi } = mesh.userData;
            const px = (curR + r * Math.cos(phi)) * Math.cos(theta);
            const py =          r * Math.sin(phi);
            const pz = (curR + r * Math.cos(phi)) * Math.sin(theta);
            const nx = Math.cos(phi) * Math.cos(theta);
            const ny = Math.sin(phi);
            const nz = Math.cos(phi) * Math.sin(theta);
            mesh.position.set(px, py, pz);
            mesh.lookAt(group.localToWorld(new T.Vector3(px + nx, py + ny, pz + nz)));
          });
          lastR = curR;
        }

        planes.forEach(({ uniforms }) => (uniforms.uDistort.value = anim.distort));

        let maxZ = -Infinity, frontIdx = 0;
        planes.forEach(({ mesh }, i) => {
          mesh.getWorldPosition(wp);
          if (wp.z > maxZ) { maxZ = wp.z; frontIdx = i; }
        });
        const imgI = frontIdx % N;
        if (counterRef.current)
          counterRef.current.textContent = `${String(imgI + 1).padStart(2,'0')} — ${String(N).padStart(2,'0')}`;
        if (progressRef.current)
          progressRef.current.style.transform = `scaleX(${(imgI + 1) / N})`;

        renderer.render(scene, camera);
      };
      tick(0);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(inertiaT);
        cv.removeEventListener('wheel',      onWheel);
        cv.removeEventListener('touchstart', onTouchStart);
        cv.removeEventListener('touchmove',  onTouchMove);
        cv.removeEventListener('touchend',   onTouchEnd);
        cv.removeEventListener('mousedown',  onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup',   onMouseUp);
        window.removeEventListener('keydown',   onKey);
        window.removeEventListener('resize',    onResize);
        planes.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); });
        videoEls.forEach(v => { v.pause(); v.remove(); });
        renderer.dispose();
      };
    };

    let destroyFn;
    boot().then(fn => { destroyFn = fn; });
    return () => destroyFn?.();
  }, [images, videos, r, cols, rows, cameraZ, tilt, friction, sensitivity]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ffffff', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef} tabIndex={0}
        style={{ display: 'block', width: '100%', height: '100%', outline: 'none', cursor: 'grab' }}
      />

      {/* Hint */}
      <p ref={hintRef} style={{
        position: 'absolute', bottom: '3.6rem', left: '50%',
        transform: 'translateX(-50%)', margin: 0,
        color: 'rgba(0,0,0,0.20)', fontFamily: '"Courier New", Courier, monospace',
        fontSize: '0.55rem', letterSpacing: '0.55em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none',
      }}>
        scroll · drag to tilt
      </p>

      {/* Contador */}
      <p ref={counterRef} aria-live="polite" style={{
        position: 'absolute', bottom: '1.8rem', left: '50%',
        transform: 'translateX(-50%)', margin: 0,
        color: 'rgba(0,0,0,0.28)', fontFamily: '"Courier New", Courier, monospace',
        fontSize: '0.62rem', letterSpacing: '0.32em',
        whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none',
      }}>
        01 — 15
      </p>

      {/* Barra progreso */}
      <div style={{
        position: 'absolute', bottom: 0, left: '10%',
        width: '80%', height: '1px', background: 'rgba(0,0,0,0.08)', overflow: 'hidden',
      }}>
        <div ref={progressRef} style={{
          width: '100%', height: '100%', background: 'rgba(0,0,0,0.35)',
          transformOrigin: 'left center', transform: 'scaleX(0.067)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>

      {/* ── Knob R — esquina inferior derecha ─────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: '2rem', right: '2rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <Knob value={R} min={2.8} max={7.8} onChange={setR} />
      </div>
    </div>
  );
}