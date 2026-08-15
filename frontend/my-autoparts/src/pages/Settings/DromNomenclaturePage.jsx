import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Skeleton,
} from '../../components/UI';
import {
  warehouseListShellClass,
  warehousePageClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

function formatErrorMessage(err) {
  return err?.message || String(err);
}

function itemArticle(item) {
  return String(item?.Артикул || item?.article || '').trim();
}

function itemKey(item, idx) {
  const article = itemArticle(item);
  return article ? `a:${article}` : `i:${idx}`;
}

function InlineNotice({ tone = 'success', children, onClose }) {
  const tones = {
    success: 'border-success-100 bg-success-50 text-success-700',
    error: 'border-danger-100 bg-danger-50 text-danger-700',
    warning: 'border-warning-100 bg-warning-50 text-warning-700',
    info: 'border-line bg-surface-subtle text-ink-soft',
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-sg border px-4 py-3 ${tones[tone] || tones.info}`}
      role="status"
    >
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
          aria-label="Закрыть"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function AvailabilityBadge({ value }) {
  const label = value || '—';
  const inStock = label === 'В наличии';
  return <Badge tone={inStock ? 'success' : 'warning'}>{label}</Badge>;
}

export default function DromNomenclaturePage() {
  const user = useSelector((state) => state.auth.user);
  const orgId = user?.organization_id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/credentials`, { method: 'GET' });
      const lastAutoload = data?.last_autoload;
      if (lastAutoload && lastAutoload.items) {
        setItems(lastAutoload.items);
      } else {
        setItems([]);
      }
      setSelectedKeys([]);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedArticles = useMemo(() => {
    const articles = [];
    items.forEach((item, idx) => {
      if (!selectedKeys.includes(itemKey(item, idx))) return;
      const article = itemArticle(item);
      if (article) articles.push(article);
    });
    return [...new Set(articles)];
  }, [items, selectedKeys]);

  const allSelected = items.length > 0 && selectedKeys.length === items.length;

  const toggleAll = (checked) => {
    if (checked) {
      setSelectedKeys(items.map((item, idx) => itemKey(item, idx)));
    } else {
      setSelectedKeys([]);
    }
  };

  const toggleRow = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleRemove = async () => {
    if (!orgId || selectedArticles.length === 0) return;

    setRemoving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/autoload/remove-rows`, {
        method: 'POST',
        body: JSON.stringify({ articles: selectedArticles }),
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setSelectedKeys([]);
      setConfirmOpen(false);
      const syncSkipped = data?.sync?.skipped;
      const syncOk = data?.sync?.ok;
      let msg = `Удалено из номенклатуры: ${data.removed_count ?? selectedArticles.length}.`;
      if (syncSkipped) {
        msg += ' API-синхронизация пропущена (выключена или нет ключей).';
      } else if (data?.sync && syncOk === false) {
        msg += ` API: ${data.sync.error_message || 'ошибка синхронизации'}.`;
      } else if (data?.sync) {
        msg += ' Обновление прайс-листа в API Drom отправлено.';
      }
      setNotice(msg);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setRemoving(false);
    }
  };

  if (!orgId) {
    return (
      <div className={`${warehousePageClass} min-w-0`}>
        <EmptyState
          illustration="empty"
          title="Нет организации"
          description="Интеграция Drom доступна для аккаунтов с привязкой к организации."
        />
      </div>
    );
  }

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/settings/integration/drom"
            className="mb-1 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← К интеграции
          </Link>
          <PageIntro
            title="Номенклатура Drom"
            description={
              !loading && items.length > 0
                ? `${items.length} позиций в файле автозагрузки`
                : 'Товары в XLSX для Drom.ru'
            }
            className="mb-0"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={loadData}
          disabled={loading}
          loading={loading}
        >
          {loading ? 'Загрузка…' : 'Обновить'}
        </Button>
      </div>

      {error ? (
        <InlineNotice tone="error" onClose={() => setError(null)}>
          <p className="whitespace-pre-wrap">{error}</p>
        </InlineNotice>
      ) : null}
      {notice ? (
        <InlineNotice tone="success" onClose={() => setNotice(null)}>
          <p className="whitespace-pre-wrap">{notice}</p>
        </InlineNotice>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-sg-lg" />
          <Skeleton className="h-64 w-full rounded-sg-lg" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          illustration="empty"
          title="Нет товаров"
          description="Экспортируйте товары со страницы «Мои запчасти»."
          actionLabel="Перейти к запчастям"
          actionHref="/my-parts"
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className={`${warehouseToolbarClass} justify-between rounded-none border-b border-line`}>
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                className="rounded border-line text-brand-600 focus:ring-brand-500"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={removing}
              />
              Выбрать все ({items.length})
            </label>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={removing || selectedArticles.length === 0}
              loading={removing}
            >
              {removing
                ? 'Удаление…'
                : `Удалить (${selectedArticles.length})`}
            </Button>
          </div>

          <div className={`hidden md:block ${warehouseListShellClass} rounded-none border-0`}>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-subtle text-ink-soft">
                <tr>
                  <th className="w-10 px-4 py-2.5 font-medium" />
                  <th className="px-4 py-2.5 font-medium">Артикул</th>
                  <th className="px-4 py-2.5 font-medium">Наименование</th>
                  <th className="px-4 py-2.5 font-medium">Состояние</th>
                  <th className="px-4 py-2.5 font-medium">Производитель</th>
                  <th className="px-4 py-2.5 text-right font-medium">Кол-во</th>
                  <th className="px-4 py-2.5 text-right font-medium">Цена</th>
                  <th className="px-4 py-2.5 font-medium">Наличие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item, idx) => {
                  const key = itemKey(item, idx);
                  return (
                    <tr key={key} className="bg-surface hover:bg-surface-subtle/60">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-line text-brand-600 focus:ring-brand-500"
                          checked={selectedKeys.includes(key)}
                          disabled={removing || !itemArticle(item)}
                          onChange={() => toggleRow(key)}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-ink">
                        {item.Артикул || item.article || '—'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-ink-soft">
                        {item['Наименование товара'] || item.name || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                        {item['Новый/б.у.'] || item.condition || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                        {item.Производитель || item.brand || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-ink">
                        {item['Кол-во'] ?? item.quantity ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-ink">
                        {item.Цена ?? item.price
                          ? `${Number(item.Цена ?? item.price).toLocaleString('ru-RU')} ₽`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <AvailabilityBadge value={item.Наличие || item.availability} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-line md:hidden">
            {items.map((item, idx) => {
              const key = itemKey(item, idx);
              return (
                <div key={key} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-line text-brand-600 focus:ring-brand-500"
                      checked={selectedKeys.includes(key)}
                      disabled={removing || !itemArticle(item)}
                      onChange={() => toggleRow(key)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-sm font-semibold text-ink">
                            {item.Артикул || item.article || '—'}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                            {item['Наименование товара'] || item.name || '—'}
                          </p>
                        </div>
                        <AvailabilityBadge value={item.Наличие || item.availability} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-ink-muted">Производитель</p>
                          <p className="truncate text-ink">
                            {item.Производитель || item.brand || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted">Состояние</p>
                          <p className="text-ink">{item['Новый/б.у.'] || item.condition || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted">Кол-во</p>
                          <p className="text-ink">{item['Кол-во'] ?? item.quantity ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-muted">Цена</p>
                          <p className="font-medium text-ink">
                            {item.Цена ?? item.price
                              ? `${Number(item.Цена ?? item.price).toLocaleString('ru-RU')} ₽`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-line bg-surface-subtle/50 px-4 py-3 sm:px-6">
            <p className="text-sm text-ink-muted">
              Всего:{' '}
              <span className="font-semibold text-ink">{items.length}</span>
              {selectedArticles.length > 0 ? (
                <>
                  {' · '}
                  Выбрано:{' '}
                  <span className="font-semibold text-ink">{selectedArticles.length}</span>
                </>
              ) : null}
            </p>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Удалить из номенклатуры?"
        message={`Удалить ${selectedArticles.length} поз. из прайс-листа Drom? Они пропадут из файла и из автообновления API (qty=0).`}
        confirmLabel="Удалить"
        danger
        loading={removing}
      />
    </div>
  );
}
