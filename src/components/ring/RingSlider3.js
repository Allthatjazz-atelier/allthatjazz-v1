'use client';

import { useEffect, useRef, useState } from 'react';

const VERT = /* glsl */ `
  varying vec2  vUv;
  uniform float uDistort;

  void main() {
    vUv = uv;
    vec3 p = position;
    // Stretch elástico radial al girar rápido
    p.xy *= 1.0 + uDistort * 0.04 * (1.0 - uv.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec2  vUv;
  uniform sampler2D uTex;
  uniform float     uDistort;

  void main() {
    float ab = uDistort * 0.005;
    float r  = texture2D(uTex, vUv + vec2(ab, 0.0)).r;
    float g  = texture2D(uTex, vUv               ).g;
    float b  = texture2D(uTex, vUv - vec2(ab, 0.0)).b;
    float a  = texture2D(uTex, vUv               ).a;
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

// ── Geometría: trapecio curvo que cubre exactamente dTheta radianes ───────────
// R        = radio del anillo
// height   = altura de la cinta (en unidades world)
// thetaC   = ángulo central del sector
// dTheta   = ángulo total del sector (2π / N)
// segs     = subdivisiones a lo largo del arco (para que la curva sea suave)
function makeSectorGeo(T, R, height, thetaC, dTheta, segs = 32) {
  const pos = [], uvs = [], idx = [];

  for (let i = 0; i <= segs; i++) {
    const u     = i / segs;
    const theta = thetaC - dTheta * 0.5 + u * dTheta;
    const cos   = Math.cos(theta);
    const sin   = Math.sin(theta);

    // Borde exterior (v = 0, arriba) e interior (v = 1, abajo)
    // Aquí usamos un anillo plano: exterior = R + height/2, interior = R - height/2
    const rOuter = R + height * 0.5;
    const rInner = R - height * 0.5;

    pos.push(
      rOuter * cos, rOuter * sin, 0,  // exterior
      rInner * cos, rInner * sin, 0,  // interior
    );
    uvs.push(u, 0,  u, 1);
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c,  b, d, c);
  }

  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv',       new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ── Knob ─────────────────────────────────────────────────────────────────────
function Knob({ value, min, max, onChange, label }) {
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

  useEffect(() => {
    const move = e => {
      if (!dragging.current) return;
      const y  = e.clientY ?? e.touches?.[0].clientY;
      const dy = lastY.current - y;
      lastY.current = y;
      onChange(prev => Math.min(max, Math.max(min, prev + dy * (max - min) / 120)));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [min, max, onChange]);

  const down = e => {
    dragging.current = true;
    lastY.current = e.clientY ?? e.touches?.[0].clientY;
    e.preventDefault();
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, userSelect:'none' }}>
      <svg width={64} height={64} viewBox="0 0 72 72"
        style={{ cursor:'grab', touchAction:'none' }}
        onMouseDown={down} onTouchStart={down}>
        <circle cx={36} cy={36} r={30} fill="rgba(0,0,0,0.04)" stroke="rgba(0,0,0,0.10)" strokeWidth={0.5}/>
        <circle cx={36} cy={36} r={24} fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.07)" strokeWidth={0.5}/>
        <path d={arcD} fill="none" stroke="rgba(0,0,0,0.50)" strokeWidth={2.2} strokeLinecap="round"/>
        <line x1={36} y1={36} x2={kx(17,deg)} y2={ky(17,deg)}
          stroke="rgba(0,0,0,0.70)" strokeWidth={1.6} strokeLinecap="round"/>
      </svg>
      <span style={{ fontFamily:'"Courier New",Courier,monospace', fontSize:'0.5rem',
        letterSpacing:'0.12em', color:'rgba(0,0,0,0.28)' }}>
        {label} {typeof value === 'number' ? value.toFixed(1) : value}
      </span>
    </div>
  );
}

export default function RingSlider3({
  images      = DEFAULT_IMAGES,
  videos      = DEFAULT_VIDEOS,
  friction    = 0.92,
  sensitivity = 0.0010,
}) {
  const canvasRef   = useRef(null);
  const counterRef  = useRef(null);
  const progressRef = useRef(null);
  const hintRef     = useRef(null);

  // R = radio del anillo, H = altura de la cinta
  const [R, setR] = useState(4.5);
  const [H, setH] = useState(2.8);
  const Rref = useRef(R);
  const Href = useRef(H);
  useEffect(() => { Rref.current = R; }, [R]);
  useEffect(() => { Href.current = H; }, [H]);

  const rebuildRef = useRef(false);
  useEffect(() => { rebuildRef.current = true; }, [R, H]);

  useEffect(() => {
    // Mezclamos imágenes y vídeos en un array plano
    const allMedia = [];
    const step = Math.max(1, Math.floor(
      (images.length + videos.length) / (videos.length || 1)
    ));
    let vi = 0, ii = 0, total = images.length + videos.length;
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
        canvas: canvasRef.current, antialias: true, alpha: true,
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.setClearColor(0x000000, 0);

      const scene  = new T.Scene();
      // Cámara mirando el anillo de frente (desde Z positivo)
      const camera = new T.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 100);
      camera.position.set(0, 0, 14);
      camera.lookAt(0, 0, 0);

      // El anillo vive en el plano XY, inclinado ligeramente en X para perspectiva
      const group = new T.Group();
      group.rotation.x = 0.32;   // inclinación fija — da sensación de profundidad
      scene.add(group);

      const loader   = new T.TextureLoader();
      const videoEls = [];
      const dTheta   = (Math.PI * 2) / N;

      // Cada sector: { mesh, uniforms, thetaC }
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

        const geo  = makeSectorGeo(T, Rref.current, Href.current, thetaC, dTheta);
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

      // ── Física ───────────────────────────────────────────────────────────
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

      // ── Eventos ───────────────────────────────────────────────────────────
      const onWheel = e => { e.preventDefault(); applyDelta(e.deltaY); };

      let lastTX = null;
      const onTouchStart = e => { lastTX = e.touches[0].clientX; };
      const onTouchMove  = e => {
        e.preventDefault();
        if (lastTX === null) return;
        applyDelta((lastTX - e.touches[0].clientX) * 2.8);
        lastTX = e.touches[0].clientX;
      };
      const onTouchEnd = () => { lastTX = null; };

      const onKey = e => {
        if (['ArrowRight','ArrowDown'].includes(e.key)) { e.preventDefault(); applyDelta(220); }
        if (['ArrowLeft','ArrowUp'].includes(e.key))   { e.preventDefault(); applyDelta(-220); }
      };

      const cv = canvasRef.current;
      cv.addEventListener('wheel',      onWheel,      { passive: false });
      cv.addEventListener('touchstart', onTouchStart, { passive: true });
      cv.addEventListener('touchmove',  onTouchMove,  { passive: false });
      cv.addEventListener('touchend',   onTouchEnd);
      window.addEventListener('keydown', onKey);

      const onResize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      };
      window.addEventListener('resize', onResize);

      // ── Render loop ───────────────────────────────────────────────────────
      const wp  = new T.Vector3();
      let totalRY = 0;

      const tick = ts => {
        raf = requestAnimationFrame(tick);

        // Reconstruir geometrías si R o H cambiaron
        if (rebuildRef.current) {
          rebuildRef.current = false;
          sectors.forEach(({ mesh, thetaC }) => {
            mesh.geometry.dispose();
            mesh.geometry = makeSectorGeo(T, Rref.current, Href.current, thetaC, dTheta);
          });
        }

        totalRY  += velocity;
        velocity *= friction;

        // Idle breath cuando está parado
        const idleAmp    = Math.max(0, 1 - Math.abs(velocity) * 60);
        const idleWobble = Math.sin(ts * 0.00018) * 0.002 * idleAmp;
        group.rotation.z = totalRY + idleWobble;   // gira en Z porque el anillo está en XY

        sectors.forEach(({ uniforms }) => (uniforms.uDistort.value = anim.distort));

        // Sector más cercano a la cámara (mayor Z en world space)
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
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize',  onResize);
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
        style={{ display:'block', width:'100%', height:'100%', outline:'none', cursor:'grab' }}
        onMouseDown={e => (e.currentTarget.style.cursor = 'grabbing')}
        onMouseUp={e   => (e.currentTarget.style.cursor = 'grab')}
      />

      {/* Hint */}
      <p ref={hintRef} style={{
        position:'absolute', bottom:'3.6rem', left:'50%',
        transform:'translateX(-50%)', margin:0,
        color:'rgba(0,0,0,0.18)', fontFamily:'"Courier New",Courier,monospace',
        fontSize:'0.52rem', letterSpacing:'0.55em', textTransform:'uppercase',
        whiteSpace:'nowrap', userSelect:'none', pointerEvents:'none',
      }}>
        scroll to spin
      </p>

      {/* Contador */}
      <p ref={counterRef} aria-live="polite" style={{
        position:'absolute', bottom:'1.8rem', left:'50%',
        transform:'translateX(-50%)', margin:0,
        color:'rgba(0,0,0,0.26)', fontFamily:'"Courier New",Courier,monospace',
        fontSize:'0.60rem', letterSpacing:'0.32em',
        whiteSpace:'nowrap', userSelect:'none', pointerEvents:'none',
      }}>
        01 — {String(images.length + videos.length).padStart(2,'0')}
      </p>

      {/* Barra progreso */}
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

      {/* Controles — esquina inferior derecha */}
      <div style={{
        position:'absolute', bottom:'1.8rem', right:'2rem',
        display:'flex', flexDirection:'column', gap:'1rem', alignItems:'center',
      }}>
        <Knob value={R} min={2.0} max={8.0} onChange={setR} label="Ø" />
        <Knob value={H} min={0.8} max={5.0} onChange={setH} label="H" />
      </div>
    </div>
  );
}