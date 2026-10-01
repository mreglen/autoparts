import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import Toast from '../UI/Toast';

const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:min-h-10';

const btnGhost =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 sm:min-h-10';

export default function CalendarSyncSection({ basePath }) {
  const [status, setStatus] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest(basePath);
      setStatus(data);
    } catch (e) {
      setToast({ variant: 'error', message: e?.message || 'Не удалось загрузить статус' });
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    load();
  }, [load]);

  const call = useCallback(async (path, method) => {
    setBusy(true);
    try {
      const data = await apiRequest(path, { method });
      if (data?.username && data?.password) {
        setCredentials(data);
        setStatus((prev) => ({ ...(prev || {}), enabled: true, configured: true, username: data.username, server_url: data.server_url }));
      } else {
        setCredentials(null);
        setStatus(data);
      }
    } catch (e) {
      setToast({ variant: 'error', message: e?.message || 'Операция не выполнена' });
    } finally {
      setBusy(false);
    }
  }, []);

  const copy = useCallback(async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ variant: 'success', message: 'Скопировано' });
    } catch {
      setToast({ variant: 'error', message: 'Не удалось скопировать' });
    }
  }, []);

  const instructionText = credentials
    ? `Подключение календаря «Записи на осмотр» на iPhone:\n` +
      `1. Настройки → Календарь → Учётные записи → Добавить учётную запись → Другое → Добавить учётную запись CalDAV.\n` +
      `2. Сервер: ${credentials.server_url}\n` +
      `3. Имя пользователя: ${credentials.username}\n` +
      `4. Пароль: ${credentials.password}\n` +
      `5. Сохранить. В Календаре и Напоминаниях появится список «Записи на осмотр».`
    : '';

  if (loading) {
    return <p className="py-10 text-center text-sm text-ink-muted">Загрузка…</p>;
  }

  const credRow = (label, value) => (
    <div className="flex items-center justify-between gap-3 rounded-sg-sm border border-line bg-surface-subtle px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-ink-faint">{label}</p>
        <p className="truncate font-mono text-sm text-ink">{value}</p>
      </div>
      <button type="button" className={btnGhost} onClick={() => copy(value)}>
        Копировать
      </button>
    </div>
  );

  return (
    <section className="max-w-2xl space-y-4">
      <p className="text-sm text-ink-muted">
        Записи на осмотр синхронизируются с Календарём и Напоминаниями на iPhone:
        новые появляются автоматически, удалённые с сайта пропадают. Календарь
        напоминает накануне в 20:00, за час и за 15 минут до записи; Напоминания —
        в момент записи.
      </p>

      {status && !status.configured ? (
        <p className="rounded-sg-sm border border-line bg-surface-subtle px-3 py-2 text-sm text-ink-muted">
          Синхронизация ещё не настроена на сервере — обратитесь к администратору сайта.
        </p>
      ) : null}

      {!status?.enabled ? (
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || (status && !status.configured)}
          onClick={() => call(`${basePath}/connect`, 'POST')}
        >
          {busy ? 'Подключение…' : 'Подключить iPhone'}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnGhost}
            disabled={busy}
            onClick={() => call(`${basePath}/regenerate`, 'POST')}
          >
            Перегенерировать пароль
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={busy}
            onClick={() => call(basePath, 'DELETE')}
          >
            Отключить
          </button>
        </div>
      )}

      {status?.enabled && !credentials ? (
        <p className="text-sm text-ink-muted">
          Подключено: <span className="font-mono">{status.username}</span>
          {status.last_synced_at
            ? ` · последняя синхронизация ${new Date(status.last_synced_at).toLocaleString('ru-RU')}`
            : ''}
        </p>
      ) : null}

      {credentials ? (
        <div className="space-y-3 rounded-sg-sm border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-ink">
            Данные для подключения (пароль показывается один раз):
          </p>
          {credRow('Сервер', credentials.server_url)}
          {credRow('Имя пользователя', credentials.username)}
          {credRow('Пароль', credentials.password)}
          <button type="button" className={btnGhost} onClick={() => copy(instructionText)}>
            Скопировать инструкцию для сотрудника
          </button>
        </div>
      ) : null}

      <details className="rounded-sg-sm border border-line bg-surface px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-ink">Как добавить на iPhone</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-muted">
          <li>Настройки → Календарь → Учётные записи → «Добавить учётную запись».</li>
          <li>«Другое» → «Добавить учётную запись CalDAV».</li>
          <li>Введите сервер, имя пользователя и пароль из блока выше.</li>
          <li>Сохраните — в Календаре появится «Записи на осмотр», в Напоминаниях — список задач.</li>
        </ol>
      </details>

      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </section>
  );
}
