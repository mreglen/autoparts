import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchContractors,
  createContractor,
  updateContractor,
} from '../../redux/slices/ContractorsSlice';
import RequisiteSetsFields from '../../components/Requisites/RequisiteSetsFields';
import Toast from '../../components/UI/Toast';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldHint,
  FieldLabel,
  Input,
  Modal,
  PageHeader,
  SkeletonListCards,
  Textarea,
} from '../../components/UI';
import {
  autoserviceListMobileWrapClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListThClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
  warehousePageClass,
  warehousePillControlClass,
} from '../../utils/warehouseListUi';
import {
  buildContractorPayload,
  contractorFormFromApi,
  emptyContractorForm,
  formatContractorDefaults,
  formatContractorTypeCoverage,
  parseContractorSaveError,
  validateContractorForm,
} from './contractorsPageUtils';
import {
  normalizeRequisiteKind,
  requisiteInn,
  requisiteName,
} from '../../utils/requisiteSets';
import { PERSON_TYPES, personTypeLabel } from '../../utils/autoserviceClientRequisites';

function StatusBadge({ isActive }) {
  const tone = isActive
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : 'bg-gray-100 text-gray-600 ring-gray-500/20';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
      {isActive ? 'Активен' : 'Неактивен'}
    </span>
  );
}

function ContractorMobileCard({ contractor, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border-b border-line-soft py-2 text-left last:border-b-0"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-ink">{contractor.name || '—'}</span>
        <StatusBadge isActive={contractor.is_active} />
      </div>
      <p className="mt-1 truncate text-xs text-ink-muted">{formatContractorDefaults(contractor)}</p>
    </button>
  );
}

function ContractorFormFields({ form, sets, errors, disabled, onField, onSets }) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor="contractor-name" required>Наименование</FieldLabel>
        <Input
          id="contractor-name"
          value={form.name}
          onChange={(e) => onField('name', e.target.value)}
          placeholder="ООО «Урал Стартер»"
          maxLength={120}
          disabled={disabled}
          error={Boolean(errors.name)}
        />
        {errors.name ? <FieldHint error>{errors.name}</FieldHint> : null}
      </div>
      <div>
        <FieldLabel htmlFor="contractor-note">Комментарий</FieldLabel>
        <Textarea
          id="contractor-note"
          rows={2}
          value={form.note}
          onChange={(e) => onField('note', e.target.value)}
          placeholder="Какие работы отдаёт"
          disabled={disabled}
        />
      </div>
      <RequisiteSetsFields
        sets={sets}
        onChange={onSets}
        errors={errors}
        disabled={disabled}
        idPrefix="contractor"
        showContacts
        phoneValue={form.phone}
        onPhoneChange={(value) => onField('phone', value)}
      />
    </div>
  );
}

