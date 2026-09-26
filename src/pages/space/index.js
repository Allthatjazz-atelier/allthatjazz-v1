import HeaderFooter17 from "@/components/menu/index17";

export default function Space() {
  return null;   // la escena la monta ViewStage, fuera de la ruta
}

// Shell persistente: el wrapper debe ser ESTRUCTURALMENTE IDÉNTICO al de "/"
// (mismo div + mismo HeaderFooter17) para que React preserve la instancia
// del shell al navegar y solo intercambie la escena (los children).
Space.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter17 heroMode="space">{page}</HeaderFooter17>
    </div>
  );
};
