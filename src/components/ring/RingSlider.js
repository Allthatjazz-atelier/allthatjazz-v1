'use client';

import { useEffect, useRef } from 'react';

// ─── Vertex: onda suave en el momento de giro rápido ──────────────────────────
const VERT = /* glsl */ `
  varying vec2 vUv;
  uniform float uDistort;

  void main() {
    vUv = uv;
    vec3 p = position;
    p.x += sin(uv.y * 3.14159265) * uDistort * 0.12;
    p.y += sin(uv.x * 3.14159265) * uDistort * 0.04;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// ─── Fragment: aberración cromática leve + viñeta ────────────────────────────
const FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uDistort;

  void main() {
    float ab = uDistort * 0.007;
    float r = texture2D(uTex, vUv + vec2( ab, 0.0)).r;
    float g = texture2D(uTex, vUv              ).g;
    float b = texture2D(uTex, vUv - vec2( ab, 0.0)).b;
    float a = texture2D(uTex, vUv              ).a;

    vec2  vig      = vUv - 0.5;
    float vignette = 1.0 - smoothstep(0.25, 0.68, length(vig) * 1.5);
    vec3  col      = vec3(r, g, b) * (0.72 + vignette * 0.28);

    gl_FragColor = vec4(col, a);
  }
`;

const IMAGES = Array.from({ length: 15 }, (_, i) => `/story/story${i + 1}.png`);

/**
 * RingSlider
 * Galería 3D en anillo — el wheel/touch gira el anillo, la página no hace scroll.
 *
 * Props:
 *   images      {string[]}  URLs de imágenes
 *   radius      {number}    radio del anillo (default 5.2)
 *   cameraZ     {number}    distancia cámara (default 10)
 *   tilt        {number}    inclinación X del anillo en radianes (default 0.18)
 *   sensitivity {number}    sensibilidad al wheel (default 0.0012)
 */
