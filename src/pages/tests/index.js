
import HeaderFooter17 from "@/components/menu/index17";
import Space3D from "@/components/Space3D/Space3D";
import GooeyMorph from "@/components/tools/GooeyMorph";
import NewSpace3dFocus from "@/components/Space3D/NewSpace3dFocus";
import NewSpace3dFocus_2 from "@/components/Space3D/NewSpace3dFocus_2";
import HorizontalSlider from "@/components/horizontalslider";
import AquaSliderWithHero6 from "@/components/aqua/AquaSliderWithHero7";
import DynamicGallery3 from "@/components/dinamiclayouthero/index3";

export default function Tests() {


  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter17>
        {/* <Space3D /> */}
        {/* <GooeyMorph /> */}
        {/* <NewSpace3dFocus_2 /> */}
        {/* <HorizontalSlider /> */}
       <DynamicGallery3 />
      </HeaderFooter17>
    </div>
  );
}
