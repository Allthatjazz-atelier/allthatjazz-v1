"use client";

import { useEffect, useState } from "react";

export default function BerlinClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const berlinTime = new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date());

      setTime(berlinTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1 text-[0.875rem] text-black">
      <span>Berlin, {time}</span>
      <img
        src="/avatar/✦.svg"
        alt="avatar"
        className="w-[14px] h-[14px] pointer-events-auto transition-transform duration-700 ease-in-out hover:rotate-[360deg]"
        style={{ transformOrigin: "center" }}
      />
    </div>
  );
}