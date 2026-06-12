import HeaderFooter16 from "@/components/menu/index16";
import Space3D from "@/components/Space3D/Space3D";

export default function Space() {
  return <Space3D />;
}

// Shell persistente: el wrapper debe ser ESTRUCTURALMENTE IDÉNTICO en las 3
// rutas (mismo div + mismo HeaderFooter16) para que React preserve la instancia
// del shell al navegar y solo intercambie la escena (los children).
Space.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter16 heroMode="space">{page}</HeaderFooter16>
    </div>
  );
};
