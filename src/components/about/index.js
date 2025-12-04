export default function AboutSection () {
  return(
    <div className="w-full h-screen gap-12 flex flex-col text-[0.875rem] md:text-[0.875rem] tracking-[-0.04em] items-center md: items-start justify-start pt-12 px-4 leading-none bg-black text-white">
      <div className="flex flex-col gap-4">
        <p className="flex text-justify">
          Allthatjazz is a creative collective, based in Berlin and working world wide. 
          Our practice is rooted in explorative and visual craft. 
          We are specialised in shaping visual narratives and digital experiences in the fields of culture, 
          fashion, lifestyle and multimedia. 
          We help brands and artists to elevate their work, engagement and impact.  
          Working 9 to 5, hustling 24/7 . For work related stuff, collaborations or inquires, please reach out at:  
        </p>
        <div className="flex flex-col">
          <p>Creative direction, strategy, design and code:</p>
          <p>Joaquin Diaz, Kiko  Climent, +++</p>
        </div>
        <div className="flex flex-col">
          <p>Contact:</p>
          <p>info@allthatjazz.com</p>
        </div>
        <p className="flex">SM: @allthatjazz.atelier</p>
      </div>
      <div className="flex flex-col gap-4">
        <p>Selected Projects:</p>
        <div className="flex-col uppercase text-[0.75rem] tracking-[-0.02em]">
          <p>Divorce from New York/High praise Records</p>
          <p>Johnny Carretes</p>
          <p>Vilarnau</p>
          <p>MM Discos</p>
          <p>Playground Goodies</p>
          <p>Bisous Bisous</p>
        </div>
        </div>    
    </div>
  )
}