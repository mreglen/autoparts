/** Neutral white background shared by public pages. */
export default function PageAmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 bg-white" aria-hidden />
  );
}
