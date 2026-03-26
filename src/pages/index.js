
import HeaderFooter15 from "@/components/menu/index15";
import { HomeSliderProvider } from "@/components/HomeSlidersWrapper/HomeSliderWrapper";
import HomeSliderWrapper from "@/components/HomeSlidersWrapper/HomeSliderWrapper";

export default function Home() {
  return (
    <div className="h-full w-full overflow-hidden">
      <HomeSliderProvider>
        <HeaderFooter15>
          {/* Sliders: avatar Berlin (arriba) alterna FinalSlider4 ↔ RingSlider3 con transición */}
          <HomeSliderWrapper />
        </HeaderFooter15>
      </HomeSliderProvider>
    </div>
  );
}
