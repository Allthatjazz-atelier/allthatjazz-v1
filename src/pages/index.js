import HeaderFooter16 from "@/components/menu/index16";
import FinalSlider4 from "@/components/final/FinalSlider4";

// La home ES la vista slider. Se elimina el dual-slider anterior
// (HomeSliderProvider + HomeSliderWrapper montaban FinalSlider4 + RingSlider4 a la
// vez → el caso más pesado de GPU). Ahora `/` monta una sola escena, igual que el
// resto de rutas, bajo el shell persistente.
export default function Home() {
  return <FinalSlider4 />;
}

// Wrapper ESTRUCTURALMENTE IDÉNTICO al de /ring y /space (mismo div + mismo
// HeaderFooter16) para que React preserve la instancia del shell al navegar.
Home.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter16 heroMode="final">{page}</HeaderFooter16>
    </div>
  );
};
