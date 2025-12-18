import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function SliderHero3() {
  const img1Ref = useRef(null);
  const img2Ref = useRef(null);
  const img3Ref = useRef(null);
  const img4Ref = useRef(null);
  const img5Ref = useRef(null);
  const img6Ref = useRef(null);
  const img7Ref = useRef(null);
  const img8Ref = useRef(null);
  const img9Ref = useRef(null);
  const img10Ref = useRef(null);

  useEffect(() => {
    // Estado inicial: todas fuera del viewport por abajo
    gsap.set([img1Ref.current, img2Ref.current, img3Ref.current, img4Ref.current, 
              img5Ref.current, img6Ref.current, img7Ref.current, img8Ref.current, 
              img9Ref.current, img10Ref.current], {
      y: '150vh' // Empiezan abajo, fuera de la pantalla
    });

    // Crear timeline con loop infinito
    const tl = gsap.timeline({ repeat: -1 });

    // Secuencia con entradas desde abajo y salidas por arriba:
    // Inicio - tres fotos entran
    tl.to(img1Ref.current, { y: 0, duration: 0.5, ease: "power2.out" }, 0)
      .to(img2Ref.current, { y: 0, duration: 0.5, ease: "power2.out" }, "+=0.25")
      .to(img3Ref.current, { y: 0, duration: 0.5, ease: "power2.out" }, "+=0.2")
      
      // Salidas por arriba
      .to(img1Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.35")
      .to(img2Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.18")
      
      // img4 entra
      .to(img4Ref.current, { y: 0, duration: 0.5, ease: "power2.out" }, "+=0.15")
      .to(img3Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.25")
      
      // Aceleración - tres imágenes seguidas rápido
      .to(img5Ref.current, { y: 0, duration: 0.45, ease: "power2.out" }, "+=0.18")
      .to(img6Ref.current, { y: 0, duration: 0.45, ease: "power2.out" }, "+=0.15")
      .to(img7Ref.current, { y: 0, duration: 0.45, ease: "power2.out" }, "+=0.15")
      
      // Desaparición rápida en cascada por arriba
      .to(img4Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.28")
      .to(img5Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.12")
      .to(img6Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.12")
      
      // Momento dramático con img8 grande
      .to(img8Ref.current, { y: 0, duration: 0.55, ease: "power2.out" }, "+=0.3")
      .to(img7Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.25")
      
      // Final rápido
      .to(img9Ref.current, { y: 0, duration: 0.45, ease: "power2.out" }, "+=0.18")
      .to(img10Ref.current, { y: 0, duration: 0.45, ease: "power2.out" }, "+=0.18")
      
      // Cierre en cascada
      .to(img9Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.3")
      .to(img8Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.15")
      .to(img10Ref.current, { y: '-150vh', duration: 0.4, ease: "power2.in" }, "+=0.12")
      
      // Pausa antes de reiniciar - resetear todas las posiciones
      .to({}, { 
        duration: 0.5,
        onComplete: () => {
          // Resetear todas las imágenes a su posición inicial (abajo)
          gsap.set([img1Ref.current, img2Ref.current, img3Ref.current, img4Ref.current, 
                    img5Ref.current, img6Ref.current, img7Ref.current, img8Ref.current, 
                    img9Ref.current, img10Ref.current], {
            y: '150vh'
          });
        }
      });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="w-screen h-screen relative bg-white overflow-hidden">
      <div className="relative w-full h-full">
        
        {/* Imagen 1 */}
        <div ref={img1Ref} className="absolute top-[38%] left-[43%] -translate-x-1/2 -translate-y-1/2 z-[997]" 
             style={{width: 'min(20vw, 20vh * 1.78)'}}>
          <img src="/hero/img19.png" className="w-full h-auto object-contain" alt="Foto 1"/>
        </div>
        
        {/* Imagen 2 */}
        <div ref={img2Ref} className="absolute top-[60%] left-[55%] -translate-x-1/2 -translate-y-1/2 z-[998]"
             style={{width: 'min(15vw, 15vh * 1.78)'}}>
          <img src="/hero/img9.png" className="w-full h-auto object-contain" alt="Foto 2"/>
        </div>
        
        {/* Imagen 3 */}
        <div ref={img3Ref} className="absolute top-[50%] left-[75%] -translate-x-1/2 -translate-y-1/2 z-[999]"
             style={{width: 'min(40vw, 40vh * 1.78)'}}>
          <img src="/hero/img10.png" className="w-full h-auto object-contain" alt="Foto 3"/>
        </div>
        
        {/* Imagen 4 */}
        <div ref={img4Ref} className="absolute top-[35%] left-[10%] -translate-x-1/2 -translate-y-1/2 z-[999]"
             style={{width: 'min(25vw, 25vh * 1.78)'}}>
          <img src="/hero/img14.png" className="w-full h-auto object-contain" alt="Foto 4"/>
        </div>

        {/* Imagen 5 */}
        <div ref={img5Ref} className="absolute top-0 left-[45%] -translate-x-1/2 z-[999]"
             style={{width: 'min(20vw, 20vh * 1.78)'}}>
          <img src="/hero/img16.png" className="w-full h-auto object-contain" alt="Foto 5"/>
        </div>

        {/* Imagen 6 */}
        <div ref={img6Ref} className="absolute bottom-[10%] right-[10%] z-[999]"
             style={{width: 'min(18vw, 18vh * 1.78)'}}>
          <img src="/hero/img15.png" className="w-full h-auto object-contain" alt="Foto 6"/>
        </div>

        {/* Imagen 7 */}
        <div ref={img7Ref} className="absolute bottom-[15%] left-[65%] z-[999]"
             style={{width: 'min(18vw, 18vh * 1.78)'}}>
          <img src="/hero/img13.png" className="w-full h-auto object-contain" alt="Foto 7"/>
        </div>

        {/* Imagen 8 */}
        <div ref={img8Ref} className="absolute bottom-[30%] left-[35%] z-[999]"
             style={{width: 'min(48vw, 36vh * 1.78)'}}>
          <img src="/hero/img12.png" className="w-full h-auto object-contain" alt="Foto 8"/>
        </div>

        {/* Imagen 9 */}
        <div ref={img9Ref} className="absolute bottom-[15%] left-[65%] z-[999]"
             style={{width: 'min(24vw, 20vh * 1.78)'}}>
          <img src="/hero/img5.png" className="w-full h-auto object-contain" alt="Foto 9"/>
        </div>

        {/* Imagen 10 */}
        <div ref={img10Ref} className="absolute bottom-[60%] left-[20%] z-[999]"
             style={{width: 'min(24vw, 20vh * 1.78)'}}>
          <img src="/hero/img17.png" className="w-full h-auto object-contain" alt="Foto 10"/>
        </div>

      </div>
    </div>
  );
}