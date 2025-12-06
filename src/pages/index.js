
import AnimatedCursor from "@/components/animatedcursor";
import TrailWrapper from "@/components/animatedcursor/wrapper";
import Content from "@/components/content";
import Content2 from "@/components/content/index2";
import Content3 from "@/components/content/index3";
import Content4 from "@/components/content/index4";
import Hero5Motion from "@/components/hero/index5";
import Hero6Motion from "@/components/hero/index6";
import HorizontalSlider from "@/components/horizontalslider";
import HorizontalSliderWrapper from "@/components/horizontalslider/horizontalwrapper";
import HeaderFooter5 from "@/components/menu/index5";
import HeaderFooter6 from "@/components/menu/index6";
import HeaderFooter7 from "@/components/menu/index7";
import HeaderFooter8 from "@/components/menu/index8";
import RoundedAnimatedSlider from "@/components/roundedanimatedslider";
import RoundedAnimatedSlider2 from "@/components/roundedanimatedslider/index2";
import RoundedAnimatedSlider3 from "@/components/roundedanimatedslider/index3";
import FullFieldImageSlider from "@/components/roundedanimatedslider/index4";
import RoundedAnimatedSlider5 from "@/components/roundedanimatedslider/index5";
import RoundedAnimatedSlider6 from "@/components/roundedanimatedslider/index6";

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
      <HeaderFooter8>
        {/* <RoundedAnimatedSlider6 images={images} /> */}
        {/* <AnimatedCursor /> */}
        {/* <TrailWrapper /> */}
        {/* <HorizontalSlider /> */}
        <HorizontalSliderWrapper />
        {/* <Content4 /> */}
      </HeaderFooter8>
    </div>
  );
}
