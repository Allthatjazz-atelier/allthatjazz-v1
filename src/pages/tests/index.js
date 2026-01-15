import HeroCarousel7 from "@/components/threeslider/index8";
import HeaderFooter8 from "@/components/menu/index8";
import HeroCarousel2_2 from "@/components/threeslider/index9";
import HeroCarousel2_3 from "@/components/threeslider/index10";
import HeroCarousel2_4 from "@/components/threeslider/index11";
import WebGlCarousel from "@/components/webglslider";

export default function Tests() {


  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter8>
        {/* <HeroCarousel2_3 /> */}
        {/* <HeroCarousel2_4 /> */}
        <WebGlCarousel />
      </HeaderFooter8>
    </div>
  );
}