export default function RingSlider({
  images      = IMAGES,
  radius      = 5.2,
  cameraZ     = 10,
  tilt        = 0.18,
  sensitivity = 0.0012,
}) {
  const canvasRef  = useRef(null);
  const counterRef = useRef(null);
  const hintRef    = useRef(null);

  useEffect(() => {
    const N = images.length;
    let raf;

    const boot = async () => {
      const T        = await import('three');
      const { gsap } = await import('gsap');

      // ── Renderer ─────────────────────────────────────────────────────────
      const renderer = new T.WebGLRenderer({
        canvas:    canvasRef.current,
        antialias: true,
        alpha:     true,
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      renderer.setClearColor(0x000000, 0);

      // ── Escena + cámara ──────────────────────────────────────────────────
      const scene  = new T.Scene();
      const camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
      camera.position.z = cameraZ;

      // ── Anillo ───────────────────────────────────────────────────────────
      const ring = new T.Group();
      ring.rotation.x = tilt;
      scene.add(ring);

      const loader = new T.TextureLoader();
      const planes = [];

      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2;

        const uniforms = {
          uTex:     { value: new T.Texture() },
          uDistort: { value: 0 },
        };

        const mat = new T.ShaderMaterial({
          vertexShader:   VERT,
          fragmentShader: FRAG,
          uniforms,
          transparent: true,
          side:        T.DoubleSide,
        });

        const geo  = new T.PlaneGeometry(2.0, 2.75, 28, 28);
        const mesh = new T.Mesh(geo, mat);

        mesh.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        mesh.rotation.y = -angle;

        ring.add(mesh);
        planes.push(mesh);

        loader.load(images[i], tex => {
          tex.colorSpace = T.SRGBColorSpace;
          mat.uniforms.uTex.value = tex;
        });
      }

      // ── Estado de rotación ────────────────────────────────────────────────
      let targetRY = 0;
      const anim   = { ry: 0, distort: 0, sx: 1 };
      let idleT    = 0;
      let hintDone = false;
      let inertiaT;

      const applyDelta = (delta) => {
        if (!hintDone && hintRef.current) {
          gsap.to(hintRef.current, { opacity: 0, duration: 0.4 });
          hintDone = true;
        }

        targetRY += delta * sensitivity;

        const speed = Math.abs(delta);
        gsap.to(anim, {
          distort:   Math.min(speed / 220, 2.5),
          sx:        1 + Math.min(speed / 4800, 0.14),
          duration:  0.5,
          ease:      'power2.out',
          overwrite: true,
        });

        clearTimeout(inertiaT);
        inertiaT = setTimeout(() => {
          gsap.to(anim, { distort: 0, sx: 1, duration: 0.9, ease: 'power3.out' });
        }, 120);
      };

      // ── Wheel — bloquea el scroll de página ──────────────────────────────
      const onWheel = (e) => {
        e.preventDefault();
        applyDelta(e.deltaY);
      };

      // ── Touch ────────────────────────────────────────────────────────────
      let lastTouchY = null;
      const onTouchStart = (e) => { lastTouchY = e.touches[0].clientY; };
      const onTouchMove  = (e) => {
        e.preventDefault();
        if (lastTouchY === null) return;
        const dy = lastTouchY - e.touches[0].clientY;
        lastTouchY = e.touches[0].clientY;
        applyDelta(dy * 2.2);
      };
      const onTouchEnd = () => { lastTouchY = null; };

      // ── Teclado ───────────────────────────────────────────────────────────
      const onKey = (e) => {
        if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); applyDelta(180); }
        if (['ArrowLeft',  'ArrowUp'  ].includes(e.key)) { e.preventDefault(); applyDelta(-180); }
      };

      const cv = canvasRef.current;
      cv.addEventListener('wheel',      onWheel,      { passive: false });
      cv.addEventListener('touchstart', onTouchStart, { passive: true  });
      cv.addEventListener('touchmove',  onTouchMove,  { passive: false });
      cv.addEventListener('touchend',   onTouchEnd,   { passive: true  });
      window.addEventListener('keydown', onKey);

      // ── Resize ────────────────────────────────────────────────────────────
      const onResize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      };
      window.addEventListener('resize', onResize);

      // ── Render loop ───────────────────────────────────────────────────────
      const tick = (t) => {
        raf = requestAnimationFrame(tick);

        // Spring suave hacia targetRY
        anim.ry += (targetRY - anim.ry) * 0.072;

        idleT = t * 0.00028;
        const ry = anim.ry + Math.sin(idleT) * 0.003;

        ring.rotation.y = ry;
        ring.scale.set(anim.sx, 1, 1);
        planes.forEach(p => (p.material.uniforms.uDistort.value = anim.distort));

        // Contador de imagen activa
        if (counterRef.current) {
          const idx = ((Math.round((ry / (Math.PI * 2)) * N) % N) + N) % N;
          counterRef.current.textContent =
            `${String(idx + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
        }

        renderer.render(scene, camera);
      };
      tick(0);

      // ── Cleanup ───────────────────────────────────────────────────────────
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(inertiaT);
        cv.removeEventListener('wheel',      onWheel);
        cv.removeEventListener('touchstart', onTouchStart);
        cv.removeEventListener('touchmove',  onTouchMove);
        cv.removeEventListener('touchend',   onTouchEnd);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize',  onResize);
        planes.forEach(p => { p.geometry.dispose(); p.material.dispose(); });
        renderer.dispose();
      };
    };

    let destroyFn;
    boot().then(fn => { destroyFn = fn; });
    return () => destroyFn?.();
  }, [images, radius, cameraZ, tilt, sensitivity]);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position:   'fixed',
        inset:      0,
        background: '#ffffff',
        overflow:   'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        style={{
          display:  'block',
          width:    '100%',
          height:   '100%',
          outline:  'none',
          cursor:   'grab',
        }}
        onMouseDown={e => (e.currentTarget.style.cursor = 'grabbing')}
        onMouseUp={e   => (e.currentTarget.style.cursor = 'grab')}
      />

      {/* Hint */}
      <p
        ref={hintRef}
        style={{
          position:      'absolute',
          bottom:        '2.8rem',
          left:          '50%',
          transform:     'translateX(-50%)',
          margin:        0,
          color:         'rgba(0,0,0,0.22)',
          fontFamily:    '"Courier New", Courier, monospace',
          fontSize:      '0.58rem',
          letterSpacing: '0.5em',
          textTransform: 'uppercase',
          whiteSpace:    'nowrap',
          userSelect:    'none',
          pointerEvents: 'none',
        }}
      >
        ↑ ↓ scroll to rotate
      </p>

      {/* Contador */}
      <p
        ref={counterRef}
        aria-live="polite"
        style={{
          position:      'absolute',
          bottom:        '1.1rem',
          left:          '50%',
          transform:     'translateX(-50%)',
          margin:        0,
          color:         'rgba(0,0,0,0.3)',
          fontFamily:    '"Courier New", Courier, monospace',
          fontSize:      '0.65rem',
          letterSpacing: '0.3em',
          whiteSpace:    'nowrap',
          userSelect:    'none',
          pointerEvents: 'none',
        }}
      >
        01 / 15
      </p>
    </div>
  );
}