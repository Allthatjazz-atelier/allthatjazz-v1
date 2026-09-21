import HeaderFooter17 from "@/components/menu/index17";
import RingSlider5 from "@/components/ring/RingSlider5";

export default function Ring() {
  return <RingSlider5 />;
}

// Shell persistente: el wrapper debe ser ESTRUCTURALMENTE IDÉNTICO en las 3
// rutas (mismo div + mismo HeaderFooter17) para que React preserve la instancia
// del shell al navegar y solo intercambie la escena (los children).
Ring.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter17 heroMode="ring">{page}</HeaderFooter17>
    </div>
  );
};
