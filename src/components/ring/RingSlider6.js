'use client';

import { useEffect, useRef, useState } from 'react';
import { useOptimizedMedia } from '@/hooks/useOptimizedMedia';
import { RING_IMAGES, RING_VIDEOS } from '@/data/mediaCatalog';

const VERT = /* glsl */ `
  varying vec2  vUv;
  uniform float uDistort;

  void main() {
    vUv = uv;
    vec3 p = position;
    p.x += sin(uv.y * 3.14159265) * uDistort * 0.08;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec2  vUv;
  uniform sampler2D uTex;
  uniform float     uDistort;

  void main() {
    // Invertir U: la cara exterior del cilindro queda “de frente”; la interior se ve espejada (vista desde dentro).
    vec2 uv = vec2(1.0 - vUv.x, vUv.y);
    float ab = uDistort * 0.006;
    float r  = texture2D(uTex, uv + vec2(ab, 0.0)).r;
    float g  = texture2D(uTex, uv               ).g;
    float b  = texture2D(uTex, uv - vec2(ab, 0.0)).b;
    float a  = texture2D(uTex, uv               ).a;
    gl_FragColor = vec4(r, g, b, a);
  }
`;


// Fracción del sector angular que se deja vacía entre parches adyacentes.
// El fondo blanco del canvas se ve como padding; 0 = imágenes pegadas.
const SECTOR_GAP = 0.15;

