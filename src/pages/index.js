
import AnimatedCursor from "@/components/animatedcursor";
import TrailWrapper from "@/components/animatedcursor/wrapper";
import AquaSlider from "@/components/aqua/AquaSlider";
import AquaSliderWithHero from "@/components/aqua/AquaSliderWithHero";
import AquaSliderWithHero2 from "@/components/aqua/AquaSliderWithHero2";
import AquaSliderWithHero3 from "@/components/aqua/AquaSliderWithHero3";
import AquaSliderWithHero4 from "@/components/aqua/AquaSliderWithHero4";
import AquaSliderWithHero5 from "@/components/aqua/AquaSliderWithHero5";
import AquaSliderWithHero6 from "@/components/aqua/AquaSliderWithHero6";
import AquaSliderWithHero7 from "@/components/aqua/AquaSliderWithHero7";
import Content from "@/components/content";
import Content2 from "@/components/content/index2";
import Content3 from "@/components/content/index3";
import Content4 from "@/components/content/index4";
import DynamicGallery from "@/components/dinamiclayouthero";
import DynamicGallery2 from "@/components/dinamiclayouthero/index2";
import DynamicGallery3 from "@/components/dinamiclayouthero/index3";
import Hero5Motion from "@/components/hero/index5";
import Hero6Motion from "@/components/hero/index6";
import HorizontalSlider from "@/components/horizontalslider";
import HorizontalSliderWrapper from "@/components/horizontalslider/horizontalwrapper";
import HeaderFooter10 from "@/components/menu/index10";
import HeaderFooter11 from "@/components/menu/index11";
import HeaderFooter5 from "@/components/menu/index5";
import HeaderFooter6 from "@/components/menu/index6";
import HeaderFooter7 from "@/components/menu/index7";
import HeaderFooter8 from "@/components/menu/index8";
import HeaderFooter9 from "@/components/menu/index9";
import RoundedAnimatedSlider from "@/components/roundedanimatedslider";
import RoundedAnimatedSlider2 from "@/components/roundedanimatedslider/index2";
import RoundedAnimatedSlider3 from "@/components/roundedanimatedslider/index3";
import FullFieldImageSlider from "@/components/roundedanimatedslider/index4";
import RoundedAnimatedSlider5 from "@/components/roundedanimatedslider/index5";
import RoundedAnimatedSlider6 from "@/components/roundedanimatedslider/index6";
import SliderHero from "@/components/sliderhero";
import SliderHero5 from "@/components/sliderhero/index5";
import SliderHero6 from "@/components/sliderhero/index6";
import PaperWindEffect from "@/components/threehero/index2";
import PaperWindEffect2 from "@/components/threehero/index3";
import ThreeSlider from "@/components/threeslider";
import HeroCarousel_Responsive from "@/components/threeslider/index12";
import HeroCarousel_Responsive2 from "@/components/threeslider/index13";
import HeroCarousel_Responsive3 from "@/components/threeslider/index14";
import HeroCarousel_Responsive4 from "@/components/threeslider/index15";
import HeroCarousel_Responsive5 from "@/components/threeslider/index16";
import HeroCarousel from "@/components/threeslider/index2";
import HeroCarousel2 from "@/components/threeslider/index3";
import HeroCarousel3 from "@/components/threeslider/index4";
import HeroCarousel4 from "@/components/threeslider/index5";
import HeroCarousel5 from "@/components/threeslider/index6";
import HeroCarousel6 from "@/components/threeslider/index7";
import VerticalSlider from "@/components/verticalslider";
import VerticalSlider2 from "@/components/verticalslider/index2";
import FinalSlider from "@/components/final/FinalSlider";
import FinalSlider2 from "@/components/final/FinalSlider2";

export default function Home() {

  const images = [
    "/hero/img1.png",
    "/hero/img2.png",
    "/hero/img3.png",
    "/hero/img4.png",
    "/hero/img5.png",
    "/hero/img6.png",
    "/hero/img7.png",
    "/hero/img8.png",
    "/hero/img9.png",
    "/hero/img10.png",
    "/hero/img11.png",
    "/hero/img12.png",
    "/hero/img13.png",
    "/hero/img14.png",
    "/hero/img15.png",
    "/hero/img16.png",
    "/hero/img17.png",
    "/hero/img18.png",
    "/hero/img19.png",
  ];

  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter11>
        {/* <RoundedAnimatedSlider2 images={images} /> */}
        {/* <AnimatedCursor /> */}
        {/* <TrailWrapper /> */}
        {/* <HorizontalSlider /> */}
        {/* <HorizontalSliderWrapper /> */}
        {/* <VerticalSlider2 /> */}
        {/* <DynamicGallery3 /> */}
        {/* <SliderHero6 /> */}
        {/* <ThreeSlider /> */}
        {/* <PaperWindEffect /> */}
        {/* <HeroCarousel6 /> */}
        {/* <HeroCarousel5 /> */}
        {/* <HeroCarousel4 /> */}
        {/* <HeroCarousel3 /> */}
        {/* <HeroCarousel2 /> */}
        {/* <HeroCarousel_Responsive4 /> */}
        {/* <AquaSlider /> */}
        {/* <AquaSliderWithHero7  /> */}
        <FinalSlider2 />
        {/* <HeroCarousel /> */}
        {/* <Content4 /> */}
      </HeaderFooter11>
    </div>
  );
}
