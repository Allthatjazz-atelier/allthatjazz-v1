"use client";

import { useEffect, useState, useCallback } from "react";
import { useHomeSlider } from "@/components/HomeSlidersWrapper/HomeSliderWrapper";

export default function BerlinClock() {
  const [time, setTime] = useState("");
  const [spin, setSpin] = useState(false);
  const homeSlider = useHomeSlider();

  useEffect(() => {
    const updateTime = () => {
      const berlinTime = new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());

      setTime(berlinTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAvatarClick = useCallback(() => {
    if (homeSlider) {
      setSpin(false);
      requestAnimationFrame(() => setSpin(true));
      homeSlider.toggleMode();
    }
  }, [homeSlider]);

  const modeLabel =
    homeSlider?.mode === "ring"
      ? "Vista anillo — clic para vista mosaico"
      : "Vista mosaico — clic para vista anillo";

  return (
    <div className="flex items-center gap-1 text-[0.875rem] tracking-[-0.04em] text-black">
      <span>Berlin, {time}</span>
      <img
        src="/avatar/✦.svg"
        alt={homeSlider ? modeLabel : "avatar"}
        title={homeSlider ? modeLabel : undefined}
        onClick={homeSlider ? handleAvatarClick : undefined}
        onAnimationEnd={() => setSpin(false)}
        className={`w-[14px] h-[14px] pointer-events-auto ${
          homeSlider ? "cursor-pointer" : ""
        } ${homeSlider ? "" : "transition-transform duration-700 ease-in-out hover:rotate-[360deg]"}`}
        style={{
          transformOrigin: "center",
          animation: spin
            ? "atj-avatar-spin 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards"
            : "none",
        }}
      />
      <style>{`
        @keyframes atj-avatar-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}