// ── Geometría: parche curvo de dTheta radianes en el ecuador ──────────────────
// Con phi=0, la normal es exactamente radial — sin distorsión trapezoidal.
// El parche sigue la curvatura del anillo en theta y es plano en Y.
// curvature: <0 concavidad (cintura), >0 convexidad (barril); 0 = cilindro.
// Muchas subdivisiones en Y: el perfil radialAt(y) es suave (parábola), sin “vértice” en el ecuador.
function makePatch(T, R, imgH, thetaC, dTheta, curvature = 0, segs = 40, vSegs = 32) {
  const pos = [], uvs = [], idx = [];
  const rowStride = vSegs + 1;

  const radialAt = y => {
    const t = (2 * y / imgH) ** 2;
    const bell = 1 - t;
    return R * (1 + curvature * bell);
  };

  for (let i = 0; i <= segs; i++) {
    const u     = i / segs;
    const theta = thetaC - dTheta * 0.5 + u * dTheta;
    const cos   = Math.cos(theta);
    const sin   = Math.sin(theta);

    for (let j = 0; j <= vSegs; j++) {
      const y = imgH * (0.5 - j / vSegs);
      const rr = radialAt(y);
      pos.push(rr * cos, y, rr * sin);
      const v = 1 - j / vSegs;
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < vSegs; j++) {
      const a = i * rowStride + j, b = i * rowStride + j + 1, c = (i + 1) * rowStride + j, d = (i + 1) * rowStride + j + 1;
      idx.push(a, b, c,  b, d, c);
    }
  }

  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv',       new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ── Valor arrastrable: texto plano, sin dial ni calibre — se arrastra en
// vertical directamente sobre el número, como una ficha técnica editable ─
function DragValue({ value, min, max, onChange, label, decimals = 1, sensitivity = 140 }) {
  const dragging = useRef(false);
  const lastY    = useRef(0);

  const onPointerDown = e => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging.current = true;
    lastY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const onPointerMove = e => {
    if (!dragging.current) return;
    const dy = lastY.current - e.clientY;
    lastY.current = e.clientY;
    onChange(prev => Math.min(max, Math.max(min, prev + dy * (max - min) / sensitivity)));
  };
  const onPointerUp = e => {
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ok */ }
  };

  return (
    <span
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ cursor:'ns-resize', touchAction:'none', userSelect:'none' }}
    >
      {label} {value.toFixed(decimals)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RingSlider6({
  friction    = 0.92,
  sensitivity = 0.0010,
}) {
  const canvasRef   = useRef(null);
  const counterRef  = useRef(null);
  const progressRef = useRef(null);
  const hintRef     = useRef(null);

  const { getImage, getVideo, isLoaded } = useOptimizedMedia();
  const getImageRef = useRef(getImage);
  const getVideoRef = useRef(getVideo);
  getImageRef.current = getImage;
  getVideoRef.current = getVideo;

  // R = radio   H = altura   C = curvatura (concavo / convexo)
  const [R, setR] = useState(5.0);
  const [H, setH] = useState(3.2);
  const [C, setC] = useState(0);
  const Rref = useRef(R);
  const Href = useRef(H);
  const Cref = useRef(C);
  useEffect(() => { Rref.current = R; }, [R]);
  useEffect(() => { Href.current = H; }, [H]);
  useEffect(() => { Cref.current = C; }, [C]);
  const rebuildRef = useRef(false);
  useEffect(() => { rebuildRef.current = true; }, [R, H, C]);

  // Layout responsivo de los controles: esquina superior derecha, alineados con
  // la fila de nav (BerlinClockNav) en desktop → arriba bajo el nav en móvil
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const imageUrls = RING_IMAGES.map((n) => getImageRef.current(n).src).filter(Boolean);
    const videoUrls = RING_VIDEOS.map((n) => getVideoRef.current(n).src).filter(Boolean);

    const allMedia = [];
    const total = imageUrls.length + videoUrls.length;
    const step  = Math.max(1, Math.floor(total / (videoUrls.length || 1)));
    let vi = 0, ii = 0;
    for (let i = 0; i < total; i++) {
      if (vi < videoUrls.length && i % step === Math.floor(step / 2)) {
        allMedia.push({ url: videoUrls[vi++], type: 'video' });
      } else if (ii < imageUrls.length) {
        allMedia.push({ url: imageUrls[ii++], type: 'image' });
      }
    }
    const N = allMedia.length;
    if (!N) return;

    let raf;

    const boot = async () => {
      const T        = await import('three');
      const { gsap } = await import('gsap');

      const renderer = new T.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.setClearColor(0x000000, 0);

      const scene  = new T.Scene();
      const camera = new T.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 200);
      camera.position.set(0, 4, 16);
      camera.lookAt(0, 0, 0);

      // Grupo: el anillo gira en Y
      const group = new T.Group();
      scene.add(group);

      const loader   = new T.TextureLoader();
      const videoEls = [];
      const dTheta     = (Math.PI * 2) / N;
      const patchTheta = dTheta * (1 - SECTOR_GAP);

      const sectors = allMedia.map(({ url, type }, i) => {
        const thetaC = i * dTheta;

        const uniforms = {
          uTex:     { value: new T.Texture() },
          uDistort: { value: 0 },
        };
        const mat = new T.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG,
          uniforms, transparent: true, side: T.DoubleSide,
        });

        const geo  = makePatch(T, Rref.current, Href.current, thetaC, patchTheta, Cref.current);
        const mesh = new T.Mesh(geo, mat);
        group.add(mesh);

        if (type === 'video') {
          const vid = document.createElement('video');
          Object.assign(vid, {
            src: encodeURI(url), crossOrigin: 'anonymous',
            loop: true, muted: true, playsInline: true, preload: 'metadata',
          });
          vid.style.display = 'none';
          document.body.appendChild(vid);
          const tex = new T.VideoTexture(vid);
          tex.colorSpace = T.SRGBColorSpace;
          tex.generateMipmaps = false;
          tex.minFilter = tex.magFilter = T.LinearFilter;
          uniforms.uTex.value = tex;
          videoEls.push({ vid, index: i });
        } else {
          loader.load(url, tex => {
            tex.colorSpace = T.SRGBColorSpace;
            tex.minFilter = tex.magFilter = T.LinearFilter;
            uniforms.uTex.value = tex;
          });
        }

        return { mesh, uniforms, thetaC, type };
      });

      // ── Física ─────────────────────────────────────────────────────────
      let velocity = 0;
      const anim   = { distort: 0 };
      let hintDone = false, inertiaT;

      const applyDelta = delta => {
        if (!hintDone && hintRef.current) {
          gsap.to(hintRef.current, { opacity: 0, duration: 0.5 });
          hintDone = true;
        }
        velocity += delta * sensitivity;
        gsap.to(anim, {
          distort:  Math.min(Math.abs(delta) / 140, 2.5),
          duration: 0.4, ease: 'power2.out', overwrite: true,
        });
        clearTimeout(inertiaT);
        inertiaT = setTimeout(() => {
          gsap.to(anim, { distort: 0, duration: 1.2, ease: 'power3.out' });
        }, 150);
      };

      // ── Tilt drag vertical ─────────────────────────────────────────────
      const tiltState = { active: false, startY: 0, current: 0.42 };
      const TILT_MIN = 0.0, TILT_MAX = 1.2;

      const onMouseDown = e => {
        tiltState.active  = true;
        tiltState.startY  = e.clientY;
        tiltState.startV  = tiltState.current;
        canvasRef.current.style.cursor = 'grabbing';
      };
      const onMouseMove = e => {
        if (!tiltState.active) return;
        const dy = e.clientY - tiltState.startY;
        tiltState.current = Math.min(TILT_MAX, Math.max(TILT_MIN, tiltState.startV + dy / 280));
      };
      const onMouseUp = () => {
        tiltState.active = false;
        canvasRef.current.style.cursor = 'grab';
      };

      const onWheel = e => { e.preventDefault(); applyDelta(e.deltaY); };

      let lastTX = null, lastTY = null;
      const onTouchStart = e => {
        lastTX = e.touches[0].clientX;
        lastTY = e.touches[0].clientY;
        tiltState.startV = tiltState.current;
      };
      const onTouchMove = e => {
        e.preventDefault();
        if (lastTX === null) return;
        const dx = lastTX - e.touches[0].clientX;
        const dy = lastTY - e.touches[0].clientY;
        lastTX = e.touches[0].clientX;
        lastTY = e.touches[0].clientY;
        if (Math.abs(dx) >= Math.abs(dy)) {
          applyDelta(dx * 2.8);
        } else {
          tiltState.current = Math.min(TILT_MAX, Math.max(TILT_MIN, tiltState.current + dy / 280));
        }
      };
      const onTouchEnd = () => { lastTX = null; lastTY = null; };

      const onKey = e => {
        if (['ArrowRight','ArrowDown'].includes(e.key)) { e.preventDefault(); applyDelta(220); }
        if (['ArrowLeft','ArrowUp'].includes(e.key))   { e.preventDefault(); applyDelta(-220); }
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

      const onVis = () => {
        if (document.hidden) videoEls.forEach(({ vid }) => vid.pause());
      };
      document.addEventListener('visibilitychange', onVis);

      // ── Render loop ────────────────────────────────────────────────────
      const wp = new T.Vector3();
      let totalRY = 0;
      let smoothTilt = tiltState.current;
      let readyDispatched = false;

      const tick = ts => {
        raf = requestAnimationFrame(tick);

        // Reconstruir geo si R o H cambiaron
        if (rebuildRef.current) {
          rebuildRef.current = false;
          sectors.forEach(({ mesh, thetaC }) => {
            mesh.geometry.dispose();
            mesh.geometry = makePatch(T, Rref.current, Href.current, thetaC, patchTheta, Cref.current);
          });
        }

        totalRY  += velocity;
        velocity *= friction;

        // Smooth tilt
        smoothTilt += (tiltState.current - smoothTilt) * 0.07;
        group.rotation.x = smoothTilt;

        const idleAmp    = Math.max(0, 1 - Math.abs(velocity) * 60);
        const idleWobble = Math.sin(ts * 0.00018) * 0.002 * idleAmp;
        group.rotation.y = totalRY + idleWobble;

        sectors.forEach(({ uniforms }) => (uniforms.uDistort.value = anim.distort));

        // Sector más frontal
        let maxZ = -Infinity, frontIdx = 0;
        sectors.forEach(({ mesh }, i) => {
          mesh.getWorldPosition(wp);
          if (wp.z > maxZ) { maxZ = wp.z; frontIdx = i; }
        });
        if (counterRef.current)
          counterRef.current.textContent =
            `${String(frontIdx + 1).padStart(2,'0')} — ${String(N).padStart(2,'0')}`;
        if (progressRef.current)
          progressRef.current.style.transform = `scaleX(${(frontIdx + 1) / N})`;

        // 1-2 vídeos concurrentes: el del sector frontal y su vecino. El resto pause.
        videoEls.forEach(({ vid, index }) => {
          const dist = Math.min(Math.abs(index - frontIdx), N - Math.abs(index - frontIdx));
          if (dist <= 1) {
            if (vid.paused) vid.play().catch(() => {});
          } else if (!vid.paused) {
            vid.pause();
          }
        });

        renderer.render(scene, camera);

        // 2b: avisar a RouteTransition de que la escena ya pintó su primer frame.
        if (!readyDispatched) {
          readyDispatched = true;
          window.dispatchEvent(new CustomEvent("atj-scene-ready"));
        }
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
        document.removeEventListener('visibilitychange', onVis);
        sectors.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); });
        videoEls.forEach(({ vid }) => { vid.pause(); vid.remove(); });
        renderer.dispose();
      };
    };

    let cancelled = false;
    let destroyFn = null;
    boot().then((fn) => {
      // StrictMode (dev) hace mount→unmount→mount: el cleanup corre ANTES de que
      // boot() resuelva, así que destroyFn aún era undefined y ese primer arranque
      // no se limpiaba → quedaban DOS render loops vivos compartiendo el mismo
      // rebuildRef y el anillo no se reconstruía al mover los knobs. Con el flag
      // `cancelled` disponemos de inmediato el arranque ya obsoleto.
      if (cancelled) fn?.();
      else destroyFn = fn;
    });
    return () => {
      cancelled = true;
      destroyFn?.();
    };
  }, [isLoaded, friction, sensitivity]);

  return (
    <div style={{ position:'fixed', inset:0, background:'#ffffff', overflow:'hidden' }}>
      <canvas
        ref={canvasRef} tabIndex={0}
        data-ring-canvas="true"
        style={{ display:'block', width:'100%', height:'100%', outline:'none', cursor:'grab' }}
      />



      <div style={{
        position:'absolute', bottom:0, left:'10%',
        width:'80%', height:'1px', background:'rgba(0,0,0,0.07)', overflow:'hidden',
      }}>
        <div ref={progressRef} style={{
          width:'100%', height:'100%', background:'rgba(0,0,0,0.30)',
          transformOrigin:'left center',
          transform:`scaleX(${1 / (RING_IMAGES.length + RING_VIDEOS.length)})`,
          transition:'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}/>
      </div>

      {/* Ø · H · curvatura — ficha técnica en texto plano, sin dial: esquina superior
          derecha alineada con la fila de nav (Berlin/A/B/C Ring) en desktop ·
          arriba, bajo el BerlinClockNav2, en móvil */}
      <div style={{
        position:'fixed', zIndex:10050, pointerEvents:'auto',
        display:'flex', alignItems:'center',
        fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontWeight:700, letterSpacing:'-0.02em',
        fontVariantNumeric:'tabular-nums',
        color:'rgba(17,17,17,0.55)',
        ...(isMobile
          ? {
              top:'calc(env(safe-area-inset-top, 0px) + 4.25rem)',
              left:'50%', transform:'translateX(-50%)',
              gap:'0.5em', fontSize:'0.85rem',
            }
          : {
              top:'calc(env(safe-area-inset-top, 0px) + 1.65rem)',
              right:'max(1.25rem, env(safe-area-inset-right))',
              transform:'translateY(-50%)',
              gap:'0.4em', fontSize:'0.8rem',
            }),
      }}>
        <DragValue value={R} min={2.0} max={9.0} onChange={setR} label="Ø" />
        <span aria-hidden="true">·</span>
        <DragValue value={H} min={0.8} max={6.0} onChange={setH} label="H" />
        <span aria-hidden="true">·</span>
        <DragValue value={C} min={-0.45} max={0.45} onChange={setC} label="C" decimals={2} />
      </div>
    </div>
  );
}
