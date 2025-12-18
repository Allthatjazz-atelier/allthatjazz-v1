export default function SliderHero2() {
  return(
    <div className="w-screen h-screen relative bg-gray-100 overflow-hidden">
      {/* Contenedor absoluto */}
      <div className="absolute inset-0">
        
        {/* Imagen 1 */}
        <div 
          className="absolute z-[997]"
          style={{
            top: '20vh',
            left: '30vw',
            width: '22vw',
            height: '22vw'
          }}>
          <img 
            src="/hero/img19.png" 
            className="w-full h-full object-contain "
            alt="Imagen 1"
          />
        </div>
        
        {/* Imagen 2 */}
        <div 
          className="absolute z-[998]"
          style={{
            top: '30vh',
            left: '44vw',
            width: '18vw',
            height: '30vw'
          }}>
          <img 
            src="/hero/img9.png" 
            className="w-full h-full object-contain "
            alt="Imagen 2"
          />
        </div>
        
        {/* Imagen 3 */}
        <div 
          className="absolute z-[999]"
          style={{
            top: '10vh',
            left: '55vw',
            width: '40vw',
            height: '40vw'
          }}>
          <img 
            src="/hero/img10.png" 
            className="w-full h-full object-contain "
            alt="Imagen 3"
          />
        </div>
        
        {/* Imagen 4 */}
        <div 
          className="absolute z-[999]"
          style={{
            top: '35vh',
            left: '10vw',
            width: '25vw',
            height: '25vw'
          }}>
          <img 
            src="/hero/img14.png" 
            className="w-full h-full object-contain opacity-0"
            alt="Imagen 4"
          />
        </div>

        {/* Imagen 5 */}
        <div 
          className="absolute z-[999]"
          style={{
            top: '0vh',
            left: '55vw',
            width: '23vw',
            height: '23vw'
          }}>
          <img 
            src="/hero/img16.png" 
            className="w-full h-full object-contain opacity-0"
            alt="Imagen 5"
          />
        </div>

        {/* Imagen 6 */}
        <div 
          className="absolute z-[999]"
          style={{
            bottom: '2vh',
            right: '0vw',
            width: '18vw',
            height: '18vw'
          }}>
          <img 
            src="/hero/img15.png" 
            className="w-full h-full object-contain opacity-0"
            alt="Imagen 6"
          />
        </div>

        {/* Imagen 7 */}
        <div 
          className="absolute z-[999]"
          style={{
            bottom: '5vh',
            left: '70vw',
            width: '20vw',
            height: '20vw'
          }}>
          <img 
            src="/hero/img13.png" 
            className="w-full h-full object-contain opacity-0"
            alt="Imagen 7"
          />
        </div>
      </div>
    </div>
  )
}