'use client';

import { useEffect, useRef, useState } from 'react';

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

// ── Geometría: parche curvo que cubre exactamente dTheta en el ecuador ────────
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

// ── Knob (Pointer Events + capture: no compite con otros controles ni con el canvas) ─
function Knob({ value, min, max, onChange, label, size = 64, decimals = 1 }) {
  const dragging = useRef(false);
  const lastY    = useRef(0);
  const S = 220, E = 500;
  const t   = (value - min) / (max - min);
  const deg = S + t * (E - S);
  const Kr  = 27;
  const rad = d => d * Math.PI / 180;
  const kx  = (rr, d) => 36 + rr * Math.cos(rad(d));
  const ky  = (rr, d) => 36 + rr * Math.sin(rad(d));
  const arcD = `M ${kx(Kr,S)} ${ky(Kr,S)} A ${Kr} ${Kr} 0 ${(deg-S)>180?1:0} 1 ${kx(Kr,deg)} ${ky(Kr,deg)}`;

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
    onChange(prev => Math.min(max, Math.max(min, prev + dy * (max - min) / 120)));
  };
  const onPointerUp = e => {
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ok */ }
  };

  return (
    <div
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, userSelect:'none', touchAction:'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={size} height={size} viewBox="0 0 72 72"
        style={{ cursor:'grab', touchAction:'none', display:'block' }}>
        <circle cx={36} cy={36} r={30}
          fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.10)" strokeWidth={0.5}/>
        <circle cx={36} cy={36} r={24}
          fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.07)" strokeWidth={0.5}/>
        <path d={arcD} fill="none" stroke="rgba(0,0,0,0.50)"
          strokeWidth={2.2} strokeLinecap="round"/>
        <line x1={36} y1={36} x2={kx(17,deg)} y2={ky(17,deg)}
          stroke="rgba(0,0,0,0.70)" strokeWidth={1.6} strokeLinecap="round"/>
      </svg>
      <span style={{
        fontFamily:'"Courier New",Courier,monospace',
        fontSize:'0.45rem', letterSpacing:'0.12em', color:'rgba(0,0,0,0.28)',
      }}>
        {label} {value.toFixed(decimals)}
      </span>
    </div>
  );
}

