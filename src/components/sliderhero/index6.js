import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function SliderHero6() {
  const imageRefs = useRef([]);
  const timelineRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showEffects, setShowEffects] = useState(false);
  const [animTime, setAnimTime] = useState(0);
  
  // Estados de efectos
  const [effects, setEffects] = useState({
    glitch: 0,
    pixelate: 0,
    wave: 0,
    rotate: 0,
    shake: 0,
    scale: 0,
    skew: 0,
    invert: 0,
    flip: 0,
    perspective: 0,
  });

  // Configuración de las imágenes
  const images = [
    { src: '/hero/img19.png', position: 'top-[38%] left-[43%] -translate-x-1/2 -translate-y-1/2', size: 'min(20vw, 20vh * 1.78)', z: 'z-[997]' },
    { src: '/hero/img9.png', position: 'top-[60%] left-[55%] -translate-x-1/2 -translate-y-1/2', size: 'min(15vw, 15vh * 1.78)', z: 'z-[998]' },
    { src: '/hero/img10.png', position: 'top-[50%] left-[75%] -translate-x-1/2 -translate-y-1/2', size: 'min(40vw, 40vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img14.png', position: 'top-[35%] left-[10%] -translate-x-1/2 -translate-y-1/2', size: 'min(25vw, 25vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img16.png', position: 'top-0 left-[45%] -translate-x-1/2', size: 'min(20vw, 20vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img15.png', position: 'bottom-[10%] right-[10%]', size: 'min(18vw, 18vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img13.png', position: 'bottom-[15%] left-[65%]', size: 'min(18vw, 18vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img12.png', position: 'bottom-[30%] left-[35%]', size: 'min(48vw, 36vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img5.png', position: 'bottom-[15%] left-[65%]', size: 'min(24vw, 20vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img17.png', position: 'bottom-[60%] left-[20%]', size: 'min(24vw, 20vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img4.png', position: 'bottom-[20%] right-[5%]', size: 'min(28vw, 30vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img11.png', position: 'bottom-[0%] left-[20%]', size: 'min(30vw, 30vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img6.png', position: 'top-[5%] left-[35%]', size: 'min(24vw, 20vh * 1.78)', z: 'z-[999]' },
    { src: '/hero/img18.png', position: 'bottom-[30%] left-[5%]', size: 'min(12vw, 18vh * 1.78)', z: 'z-[999]' },
  ];

  useEffect(() => {
    gsap.set(imageRefs.current, { autoAlpha: 0 });
    const tl = gsap.timeline({ repeat: -1 });
    timelineRef.current = tl;

    tl.to(imageRefs.current[0], { autoAlpha: 1, duration: 0.12, ease: "power2.out" }, 0)
      .to(imageRefs.current[1], { autoAlpha: 1, duration: 0.12, ease: "power2.out" }, "+=0.25")
      .to(imageRefs.current[2], { autoAlpha: 1, duration: 0.12, ease: "power2.out" }, "+=0.2")
      .to(imageRefs.current[0], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.35")
      .to(imageRefs.current[1], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.18")
      .to(imageRefs.current[3], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.15")
      .to(imageRefs.current[2], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.25")
      .to(imageRefs.current[4], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.18")
      .to(imageRefs.current[5], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.15")
      .to(imageRefs.current[6], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.15")
      .to(imageRefs.current[3], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.28")
      .to(imageRefs.current[4], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.12")
      .to(imageRefs.current[5], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.12")
      .to(imageRefs.current[7], { autoAlpha: 1, duration: 0.14, ease: "power2.out" }, "+=0.3")
      .to(imageRefs.current[6], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.25")
      .to(imageRefs.current[8], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.18")
      .to(imageRefs.current[9], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.18")
      .to(imageRefs.current[8], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.3")
      .to(imageRefs.current[7], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.15")
      .to(imageRefs.current[10], { autoAlpha: 1, duration: 0.12, ease: "power2.out" }, "-=0.08")
      .to(imageRefs.current[9], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.2")
      .to(imageRefs.current[11], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.18")
      .to(imageRefs.current[12], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.15")
      .to(imageRefs.current[13], { autoAlpha: 1, duration: 0.1, ease: "power2.out" }, "+=0.15")
      .to(imageRefs.current[11], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.3")
      .to(imageRefs.current[10], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.12")
      .to(imageRefs.current[12], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.12")
      .to(imageRefs.current[13], { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, "+=0.1")
      .to({}, { duration: 0.5 });

    return () => tl.kill();
  }, []);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.timeScale(speed);
    }
  }, [speed]);

  useEffect(() => {
    if (timelineRef.current) {
      isPlaying ? timelineRef.current.play() : timelineRef.current.pause();
    }
  }, [isPlaying]);

  // Loop de animación para efectos dinámicos
  useEffect(() => {
    let animationFrameId;
    const animate = () => {
      setAnimTime(Date.now());
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const resetEffects = () => {
    setEffects({
      glitch: 0,
      pixelate: 0,
      wave: 0,
      rotate: 0,
      shake: 0,
      scale: 0,
      skew: 0,
      invert: 0,
      flip: 0,
      perspective: 0,
    });
  };

  const applyRandomEffects = () => {
    setEffects({
      glitch: Math.random(),
      pixelate: Math.random(),
      wave: Math.random(),
      rotate: Math.random(),
      shake: Math.random(),
      scale: Math.random(),
      skew: Math.random(),
      invert: Math.random(),
      flip: Math.random(),
      perspective: Math.random(),
    });
  };

  return (
    <div className="w-screen h-screen relative bg-white overflow-hidden">
      {/* Controles */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
        {/* Panel principal */}
        <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="3" height="12" />
                  <rect x="10" y="2" width="3" height="12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 2 L13 8 L5 14 Z" />
                </svg>
              )}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Speed:</span>
              {[0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    speed === s ? 'bg-black text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-24 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
            />

            <div className="w-px h-6 bg-gray-300" />

            <button
              onClick={() => setShowEffects(!showEffects)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                showEffects ? 'bg-black text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              FX
            </button>
          </div>
        </div>

        {/* Panel de efectos */}
        {showEffects && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-4 max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">Effects</h3>
              <div className="flex gap-2">
                <button
                  onClick={applyRandomEffects}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-black text-white hover:bg-gray-800 transition-all"
                >
                  Random
                </button>
                <button
                  onClick={resetEffects}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Glitch */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Glitch</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.glitch}
                  onChange={(e) => setEffects({...effects, glitch: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.glitch * 100)}</span>
              </div>

              {/* Pixelate */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Blur</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.pixelate}
                  onChange={(e) => setEffects({...effects, pixelate: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.pixelate * 100)}</span>
              </div>

              {/* Wave */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Wave</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.wave}
                  onChange={(e) => setEffects({...effects, wave: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.wave * 100)}</span>
              </div>

              {/* Rotate */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Rotate</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.rotate}
                  onChange={(e) => setEffects({...effects, rotate: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.rotate * 100)}</span>
              </div>

              {/* Shake */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Shake</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.shake}
                  onChange={(e) => setEffects({...effects, shake: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.shake * 100)}</span>
              </div>

              {/* Scale */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Scale</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.scale}
                  onChange={(e) => setEffects({...effects, scale: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.scale * 100)}</span>
              </div>

              {/* Skew */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Skew</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.skew}
                  onChange={(e) => setEffects({...effects, skew: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.skew * 100)}</span>
              </div>

              {/* Invert */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Invert</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.invert}
                  onChange={(e) => setEffects({...effects, invert: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.invert * 100)}</span>
              </div>

              {/* Flip */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Flip</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.flip}
                  onChange={(e) => setEffects({...effects, flip: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.flip * 100)}</span>
              </div>

              {/* Perspective */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-20">Perspective</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.perspective}
                  onChange={(e) => setEffects({...effects, perspective: parseFloat(e.target.value)})}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                />
                <span className="text-xs text-gray-500 w-8 text-right">{Math.round(effects.perspective * 100)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Imágenes con efectos */}
      <div className="relative w-full h-full" style={{ perspective: '1000px' }}>
        {images.map((img, index) => {
          // Calcular efectos animados
          const time = animTime / 1000;
          const waveOffset = Math.sin(time * 3 + index * 0.5) * effects.wave * 40;
          const shakeX = Math.sin(time * 10 + index) * effects.shake * 15;
          const shakeY = Math.cos(time * 10 + index * 1.5) * effects.shake * 15;
          const rotateAnim = Math.sin(time * 2 + index * 0.3) * effects.rotate * 15;
          const scaleAnim = 1 + Math.sin(time * 2.5 + index * 0.4) * effects.scale * 0.3;
          const perspectiveX = Math.sin(time * 1.5 + index * 0.6) * effects.perspective * 45;
          const perspectiveY = Math.cos(time * 1.8 + index * 0.5) * effects.perspective * 30;

          return (
            <div
              key={index}
              ref={(el) => (imageRefs.current[index] = el)}
              className={`absolute ${img.position} ${img.z}`}
              style={{ 
                width: img.size,
                filter: `
                  contrast(${1 + effects.glitch * 0.5}) 
                  brightness(${1 + effects.glitch * 0.3})
                  blur(${effects.pixelate * 3}px)
                  hue-rotate(${effects.glitch > 0.5 ? Math.sin(time * 5) * effects.glitch * 180 : 0}deg)
                  invert(${effects.invert})
                `,
                transform: `
                  rotate(${rotateAnim}deg)
                  translateX(${shakeX}px)
                  translateY(${shakeY + waveOffset}px)
                  scale(${scaleAnim})
                  skew(${effects.skew * 20}deg, ${effects.skew * 10}deg)
                  scaleX(${effects.flip > 0.5 ? -1 : 1})
                  rotateY(${perspectiveY}deg)
                  rotateX(${perspectiveX}deg)
                `,
                transformStyle: 'preserve-3d',
              }}
            >
              <img 
                src={img.src} 
                className="w-full h-auto object-contain" 
                alt={`Foto ${index + 1}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}