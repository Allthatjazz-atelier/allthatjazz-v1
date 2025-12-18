import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function SliderHero() {
  const imageRefs = useRef([]);

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
    // Estado inicial: todas ocultas
    gsap.set(imageRefs.current, { autoAlpha: 0 });

    // Crear timeline con loop infinito
    const tl = gsap.timeline({ repeat: -1 });

    // Secuencia exacta como el original
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

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="w-screen h-screen relative bg-white overflow-hidden">
      <div className="relative w-full h-full">
        {images.map((img, index) => (
          <div
            key={index}
            ref={(el) => (imageRefs.current[index] = el)}
            className={`absolute ${img.position} ${img.z}`}
            style={{ width: img.size }}
          >
            <img 
              src={img.src} 
              className="w-full h-auto object-contain" 
              alt={`Foto ${index + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}