/** Мягкий фон в духе Yandex Soft UI — тёплые пятна без отвлечения от контента. */
export default function HomeAmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#fff4cc]/70 blur-3xl sm:h-96 sm:w-96" />
      <div className="absolute -right-16 top-32 h-64 w-64 rounded-full bg-brand-100/60 blur-3xl sm:h-80 sm:w-80" />
      <div className="absolute bottom-20 left-1/3 h-56 w-56 rounded-full bg-[#e8f4ff]/80 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#fefdfb] via-[#f7f8fa] to-[#f3f4f8]" />
    </div>
  );
}
