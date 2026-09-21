/**
 * Catálogo editorial de media para las 3 escenas activas.
 * Los `id` coinciden con el `name` (slug) de public/media-manifest.json.
 * useOptimizedMedia resuelve el derivado mobile/desktop + AVIF/WebP/H.264/VP9.
 */

export const SLIDER_IMAGE_GROUPS = [
  ["atj-webcontent-001", "atj-webcontent-002", "atj-webcontent-003"],
  ["atj-webcontent-004", "atj-webcontent-005", "atj-webcontent-006"],
  ["atj-webcontent-007", "atj-webcontent-008", "atj-webcontent-009"],
  ["atj-webcontent-010", "atj-webcontent-011", "atj-webcontent-012"],
  ["atj-webcontent-013", "atj-webcontent-014", "atj-webcontent-015"],
];

export const SLIDER_IMAGE_LABELS = [
  "Johnny Carretes",
  "Print Matter",
  "Studio Still",
  "Playground",
  "Editorial",
];

export const SLIDER_VIDEOS = [
  "atj-aboutmotion-01",
  "johnny-carretes-pr-reel",
  "dfny-jazzthetics-instareel-introtest01-1",
  "bisbismotion-portfolio-jun26",
  "portfolio-gallery-4-5",
];

export const SLIDER_VIDEO_LABELS = [
  "ATJ Motion",
  "Johnny Carretes",
  "DFNY",
  "Bis Bis",
  "Portfolio",
];

export const RING_IMAGES = [
  "atj-webcontent-016",
  "atj-webcontent-017",
  "atj-webcontent-018",
  "atj-webcontent-019",
  "atj-webcontent-020",
  "atj-webcontent-021",
  "atj-webcontent-022",
  "atj-webcontent-023",
  "atj-webcontent-024",
  "atj-webcontent-025",
  "atj-webcontent-026",
  "atj-webcontent-027",
  "atj-webcontent-028",
  "atj-webcontent-029",
  "atj-webcontent-030",
];

export const RING_VIDEOS = [
  "atj-aboutmotion-02",
  "atj-about-cuaderno",
  "dfny-instareel-02",
  "dfny-instareel-03",
  "dfny-sketches-flicker-04",
  "dfny-viz-raw-final-nobrand",
  "socarrat-showcase-test04",
  "mmd040-socarrat-pr-motion-2-comp",
];

export const SPACE_IMAGES = [
  ...Array.from({ length: 30 }, (_, i) => `atj-webcontent-${String(i + 1).padStart(3, "0")}`),
  "adec-scroll-11",
  "adec-scroll-12",
  "adec-scroll-13",
  "galaxy-bar-stickers",
  "galaxybar-explo-serviellets02",
  "atj-paper-mockup-02-nobg",
  "texture-ballon-9-bitmap",
  "img-3623",
  "img-3777-3",
  "img-3514",
  "img-5434",
  "img-5438",
  "img-5447",
];

export const SPACE_VIDEOS = [
  "socarrat-video-reel0826-nosound",
  "dfny-explo01",
  "test09",
  "test02-2",
  "movo-1080p-1536x1920-8",
  "img-3612",
];

/** Unión editorial de todos los vídeos del manifiesto, en orden de lectura. */
export const ALL_VIDEOS = [
  ...SLIDER_VIDEOS,
  ...RING_VIDEOS,
  ...SPACE_VIDEOS,
  "img-3614",
];

export const VIDEO_LABEL_BY_NAME = {
  "atj-aboutmotion-01": "ATJ Motion",
  "atj-aboutmotion-02": "ATJ Motion 02",
  "atj-about-cuaderno": "About Cuaderno",
  "johnny-carretes-pr-reel": "Johnny Carretes",
  "dfny-jazzthetics-instareel-introtest01-1": "DFNY",
  "dfny-instareel-02": "DFNY Reel 02",
  "dfny-instareel-03": "DFNY Reel 03",
  "dfny-sketches-flicker-04": "DFNY Flicker",
  "dfny-viz-raw-final-nobrand": "DFNY Viz",
  "dfny-explo01": "DFNY Explo",
  "bisbismotion-portfolio-jun26": "Bis Bis",
  "portfolio-gallery-4-5": "Portfolio",
  "socarrat-showcase-test04": "Socarrat Showcase",
  "mmd040-socarrat-pr-motion-2-comp": "Socarrat Motion",
  "socarrat-video-reel0826-nosound": "Socarrat Reel",
  "test09": "Test 09",
  "test02-2": "Test 02",
  "movo-1080p-1536x1920-8": "Movo",
  "img-3612": "IMG 3612",
  "img-3614": "IMG 3614",
};
