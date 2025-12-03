export default function AboutSection () {
  return(
    <div className="w-full h-screen flex flex-col text-[0.875rem] md:text-[1.375rem] tracking-[-0.04em] items-center md: items-start justify-start pt-12 px-4 leading-none bg-black text-white">
      <div className="flex flex-col">
        <div className="1 flex flex-col gap-4">
          <p className="flex">
            Allthatjazz is a creative studio, based in Berlin and working 
            world wide.
          </p>
          <p className="flex">
            Our practice is rooted in explorative and visual craft.
          </p>
          <p className="flex">
            We are specilised in shaping visual narratives and digital
            experiences in the fields of culture, fashion, lifestyle and
            multimeda. Helping brands and artists to elevate their work and impact.
          </p>
        </div>
        <div className="2 flex flex-col gap-4 mt-6">
          <p className="flex">Clients</p>
          <p className="flex">Bisous Bisous | Johnny Carretes | MM Discos | Playground 
            Goodies | Divorce From New York
          </p>
        </div>
        <div className="3 flex flex-col gap-4 mt-12">
          <p className="flex">We are</p>
          <div className="flex flex-col">
            <p className="flex">Joaquin Diaz</p>
            <p className="flex">· Creative direction and design</p>
          </div>
          <div className="flex flex-col">
            <p className="flex">Kiko Climent</p>
            <p className="flex">· Code</p>
          </div>
        </div>
        <div className="3 flex flex-col gap-4 mt-8">
          <div>
            <p className="flex">Contact</p>
            <p className="flex">info@allthatjazz.com</p>
          </div>
          <div>
            <p className="flex">Insta</p>
            <p className="flex">@allthatjazz.atellier</p>
          </div>
        </div>
      </div>
    </div>
  )
}