import HeaderFooter17 from "@/components/menu/index17";

export default function Home() {
  return null;   // la escena la monta ViewStage, fuera de la ruta
}

// Wrapper ESTRUCTURALMENTE IDÉNTICO al de /space y /grid (mismo div + mismo
// HeaderFooter17) para que React preserve la instancia del shell al navegar.
Home.getLayout = function getLayout(page) {
  return (
    <div className="h-full w-full overflow-hidden">
      <HeaderFooter17 heroMode="final">{page}</HeaderFooter17>
    </div>
  );
};
