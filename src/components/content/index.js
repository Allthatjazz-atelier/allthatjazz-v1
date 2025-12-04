export default function Content () {
  return(
    <div className="w-[100vw] h-full md:h-[100vh] bg-white pl-4 pr-4 md:pr-8 pt-4">
      <div className="flex flex-col md:flex-row gap-4 items-start justify-center text-[0.875rem] tracking-[-0.04em]">
        <div className="flex flex-col gap-2 basis-[32%]">
          <img src="/hero/img12.png"
              className="object-contain w-full h-full"/>
          <p>Johnny Carretes, Creative direction, Web, 2025 (Berlin)</p>
        </div>
        <div className="flex flex-col gap-2 basis-[32%]">
          <img src="/hero/img10.png"
              className="object-contain w-full h-full"/>
          <p>Vilarnau, Creative direction, Web, 2025 (Berlin)</p>
        </div>
        <div className="flex flex-col gap-2 basis-[35%]">
          <img src="/hero/img14.png"
              className="object-contain w-full h-full"/>
          <p>MM Discos, Creative direction, Identity, 2025 (Barcelona - Berlin)</p>
        </div>    
      </div>
    </div>
  )
}