"use client";

import { useEffect, useMemo } from "react";
import { useOptimizedMedia } from "@/hooks/useOptimizedMediaNew";

const DETAIL_MAX = 400;
const DETAIL_GROW = 1.25;
const DETAIL_PAD = 12;
const TOP_INSET = 88;
const BOTTOM_INSET = 132;

const pickSrc = (sources) => {
  if (!sources?.length) return null;
  if (typeof document === "undefined") return sources[0]?.src || null;
  const v = document.createElement("video");
  return (sources.find((s) => v.canPlayType(s.type) !== "") || sources[0])?.src || null;
};

const toFieldUrl = (url) => (url || "").replace(".desktop.", ".mobile.");

/**
 * Detalle DOM compartido con la rejilla: mismo `<img srcset>` / `<video>`.
 * La galaxia WebGL hace el gesto; el color lo pinta el navegador.
 */
export default function ATJ_GalaxyDetail({ piece, onClose, vvTop = 0, vvHeight }) {
  const { getImageSet, getVideo } = useOptimizedMedia();

  const layout = useMemo(() => {
    if (!piece || typeof window === "undefined") return null;
    const vh = vvHeight || window.innerHeight;
    const vw = window.innerWidth;
    const bandH = Math.max(120, vh - TOP_INSET - BOTTOM_INSET);
    const ar = piece.ar && piece.ar > 0 ? piece.ar : 0.8;
    const techo = DETAIL_MAX * DETAIL_GROW;
    let fw = Math.min(vw * 0.92 - DETAIL_PAD * 2, techo);
    let fh = fw / ar;
    if (fh > bandH - DETAIL_PAD * 2 - 14) {
      fh = bandH - DETAIL_PAD * 2 - 14;
      fw = fh * ar;
    }
    const boxW = fw + DETAIL_PAD * 2;
    const boxH = fh + DETAIL_PAD * 2 + 14;
    const top = vvTop + TOP_INSET + Math.max(0, (bandH - boxH) / 2);
    const left = (vw - boxW) / 2;
    return { left, top, boxW, boxH, w: fw, h: fh };
  }, [piece, vvHeight, vvTop]);

  useEffect(() => {
    if (!piece) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [piece, onClose]);

  if (!piece || !layout) return null;

  const set = piece.type === "image" ? getImageSet(piece.name) : null;
  const vid = piece.type === "video" ? getVideo(piece.name) : null;
  const esVideo = Boolean(vid?.sources?.length);
  const poster = vid?.poster || null;

  return (
    <>
      <div
        className="atj-gal-detail__scrim"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        aria-hidden="true"
      />
      <div
        className="atj-gal-detail"
        role="dialog"
        aria-label={piece.name}
        onClick={onClose}
        style={{
          left: `${layout.left}px`,
          top: `${layout.top}px`,
          width: `${layout.boxW}px`,
          height: `${layout.boxH}px`,
        }}
      >
        <div
          className="atj-gal-detail__media"
          style={{ width: `${layout.w}px`, height: `${layout.h}px` }}
        >
          {esVideo ? (
            <>
              {poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="atj-gal-detail__base" src={poster} alt="" aria-hidden="true" />
              )}
              <video
                className="atj-gal-detail__full"
                src={toFieldUrl(pickSrc(vid.sources))}
                muted
                loop
                playsInline
                autoPlay
                onPlaying={(e) => { e.currentTarget.style.opacity = "1"; }}
              />
            </>
          ) : (
            <>
              {set?.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="atj-gal-detail__base" src={set.src} alt="" aria-hidden="true" />
              )}
              {set?.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="atj-gal-detail__full"
                  src={set.src}
                  srcSet={set.srcSet || undefined}
                  sizes={`${Math.round(layout.w)}px`}
                  alt={piece.label || piece.name}
                  decoding="async"
                  onLoad={(e) => { e.currentTarget.style.opacity = "1"; }}
                />
              )}
            </>
          )}
        </div>
        <figcaption className="atj-gal-detail__cap">{piece.name}</figcaption>
      </div>
      <style>{`
        .atj-gal-detail__scrim {
          position: fixed;
          inset: 0;
          z-index: 9996;
          cursor: pointer;
        }
        .atj-gal-detail {
          position: fixed;
          z-index: 9997;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: ${DETAIL_PAD}px;
          background: var(--atj-bg);
          cursor: pointer;
          animation: atj-gal-detail-in 120ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes atj-gal-detail-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .atj-gal-detail__media {
          position: relative;
          flex: 0 0 auto;
          overflow: hidden;
          background: var(--atj-surface);
        }
        .atj-gal-detail__base,
        .atj-gal-detail__full {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
        }
        .atj-gal-detail__full {
          opacity: 0;
          transition: opacity 240ms ease;
        }
        .atj-gal-detail__cap {
          margin-top: 8px;
          height: 14px;
          max-width: 100%;
          font: 400 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: -0.02em;
          color: var(--atj-fg);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (prefers-reduced-motion: reduce) {
          .atj-gal-detail { animation: none; }
          .atj-gal-detail__full { transition: none; }
        }
      `}</style>
    </>
  );
}
