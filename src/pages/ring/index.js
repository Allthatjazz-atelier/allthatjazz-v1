import HeaderFooter16 from "@/components/menu/index16";
import RingSlider4 from "@/components/ring/RingSLider4";

export default function Ring() {
  return <RingSlider4 />;
}

// Shell persistente: el wrapper debe ser ESTRUCTURALMENTE IDÉNTICO en las 3
// rutas (mismo div + mismo HeaderFooter16) para que React preserve la instancia
// del shell al navegar y solo intercambie la escena (los children).
Ring.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter16 heroMode="ring">{page}</HeaderFooter16>
    </div>
  );
};
