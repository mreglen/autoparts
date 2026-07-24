import { Link, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { canAccessAvitoIntegration } from './integrationAccess';

export default function IntegrationPage() {
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const canAccessAvito = canAccessAvitoIntegration(user, permissionCodes);

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!user?.organization_id) {
    return <Navigate to="/" replace />;
  }

  if (!canAccessAvito && !user?.is_admin && !user?.is_director && !user?.is_seller) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Интеграции</h1>
        <p className="text-sm text-gray-600 mt-1">Управляйте интеграциями с внешними площадками</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canAccessAvito ? (
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
        ) : null}

        {(user?.is_admin || user?.is_director || user?.is_seller) && (
          <Link
            to="/settings/integration/drom"
            className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-gray-100">
                <img src="/logos/drom.png" alt="Дром" className="w-10 h-10 object-contain" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Drom — прайс по API
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Онлайн-обновление прайса через API Drom и XLSX для полной автозагрузки
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
        )}
      </div>
    </div>
  );
}