export default function ContractorsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const {
    contractors,
    loadingContractors,
    contractorsError,
    saving,
  } = useSelector((state) => state.contractors);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsContractor, setDetailsContractor] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyContractorForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [activating, setActivating] = useState(false);

  const canManage = Boolean(user?.is_director || user?.is_admin || user?.is_seller);

  useEffect(() => {
    dispatch(fetchContractors({ includeInactive }));
  }, [dispatch, includeInactive]);

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const list = contractors || [];
    if (!term) return list;
    return list.filter((row) => {
      const sets = row.requisite_sets || {};
      return [
        row.name,
        row.phone,
        sets.legal_name,
        sets.ie_name,
        sets.ind_name,
        sets.inn_legal,
        sets.inn_ie,
        sets.inn_individual,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [contractors, searchQuery]);

  const openCreate = () => {
    setForm(emptyContractorForm());
    setErrors({});
    setFormError('');
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (contractor) => {
    setForm(contractorFormFromApi(contractor));
    setErrors({});
    setFormError('');
    setEditingId(contractor.id);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateContractorForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setFormError('');
    const payload = buildContractorPayload(form);
    try {
      if (editingId) {
        await dispatch(updateContractor({ contractorId: editingId, payload })).unwrap();
        setNotice('Изменения сохранены');
      } else {
        await dispatch(createContractor(payload)).unwrap();
        setNotice('Подрядчик добавлен');
      }
      setShowForm(false);
    } catch (error) {
      const parsed = parseContractorSaveError(error);
      setFormError(parsed.formError);
      if (Object.keys(parsed.fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...parsed.fieldErrors }));
      }
    }
  };

  const toggleActive = async (contractor, isActive) => {
    setActivating(true);
    try {
      await dispatch(updateContractor({ contractorId: contractor.id, payload: { is_active: isActive } })).unwrap();
      setNotice(isActive ? 'Подрядчик снова активен' : 'Подрядчик деактивирован');
      setDetailsContractor(null);
      setDeactivateTarget(null);
    } catch (error) {
      setFormError(typeof error === 'string' ? error : error?.message || 'Не удалось изменить статус');
    } finally {
      setActivating(false);
    }
  };

  const stats = useMemo(() => ({
    total: (contractors || []).length,
    active: (contractors || []).filter((row) => row.is_active).length,
  }), [contractors]);

  const subtitle = loadingContractors
    ? 'Загрузка списка…'
    : `${stats.active} активных из ${stats.total}`;

  return (
    <div className={`${warehousePageClass} w-full min-w-0 space-y-6`}>
      <PageHeader
        title="Подрядчики"
        subtitle={subtitle}
        action={canManage ? (
          <Button type="button" className="w-full sm:w-auto" onClick={openCreate}>
            Добавить подрядчика
          </Button>
        ) : null}
      />

      <Toast message={notice} variant="success" onClose={() => setNotice('')} />
      <Toast
        message={formError && !showForm ? formError : null}
        variant="error"
        onClose={() => setFormError('')}
      />

      {!loadingContractors && stats.total > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по наименованию, телефону или ИНН"
            className={warehousePillControlClass}
          />
          {canManage ? (
            <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
              />
              Показывать неактивных
            </label>
          ) : null}
        </div>
      ) : null}

      {loadingContractors ? (
        <SkeletonListCards count={3} />
      ) : contractorsError ? (
        <EmptyState illustration="error" title="Не удалось загрузить" description={contractorsError} />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={stats.total ? 'search' : 'empty'}
          title={stats.total ? 'Никого не нашли' : 'Подрядчиков пока нет'}
          description={stats.total
            ? 'Попробуйте изменить запрос поиска.'
            : 'Те, кому сервис отдаёт работы на сторону: расточка, стартеры, эвакуатор.'}
          actionLabel={canManage && !stats.total ? 'Добавить подрядчика' : undefined}
          onAction={canManage && !stats.total ? openCreate : undefined}
        />
      ) : (
        <>
          <div className={autoserviceListTableWrapClass}>
            <table className={autoserviceListTableClass}>
              <thead>
                <tr className={autoserviceListTheadRowClass}>
                  <th className={autoserviceListThClass}>Подрядчик</th>
                  <th className={`w-64 ${autoserviceListThClass}`}>Реквизиты по умолчанию</th>
                  <th className={`w-48 ${autoserviceListThClass}`}>Типы в документах</th>
                  <th className={`w-28 ${autoserviceListThClass}`}>Статус</th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={autoserviceListTrClickableClass}
                    onClick={() => setDetailsContractor(row)}
                  >
                    <td className={`min-w-0 ${autoserviceListTdClass}`}>
                      <div className="w-0 min-w-full truncate font-semibold text-ink">{row.name || '—'}</div>
                      <div className="w-0 min-w-full truncate text-ink-muted">{row.phone || ''}</div>
                    </td>
                    <td className={`min-w-0 ${autoserviceListTdClass}`}>
                      <div className="w-0 min-w-full truncate text-ink-muted">{formatContractorDefaults(row)}</div>
                    </td>
                    <td className={`min-w-0 ${autoserviceListTdClass}`}>
                      <div className="w-0 min-w-full truncate text-ink-muted">{formatContractorTypeCoverage(row)}</div>
                    </td>
                    <td className={autoserviceListTdClass}>
                      <StatusBadge isActive={row.is_active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={autoserviceListMobileWrapClass}>
            {filtered.map((row) => (
              <ContractorMobileCard
                key={row.id}
                contractor={row}
                onOpen={() => setDetailsContractor(row)}
              />
            ))}
          </div>
        </>
      )}

      <Modal
        open={Boolean(detailsContractor)}
        onClose={() => setDetailsContractor(null)}
        title={detailsContractor?.name || 'Подрядчик'}
        size="md"
      >
        {detailsContractor ? (() => {
          const sets = detailsContractor.requisite_sets || {};
          const defaultKind = normalizeRequisiteKind(sets.person_type_default);
          return (
            <div className="space-y-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">Телефон</dt>
                  <dd className="mt-0.5 font-medium text-ink">{detailsContractor.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="mt-0.5 font-medium text-ink">{sets.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Тип по умолчанию</dt>
                  <dd className="mt-0.5 font-medium text-ink">{personTypeLabel(defaultKind)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Статус</dt>
                  <dd className="mt-1"><StatusBadge isActive={detailsContractor.is_active} /></dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Адрес</dt>
                  <dd className="mt-0.5 font-medium text-ink">{sets.address || '—'}</dd>
                </div>
                {detailsContractor.note ? (
                  <div className="sm:col-span-2">
                    <dt className="text-ink-muted">Комментарий</dt>
                    <dd className="mt-0.5 font-medium text-ink">{detailsContractor.note}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="space-y-2">
                {PERSON_TYPES.map((item) => {
                  const name = requisiteName(sets, item.id);
                  const inn = requisiteInn(sets, item.id);
                  const isDefault = item.id === defaultKind;
                  return (
                    <div key={item.id} className="rounded-sg-sm border border-line px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{item.label}</span>
                        {isDefault ? <span className="text-xs text-brand-700">по умолчанию</span> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {[name, inn && `ИНН ${inn}`].filter(Boolean).join(' · ') || 'не заполнено'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setDetailsContractor(null); openEdit(detailsContractor); }}>
                    Редактировать
                  </Button>
                  {detailsContractor.is_active ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={activating}
                      onClick={() => setDeactivateTarget(detailsContractor)}
                    >
                      Деактивировать
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={activating}
                      onClick={() => toggleActive(detailsContractor, true)}
                    >
                      Сделать активным
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          );
        })() : null}
      </Modal>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Редактирование подрядчика' : 'Новый подрядчик'}
        size="lg"
      >
        <form id="contractor-form" onSubmit={handleSubmit} className="space-y-5">
          <ContractorFormFields
            form={form}
            sets={form.requisite_sets}
            errors={errors}
            disabled={saving}
            onField={(name, value) => setForm((prev) => ({ ...prev, [name]: value }))}
            onSets={(nextSets) => setForm((prev) => ({ ...prev, requisite_sets: nextSets }))}
          />
          {formError ? <p className="text-sm text-danger-600">{formError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Отмена</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => toggleActive(deactivateTarget, false)}
        title="Деактивировать подрядчика?"
        message={`«${deactivateTarget?.name || ''}» перестанет предлагаться в заказ-нарядах. Уже назначенные работы и выплаты останутся в истории.`}
        confirmLabel="Деактивировать"
        loading={activating}
      />
    </div>
  );
}