// ── Fader vertical (misma estética; arriba = max; Pointer Events + capture) ─
function VerticalFader({ value, min, max, onChange, label, size = 64, decimals = 1 }) {
  const dragging = useRef(false);
  const trackRef = useRef(null);

  const setFromClientY = clientY => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;
    const t = Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height));
    onChange(min + t * (max - min));
  };

  const onPointerDown = e => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientY(e.clientY);
    e.preventDefault();
    e.stopPropagation();
  };
  const onPointerMove = e => {
    if (!dragging.current) return;
    setFromClientY(e.clientY);
  };
  const onPointerUp = e => {
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ok */ }
  };

  const t = (value - min) / (max - min);
  const thumbCy = 55 - t * 38;
  const trackBottom = 64;
  const fillH = Math.max(0, trackBottom - thumbCy);

  return (
    <div
      ref={trackRef}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, userSelect:'none', touchAction:'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={size} height={size} viewBox="0 0 72 72"
        style={{ cursor:'grab', display:'block', touchAction:'none' }}>
        <rect x={30} y={8} width={12} height={56} rx={6}
          fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.10)" strokeWidth={0.5}/>
        <rect x={32} y={thumbCy} width={8} height={fillH} rx={4}
          fill="rgba(0,0,0,0.12)"/>
        <circle cx={36} cy={thumbCy} r={9}
          fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.07)" strokeWidth={0.5}/>
        <line x1={36} y1={thumbCy - 4} x2={36} y2={thumbCy + 4}
          stroke="rgba(0,0,0,0.45)" strokeWidth={1.2} strokeLinecap="round"/>
      </svg>
      <span style={{
        fontFamily:'"Courier New",Courier,monospace',
        fontSize:'0.45rem', letterSpacing:'0.12em', color:'rgba(0,0,0,0.28)',
      }}>
        {label} {value.toFixed(decimals)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RingSLider4({
  images      = DEFAULT_IMAGES,
  videos      = DEFAULT_VIDEOS,
  friction    = 0.92,
  sensitivity = 0.0010,
}) {
  const canvasRef   = useRef(null);
  const counterRef  = useRef(null);
  const progressRef = useRef(null);
  const hintRef     = useRef(null);

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

  useEffect(() => {
    // Mezclar imágenes y vídeos
    const allMedia = [];
    const total = images.length + videos.length;
    const step  = Math.max(1, Math.floor(total / (videos.length || 1)));
    let vi = 0, ii = 0;
    for (let i = 0; i < total; i++) {
      if (vi < videos.length && i % step === Math.floor(step / 2)) {
        allMedia.push({ url: videos[vi++], type: 'video' });
      } else if (ii < images.length) {
        allMedia.push({ url: images[ii++], type: 'image' });
      }
    }
    const N = allMedia.length;

    let raf;

    const boot = async () => {
      const T        = await import('three');
      const { gsap } = await import('gsap');

      const renderer = new T.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
        // Necesario para capturas 2D (About en HeaderFooter15): sin esto el buffer se limpia
        // tras el frame y drawImage devuelve vacío / blanco — distinto efecto que FinalSlider4.
        preserveDrawingBuffer: true,
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
      const dTheta   = (Math.PI * 2) / N;

      const sectors = allMedia.map(({ url, type }, i) => {
        // thetaC centrado en el sector — empezamos desde la parte delantera
        const thetaC = i * dTheta;

        const uniforms = {
          uTex:     { value: new T.Texture() },
          uDistort: { value: 0 },
        };
        const mat = new T.ShaderMaterial({
          vertexShader: VERT, fragmentShader: FRAG,
          uniforms, transparent: true, side: T.DoubleSide,
        });

        const geo  = makePatch(T, Rref.current, Href.current, thetaC, dTheta, Cref.current);
        const mesh = new T.Mesh(geo, mat);
        group.add(mesh);

        if (type === 'video') {
          const vid = document.createElement('video');
          Object.assign(vid, {
            src: url, crossOrigin: 'anonymous',
            loop: true, muted: true, playsInline: true, autoplay: true,
          });
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

        return { mesh, uniforms, thetaC };
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

      // ── Render loop ────────────────────────────────────────────────────
      const wp = new T.Vector3();
      let totalRY = 0;
      let smoothTilt = tiltState.current;

      const tick = ts => {
        raf = requestAnimationFrame(tick);

        // Reconstruir geo si R o H cambiaron
        if (rebuildRef.current) {
          rebuildRef.current = false;
          sectors.forEach(({ mesh, thetaC }) => {
            mesh.geometry.dispose();
            mesh.geometry = makePatch(T, Rref.current, Href.current, thetaC, dTheta, Cref.current);
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
        sectors.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); });
        videoEls.forEach(v => { v.pause(); v.remove(); });
        renderer.dispose();
      };
    };

    let destroyFn;
    boot().then(fn => { destroyFn = fn; });
    return () => destroyFn?.();
  }, [images, videos, friction, sensitivity]);

  return (
    <div style={{ position:'fixed', inset:0, background:'#ffffff', overflow:'hidden' }}>
      <canvas
        ref={canvasRef} tabIndex={0}
        data-ring-canvas="true"
        style={{ display:'block', width:'100%', height:'100%', outline:'none', cursor:'grab' }}
      />

      <p ref={hintRef} style={{
        position:'absolute', bottom:'6.5rem', left:'50%',
        transform:'translateX(-50%)', margin:0,
        color:'rgba(0,0,0,0.18)', fontFamily:'"Courier New",Courier,monospace',
        fontSize:'0.52rem', letterSpacing:'0.55em', textTransform:'uppercase',
        whiteSpace:'nowrap', userSelect:'none', pointerEvents:'none',
      }}>
        scroll · drag to tilt
      </p>

      <p ref={counterRef} aria-live="polite" style={{
        position:'absolute', bottom:'5rem', left:'50%',
        transform:'translateX(-50%)', margin:0,
        color:'rgba(0,0,0,0.26)', fontFamily:'"Courier New",Courier,monospace',
        fontSize:'0.60rem', letterSpacing:'0.32em',
        whiteSpace:'nowrap', userSelect:'none', pointerEvents:'none',
      }}>
        01 — {String(images.length + videos.length).padStart(2,'0')}
      </p>

      <div style={{
        position:'absolute', bottom:0, left:'10%',
        width:'80%', height:'1px', background:'rgba(0,0,0,0.07)', overflow:'hidden',
      }}>
        <div ref={progressRef} style={{
          width:'100%', height:'100%', background:'rgba(0,0,0,0.30)',
          transformOrigin:'left center',
          transform:`scaleX(${1 / (images.length + videos.length)})`,
          transition:'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}/>
      </div>

      {/* Ø · H · curvatura — derecha, centro vertical; z por encima del HeaderFooter (9999) */}
      <div style={{
        position:'fixed', top:'50%', right:'max(1rem, env(safe-area-inset-right))',
        transform:'translateY(-50%)',
        display:'flex', flexDirection:'row', alignItems:'flex-end', justifyContent:'flex-end',
        gap:'1.1rem', zIndex:10050, pointerEvents:'auto',
      }}>
        <Knob value={R} min={2.0} max={9.0} onChange={setR} label="Ø" size={52} />
        <VerticalFader value={H} min={0.8} max={6.0} onChange={setH} label="H" size={52} />
        <Knob value={C} min={-0.45} max={0.45} onChange={setC} label="C" size={52} decimals={2} />
      </div>
    </div>
  );
}