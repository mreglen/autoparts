import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import {
  warehousePillButtonClass,
  warehousePrimaryButtonClass,
} from '../../utils/warehouseListUi';

export default function PrinterTokenSection() {
  const user = useSelector((state) => state.auth.user);
  const isDirector = Boolean(user?.is_director);
  const agentInstallerHref = '/downloads/AutoParts_PrinterAgent_Setup.exe';
  const xprinterDriverHref = '/downloads/Xprinter_2021.3.exe';

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
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-gray-900">Агент</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={agentInstallerHref}
            download="AutoParts_PrinterAgent_Setup.exe"
            className={warehousePillButtonClass}
          >
            Скачать новый агент
          </a>
          <a
            href={xprinterDriverHref}
            download="Xprinter_2021.3.exe"
            className={warehousePillButtonClass}
          >
            Скачать драйвер Xprinter
          </a>
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-950 ring-1 ring-blue-200/80">
        <p className="font-semibold">Настройка Xprinter XP-365B для этикетки 58×40 мм</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Установите драйвер Xprinter и выберите размер бумаги 58×40 мм.</li>
          <li>Установите масштаб 100%, горизонтальное и вертикальное смещение 0.</li>
          <li>Выберите тип материала «Этикетка с зазором» и выполните калибровку.</li>
          <li>Установите новый агент поверх текущего и перезапустите его.</li>
        </ol>
        <p className="text-xs text-blue-800">
          Новый агент не увеличивает этикетку и не прибавляет аппаратные отступы драйвера повторно.
        </p>
      </div>

      {isDirector && tokenError ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200/80">
          {tokenError}
        </div>
      ) : null}

      {isDirector && tokenData && showToken ? (
        <div className="space-y-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200/80">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500">Токен</p>
              <code className="mt-1 block break-all font-mono text-sm text-gray-900">
                {tokenData.printer_token}
              </code>
            </div>
            <button type="button" onClick={handleCopyToken} className={warehousePillButtonClass}>
              Копировать
            </button>
          </div>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-500">Организация</p>
              <code className="mt-1 block font-mono text-sm text-gray-900">
                {tokenData.organization_id}
              </code>
            </div>
            <button type="button" onClick={handleCopyOrgId} className={warehousePillButtonClass}>
              Копировать
            </button>
          </div>
        </div>
      ) : null}

      {isDirector ? (
        <button
          type="button"
          onClick={handleGenerateToken}
          disabled={tokenLoading}
          className={`${warehousePrimaryButtonClass} w-full sm:w-auto`}
        >
          {tokenLoading ? 'Генерация…' : 'Сгенерировать токен'}
        </button>
      ) : null}
    </section>
  );
}
