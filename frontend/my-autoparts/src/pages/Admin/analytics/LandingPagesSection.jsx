import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../utils/apiClient';
import { slugify, slugifyBrand } from '../../../utils/slugUtils';
import { DataTable, Section } from './AnalyticsUi';

const KIND_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'brand_new', label: 'Бренд (new)' },
  { value: 'category_new', label: 'Категория (new)' },
  { value: 'brand_used', label: 'Бренд (б/у)' },
  { value: 'category_used', label: 'Категория (б/у)' },
  { value: 'geo', label: 'Город (geo)' },
];

const KIND_LABELS = Object.fromEntries(
  KIND_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

const EMPTY_FORM = {
  kind: 'brand_new',
  slug: '',
  title_ru: '',
  search_query: '',
  brand_name: '',
  part_type_id: '',
  city: '',
  meta_title: '',
  meta_description: '',
  intro_html: '',
  is_active: true,
  priority: 0,
};

function isBrandKind(kind) {
  return kind === 'brand_new' || kind === 'brand_used';
}

function isCategoryKind(kind) {
  return kind === 'category_new' || kind === 'category_used';
}

function autoSlugForForm(form) {
  if (isBrandKind(form.kind)) {
    return slugifyBrand(form.brand_name || form.title_ru || '');
  }
  if (form.kind === 'geo') {
    return slugify(form.city || form.title_ru || '');
  }
  return slugify(form.title_ru || form.search_query || '');
}

function formToPayload(form) {
  const payload = {
    kind: form.kind,
    title_ru: form.title_ru.trim(),
    slug: form.slug.trim() || undefined,
    search_query: form.search_query.trim() || null,
    brand_name: form.brand_name.trim() || null,
    city: form.city.trim() || null,
    meta_title: form.meta_title.trim() || null,
    meta_description: form.meta_description.trim() || null,
    intro_html: form.intro_html.trim() || null,
    is_active: Boolean(form.is_active),
    priority: Number(form.priority) || 0,
  };
  if (form.part_type_id) {
    payload.part_type_id = Number(form.part_type_id);
  } else {
    payload.part_type_id = null;
  }
  return payload;
}

function rowToForm(row) {
  return {
    kind: row.kind,
    slug: row.slug || '',
    title_ru: row.title_ru || '',
    search_query: row.search_query || '',
    brand_name: row.brand_name || '',
    part_type_id: row.part_type_id ? String(row.part_type_id) : '',
    city: row.city || '',
    meta_title: row.meta_title || '',
    meta_description: row.meta_description || '',
    intro_html: row.intro_html || '',
    is_active: row.is_active !== false,
    priority: row.priority ?? 0,
  };
}

function LandingPageModal({ open, title, form, partTypes, saving, onClose, onChange, onSave, onAutoSlug }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Тип (kind)</span>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={form.kind}
              onChange={(e) => onChange({ ...form, kind: e.target.value })}
            >
              {KIND_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600">Приоритет</span>
            <input
              type="number"
              min="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={form.priority}
              onChange={(e) => onChange({ ...form, priority: e.target.value })}
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Заголовок (title_ru)</span>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={form.title_ru}
              onChange={(e) => onChange({ ...form, title_ru: e.target.value })}
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Slug</span>
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
                value={form.slug}
                onChange={(e) => onChange({ ...form, slug: e.target.value })}
                placeholder="авто из заголовка"
              />
              <button
                type="button"
                onClick={onAutoSlug}
                className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Авто
              </button>
            </div>
          </label>

          {isBrandKind(form.kind) && (
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Бренд (brand_name)</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                value={form.brand_name}
                onChange={(e) => onChange({ ...form, brand_name: e.target.value })}
              />
            </label>
          )}

          {isCategoryKind(form.kind) && (
            <>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-gray-600">Поисковый запрос (search_query)</span>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={form.search_query}
                  onChange={(e) => onChange({ ...form, search_query: e.target.value })}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-gray-600">Тип запчасти (part_type_id)</span>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  value={form.part_type_id}
                  onChange={(e) => onChange({ ...form, part_type_id: e.target.value })}
                >
                  <option value="">— не выбран —</option>
                  {partTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {form.kind === 'geo' && (
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Город (city)</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                value={form.city}
                onChange={(e) => onChange({ ...form, city: e.target.value })}
              />
            </label>
          )}

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Meta title</span>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={form.meta_title}
              onChange={(e) => onChange({ ...form, meta_title: e.target.value })}
              placeholder="Пусто = шаблон"
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Meta description</span>
            <textarea
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={form.meta_description}
              onChange={(e) => onChange({ ...form, meta_description: e.target.value })}
              placeholder="Пусто = шаблон"
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-gray-600">Intro HTML</span>
            <textarea
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
              value={form.intro_html}
              onChange={(e) => onChange({ ...form, intro_html: e.target.value })}
            />
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => onChange({ ...form, is_active: e.target.checked })}
            />
            Активна (is_active)
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !form.title_ru.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPagesSection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [error, setError] = useState(null);
  const [seedNotice, setSeedNotice] = useState(null);
  const [kindFilter, setKindFilter] = useState('');
  const [partTypes, setPartTypes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kindFilter) params.set('kind', kindFilter);
      const query = params.toString();
      const data = await apiRequest(`/admin/seo/landing-pages${query ? `?${query}` : ''}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Ошибка загрузки посадочных');
    } finally {
      setLoading(false);
    }
  }, [kindFilter]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    apiRequest('/part-types/public')
      .then((data) => setPartTypes(Array.isArray(data) ? data : []))
      .catch(() => setPartTypes([]));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, kind: kindFilter || 'brand_new' });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm(rowToForm(row));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const saveForm = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = formToPayload(form);
      if (editingId) {
        await apiRequest(`/admin/seo/landing-pages/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/admin/seo/landing-pages', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      await loadRows();
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/admin/seo/landing-pages/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      await loadRows();
    } catch (e) {
      setError(e?.message || 'Ошибка обновления');
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Удалить посадочную ${row.kind}/${row.slug}?`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/admin/seo/landing-pages/${row.id}`, { method: 'DELETE' });
      await loadRows();
    } catch (e) {
      setError(e?.message || 'Ошибка удаления');
    } finally {
      setSaving(false);
    }
  };

  const seedFromCatalog = async () => {
    setSeedBusy(true);
    setSeedNotice(null);
    setError(null);
    try {
      const result = await apiRequest('/admin/seo/landing-pages/seed-from-catalog?force=true', {
        method: 'POST',
      });
      setSeedNotice(
        `Создано: brand_new=${result.created_brand_new}, category_new=${result.created_category_new}, brand_used=${result.created_brand_used}, category_used=${result.created_category_used}, geo=${result.created_geo}, пропущено=${result.skipped}, всего=${result.total_rows}`,
      );
      await loadRows();
    } catch (e) {
      setError(e?.message || 'Ошибка генерации из каталога');
    } finally {
      setSeedBusy(false);
    }
  };

  const tableRows = useMemo(() => rows, [rows]);

  return (
    <>
      <Section
        title="Посадочные страницы"
        subtitle="Справочник slug для brand/category/geo — meta, фильтры, sitemap (этапы 3–6)"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={seedFromCatalog}
              disabled={seedBusy || saving}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {seedBusy ? 'Генерация…' : 'Сгенерировать из каталога'}
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Добавить
            </button>
          </div>
        }
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => setKindFilter(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  kindFilter === option.value
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {seedNotice && (
            <p className="mt-2 text-xs text-green-700">{seedNotice}</p>
          )}
        </div>

        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-500">Загрузка посадочных…</p>
        ) : (
          <DataTable
            columns={[
              {
                key: 'kind',
                label: 'Тип',
                render: (row) => (
                  <span className="text-xs text-gray-600">{KIND_LABELS[row.kind] || row.kind}</span>
                ),
              },
              {
                key: 'slug',
                label: 'Slug',
                render: (row) => (
                  <span className="font-mono text-xs text-gray-800">{row.slug}</span>
                ),
              },
              {
                key: 'title_ru',
                label: 'Заголовок',
                render: (row) => row.title_ru,
              },
              {
                key: 'target',
                label: 'Фильтр',
                render: (row) => (
                  <span className="text-xs text-gray-500">
                    {row.brand_name || row.search_query || row.city || '—'}
                  </span>
                ),
              },
              {
                key: 'priority',
                label: 'Приор.',
                align: 'right',
                render: (row) => row.priority ?? 0,
              },
              {
                key: 'is_active',
                label: 'Статус',
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => toggleActive(row)}
                    disabled={saving}
                    className={`rounded px-2 py-0.5 text-xs ${
                      row.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {row.is_active ? 'активна' : 'выкл'}
                  </button>
                ),
              },
              {
                key: 'actions',
                label: 'Действия',
                render: (row) => (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      disabled={saving}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRow(row)}
                      disabled={saving}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </div>
                ),
              },
            ]}
            rows={tableRows}
            rowKey={(row) => row.id}
            empty="Посадочные не найдены"
          />
        )}
      </Section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <LandingPageModal
        open={modalOpen}
        title={editingId ? 'Редактировать посадочную' : 'Новая посадочная'}
        form={form}
        partTypes={partTypes}
        saving={saving}
        onClose={closeModal}
        onChange={setForm}
        onSave={saveForm}
        onAutoSlug={() => setForm((prev) => ({ ...prev, slug: autoSlugForForm(prev) }))}
      />
    </>
  );
}
