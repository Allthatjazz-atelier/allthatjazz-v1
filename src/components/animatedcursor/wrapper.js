"use client";

import { useEffect, useState } from "react";
import AnimatedCursor from ".";
import AnimatedCursorMobile from "./index2";
export default function TrailWrapper() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.innerWidth > 1000);

    const onResize = () => {
      setIsDesktop(window.innerWidth > 1000);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isDesktop ? <AnimatedCursor /> : <AnimatedCursorMobile />;
}
