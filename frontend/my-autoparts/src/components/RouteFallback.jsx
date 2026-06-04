export default function RouteFallback() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Загрузка страницы"
    >
      <p className="text-gray-500">Загрузка…</p>
    </div>
  );
}
