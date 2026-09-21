import HeaderFooter17 from "@/components/menu/index17";
import VideoSlider from "@/components/final/VideoSlider";

// La home ES la vista slider. Se elimina el dual-slider anterior
// (HomeSliderProvider + HomeSliderWrapper montaban FinalSlider4 + RingSlider4 a la
// vez → el caso más pesado de GPU). Ahora `/` monta una sola escena, igual que el
// resto de rutas, bajo el shell persistente.
export default function Home() {
  return <VideoSlider />;
}

// Wrapper ESTRUCTURALMENTE IDÉNTICO al de /ring y /space (mismo div + mismo
// HeaderFooter17) para que React preserve la instancia del shell al navegar.
Home.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter17 heroMode="final">{page}</HeaderFooter17>
    </div>
  );
};
