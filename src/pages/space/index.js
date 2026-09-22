import HeaderFooter17 from "@/components/menu/index17";
import Space3dFocus_Opt from "@/components/Space3D/Space3dFocus_Opt";

export default function Space() {
  return <Space3dFocus_Opt />;
}

// Shell persistente: el wrapper debe ser ESTRUCTURALMENTE IDÉNTICO en las 3
// rutas (mismo div + mismo HeaderFooter17) para que React preserve la instancia
// del shell al navegar y solo intercambie la escena (los children).
Space.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter17 heroMode="space">{page}</HeaderFooter17>
    </div>
  );
};
