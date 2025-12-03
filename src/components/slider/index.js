const Slider1 = () => {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
        {/* Image1*/}
        <div className="absolute top-1/2 left-1/2 w-[100%] px-4 transform -translate-x-1/2 -translate-y-1/2 z-[1] opacity-1">
          <img
            src="/assets/img2.jpeg"
            className="w-full h-full object-contain"
            alt="img15" />
        </div>
        {/* Text */}
        <div className="absolute w-[100%] top-[77%] pl-4">
          <p className="text-[0.875rem] text-left">Explorations visuelles 2004-2025</p>
        </div>
        {/* Image2 */}
        <div className="absolute top-[55%] left-[41.2%] transform -translate-x-1/2 -translate-y-1/2 w-[75%] z-[2] ">
          <img
            src="/assets/img16.jpeg"
            className="w-full h-full object-contain"
            alt="img10"
            />
        </div>
        {/* Image3 */}
        <div className="absolute top-[35%] left-[66.3%] transform -translate-x-1/2 -translate-y-1/2 w-[60%] z-[3] ">
          <img
            src="/assets/img89.jpeg"
            className="w-full h-full object-contain"
            alt="img10"
            />
        </div>
        {/* Image4 */}
        <div className="absolute top-[27%] left-[33.8%] transform -translate-x-1/2 -translate-y-1/2 w-[60%] z-[4] opacity-1">
          <img
            src="/assets/img51.jpeg"
            className="w-full h-full object-contain"
            alt="img10"
            />
        </div>
        {/* Image5 */}
        <div className="absolute top-[60.9%] left-[68.9%] transform -translate-x-1/2 -translate-y-1/2 w-[55%] z-[] opacity-1">
          <img
            src="/assets/img98.jpeg"
            className="w-full h-full object-contain"
            alt="img10"
            />
        </div>
      </div>
  );
};

export default Slider1;
