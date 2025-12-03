"use client";

import TextAnimation from "../tools/TextAnimation";

export default function AboutSection() {
  return (
    <div className="w-full h-screen flex flex-col text-[0.875rem] tracking-[-0.04em] items-center justify-start pt-12 px-4 leading-none bg-black text-white">
      <div className="flex flex-col w-full max-w-3xl mx-auto">
        {/* Primer bloque */}
        <div className="flex flex-col gap-4">
          <TextAnimation>
            <p>
              Allthatjazz is a creative studio, based in Berlin and working world wide.
            </p>
          </TextAnimation>
          <TextAnimation>
            <p>
              Our practice is rooted in explorative and visual craft.
            </p>
          </TextAnimation>
          <TextAnimation>
            <p>
              We are specialized in shaping visual narratives and digital experiences in the fields of culture, fashion, lifestyle and multimedia. Helping brands and artists to elevate their work and impact.
            </p>
          </TextAnimation>
        </div>

        {/* Bloque de clientes */}
        <div className="flex flex-col gap-2 mt-6">
          <TextAnimation>
            <p>Clients</p>
          </TextAnimation>
          <TextAnimation>
            <p>
              Bisous Bisous | Johnny Carretes | MM Discos | Playground Goodies | Divorce From New York
            </p>
          </TextAnimation>
        </div>

        {/* Equipo */}
        <div className="flex flex-col gap-2 mt-12">
          <TextAnimation>
            <p>We are</p>
          </TextAnimation>
          <div className="flex flex-col">
            <TextAnimation>
              <p>Joaquin Diaz</p>
            </TextAnimation>
            <TextAnimation>
              <p>· Creative direction and design</p>
            </TextAnimation>
          </div>
          <div className="flex flex-col">
            <TextAnimation>
              <p>Kiko Climent</p>
            </TextAnimation>
            <TextAnimation>
              <p>· Code</p>
            </TextAnimation>
          </div>
        </div>

        {/* Contacto */}
        <div className="flex flex-col gap-2 mt-8">
          <div>
            <TextAnimation>
              <p>Contact</p>
            </TextAnimation>
            <TextAnimation>
              <p>info@allthatjazz.com</p>
            </TextAnimation>
          </div>
          <div>
            <TextAnimation>
              <p>Insta</p>
            </TextAnimation>
            <TextAnimation>
              <p>@allthatjazz.atellier</p>
            </TextAnimation>
          </div>
        </div>
      </div>
    </div>
  );
}
