import { useEffect, useRef } from 'react';
import gsap from 'gsap';

function MagneticText({ children, className, ...props }) {
  const words = String(children).trim().split(/\s+/);
  return (
    <p className={className} {...props}>
      {words.map((word, i) => (
        <span key={i}>
          <span
            data-word
            style={{ display: 'inline-block', willChange: 'transform' }}
          >
            {word}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}

export default function AboutSection8({ skipReveal = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const wordSpans = Array.from(root.querySelectorAll('[data-word]'));
    const items = wordSpans.map(el => ({ el, cx: 0, cy: 0, tx: 0, ty: 0 }));

    let positions = [];
    const raf0 = requestAnimationFrame(() => {
      positions = items.map(({ el }) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    });

    // ── Magnetic ──────────────────────────────────────────────────────────────
    const RADIUS = 120;
    const FORCE  = 200;

    const onMouseMove = ({ clientX: mx, clientY: my }) => {
      items.forEach((item, i) => {
        if (!positions[i]) return;
        const dx   = positions[i].x - mx;
        const dy   = positions[i].y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < RADIUS && dist > 0) {
          const f = (1 - dist / RADIUS) * FORCE;
          item.tx = (dx / dist) * f;
          item.ty = (dy / dist) * f;
        } else {
          item.tx = 0;
          item.ty = 0;
        }
      });
    };

    const onTouchMove = (e) => {
      const t = e.touches[0];
      onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    };
    const onTouchEnd = () => items.forEach(i => { i.tx = 0; i.ty = 0; });

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend',  onTouchEnd);

    // ── rAF lerp ──────────────────────────────────────────────────────────────
    const LERP = 0.08;
    let rafId;
    const tick = () => {
      items.forEach(item => {
        item.cx += (item.tx - item.cx) * LERP;
        item.cy += (item.ty - item.cy) * LERP;
        item.el.style.transform =
          `translate(${item.cx.toFixed(2)}px,${item.cy.toFixed(2)}px)`;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    // ── Blur reveal ───────────────────────────────────────────────────────────
    // Si skipReveal=true, el HeaderFooter controla este reveal desde fuera.
    // Dejamos los elementos con blur aplicado y esperamos a que el padre
    // llame al reveal vía el atributo data-reveal.
    const reveals = root.querySelectorAll('[data-reveal]');
    if (skipReveal) {
      // Fijar blur inicial — el padre lanzará la animación cuando la burbuja termine
      gsap.set(reveals, { filter: 'blur(14px)', opacity: 0 });
    } else {
      gsap.set(reveals, { filter: 'blur(14px)', opacity: 1 });
      gsap.to(reveals, {
        filter:   'blur(0px)',
        duration: 1.5,
        ease:     'power2.out',
        stagger:  0.18,
      });
    }

    return () => {
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend',  onTouchEnd);
      gsap.killTweensOf(reveals);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen gap-12 flex flex-col text-[0.875rem] md:text-[0.875rem] tracking-[-0.04em] items-center justify-start pt-[16vh] md:pt-0 md:justify-center px-4 leading-none text-center"
    >
      <div className="flex flex-col z-10 w-[100vw] md:w-[40vw] px-4">

        <MagneticText
          data-reveal
          className="flex flex-wrap font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] mb-[2rem] justify-center gap-x-[0.3em]"
        >
          A creative collective based in Berlin, playing Worldwide. Blending digital craft with analog attitude. Exploring and shaping visual narratives and experiences that resonate through culture, music, fashion, lifestyle and multimedia. Hustling 24/7.
        </MagneticText>

        <MagneticText
          data-reveal
          className="flex flex-wrap font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] mb-[4rem] justify-center gap-x-[0.3em]"
        >
          Creative direction, strategy, digital and web experiences, design and code are part of our playground
        </MagneticText>

        <div data-reveal className="flex flex-col w-full">
          <MagneticText className="flex flex-wrap font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] justify-center gap-x-[0.3em]">
            For collaborations or inquires, please reach out at:
          </MagneticText>
          <MagneticText className="flex flex-wrap font-semibold text-[1.25rem] tracking-[-0.045em] leading-[1.1] justify-center gap-x-[0.3em]">
            hello@allthatjazz.com
          </MagneticText>
          <MagneticText className="flex flex-wrap uppercase font-semibold text-[0.625rem] tracking-[-0.045em] leading-[1.1] mt-1 justify-center gap-x-[0.3em]">
            joaquin diaz, kiko Climent, +++
          </MagneticText>
        </div>

      </div>
    </div>
  );
}