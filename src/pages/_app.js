import "@/styles/globals.css";
import "@/styles/stylespreloaderwithoverlay.css";
import "@/styles/spincubestep.css";
// import "@/styles/spincube.css";
// import "@/styles/spinslider.css"
import HeaderFooter from "@/components/menu";
import { useEffect } from "react";
// import Lenis from "@studio-freight/lenis";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import HeaderFooter2 from "@/components/menu/index2";
import HeaderFooter3 from "@/components/menu/index3";
import CustomCursor from "@/components/tools/CustomCursor";
import HeaderFooter5 from "@/components/menu/index5";
import RouteTransition from "@/components/transition/RouteTransition";

gsap.registerPlugin(ScrollTrigger);

export default function App({ Component, pageProps }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    lenis.on("scroll", () => {
      ScrollTrigger.update();
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  // Patrón "persistent layout" de Pages Router: si la página define getLayout,
  // su shell (HeaderFooter16) queda montado y persiste entre navegaciones —
  // solo se intercambia la escena. Las páginas sin getLayout (p. ej. la home
  // actual) caen al identity y se comportan como antes.
  const getLayout = Component.getLayout ?? ((page) => page);

  return (
    <>
      {/* <div id="header-footer-wrapper" style={{ opacity: 0 }}> */}
      {/* <div className="HeaderFooter">
        <HeaderFooter5 />
      </div> */}
      {/* </div> */}
      <CustomCursor />
      <RouteTransition />
      {getLayout(<Component {...pageProps} />)}
    </>
  );
}
