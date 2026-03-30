import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';

export default function PrinterTokenSection() {
  const user = useSelector((state) => state.auth.user);
  const isDirector = Boolean(user?.is_director);

  const [tokenData, setTokenData] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const [showToken, setShowToken] = useState(false);

  const effectiveOrgId = useMemo(() => user?.organization_id, [user?.organization_id]);

  const handleGenerateToken = async () => {
    if (!window.confirm('Вы уверены? Новый токен заменит старый и потребует обновления в программе агента.')) {
      return;
    }

    setTokenLoading(true);
    setTokenError(null);

    try {
      const response = await apiAxios.post(
        '/printers/printer-token/generate',
        null,
        { params: { organization_id: effectiveOrgId } }
      );

      setTokenData(response.data);
      setShowToken(true);
    } catch (err) {
      setTokenError(err.response?.data?.detail || 'Ошибка при генерации токена');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (tokenData?.printer_token) {
      navigator.clipboard.writeText(tokenData.printer_token);
      alert('Токен скопирован в буфер обмена!');
    }
  };

  const handleCopyOrgId = () => {
    if (tokenData?.organization_id) {
      navigator.clipboard.writeText(String(tokenData.organization_id));
      alert('ID организации скопирован в буфер обмена!');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Программа агента для печати</h3>
      </div>

      {isDirector && tokenError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {tokenError}
          </div>
        </div>
      )}

      {isDirector && tokenData && showToken && (
        <div className="mb-4 bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="flex items-start gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-green-800 mb-2">Токен успешно сгенерирован!</p>
              <p className="text-sm text-green-700">
                <strong>Важно:</strong> Сохраните этот токен в безопасном месте. Он не будет показан снова.
              </p>
            </div>
          </div>

          <div className="bg-white border border-green-300 rounded p-3 mb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-1">
              <p className="text-xs text-gray-600">Токен:</p>
              <button
                onClick={handleCopyToken}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                Скопировать
              </button>
            </div>
            <code className="text-sm font-mono text-gray-800 break-all">
              {tokenData.printer_token}
            </code>
          </div>

          <div className="bg-white border border-green-300 rounded p-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-1">
              <p className="text-xs text-gray-600">ID организации:</p>
              <button
                onClick={handleCopyOrgId}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                Скопировать
              </button>
            </div>
            <code className="text-sm font-mono text-gray-800">
              {tokenData.organization_id}
            </code>
          </div>
        </div>
      )}

      {isDirector && (
        <button
          onClick={handleGenerateToken}
          disabled={tokenLoading}
          className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
            ${tokenLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
        >
          {tokenLoading ? (
            <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Генерация...
            </>
          ) : (
            <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Сгенерировать токен
            </>
          )}
        </button>
      )}

      <div className="mt-4 text-sm text-gray-600">
        Выбор подключенного принтера перенесен в блок «Этикетка».
      </div>
    </div>
  );
}
