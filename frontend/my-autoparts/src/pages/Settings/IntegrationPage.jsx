import { Link } from 'react-router-dom';

export default function IntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Интеграции</h1>
        <p className="text-sm text-gray-600 mt-1">Управляйте интеграциями с внешними площадками</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Авито */}
        <Link
          to="/settings/integration/avito"
          className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-gray-100">
              <img src="/logos/avito.png" alt="Авито" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                Интеграция Авито
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Автозагрузка объявлений, управление товарами и синхронизация с Авито
              </p>
              <div className="flex items-center gap-1 mt-3 text-sm text-blue-600 group-hover:text-blue-700">
                <span>Настроить</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          </div>
        </Link>

        {/* Дром */}
        <div className="block bg-white rounded-xl border border-gray-200 p-6 opacity-60 cursor-not-allowed">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
              <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-gray-100">
                <img src="/logos/drom.png" alt="Дром" className="w-10 h-10 object-contain" />
            </div>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-700">
                Интеграция Дром
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Интеграция с площадкой Дром.ру (скоро будет доступна)
              </p>
              <div className="flex items-center gap-1 mt-3 text-sm text-gray-400">
                <span>В разработке</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
