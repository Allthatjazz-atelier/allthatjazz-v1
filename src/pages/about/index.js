import Hero3 from "@/components/hero/index3";
import Preloader from "@/components/preloader";
import Preloader2 from "@/components/preloader/index2";
import Preloader3 from "@/components/preloader/index3";
import Preloader4 from "@/components/preloader/index4";
import RoundedAnimatedSlider from "@/components/roundedanimatedslider";
import Slider3 from "@/components/slider/index3";
import SliderMove from "@/components/slidermove";
import SpinSlider from "@/components/spinslider";



export default function About() {

  const images = [
    "/assets/img31.jpeg",
    "/assets/img41.jpeg",
    "/assets/img89.jpeg",
    "/assets/img25.jpeg",
    "/assets/img2.jpeg",
    "/assets/img85.jpeg",
    "/assets/img84.jpeg",
    "/assets/img89.jpeg",
    "/assets/img16.jpeg",
    "/assets/img95.jpeg",
    "/assets/img98.jpeg",
    "/assets/img20.jpeg",
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <RoundedAnimatedSlider images={images} />
    </div>
  );
}
