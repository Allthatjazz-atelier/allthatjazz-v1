import { Html, Head, Main, NextScript } from "next/document";
import { THEME_STORAGE_KEY } from "@/hooks/useTheme";

// Corre antes del primer paint: sin esto, el tema oscuro guardado entraría
// después de hidratar y se vería un flash blanco en cada carga.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var r=document.documentElement;r.dataset.atjTheme=t==="dark"?"dark":"light";if(t==="dark")r.classList.add("dark");}catch(e){}})();`;

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
