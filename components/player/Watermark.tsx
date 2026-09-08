/**
 * components/player/Watermark.tsx — the MTech Distributors mark pinned to the bottom-right
 * corner of the stage on every playing screen. Sits inside RotationRoot so it follows the
 * screen's orientation and rotation. The logo asset has a baked-in white ground, so it is
 * shown on a small white chip rather than blended into the content.
 */
export function Watermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-[2vmin] bottom-[2vmin] z-20 rounded-md bg-white p-1 opacity-90 shadow-md"
    >
      <img
        src="/mtech-logo.png"
        alt=""
        draggable={false}
        className="block h-[clamp(20px,3vmin,42px)] w-auto"
      />
    </div>
  )
}
