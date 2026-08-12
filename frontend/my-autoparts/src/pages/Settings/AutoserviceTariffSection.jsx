import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProfile } from '../../redux/slices/AuthSlice';
import {
  fetchMyAutoserviceApplication,
  submitAutoserviceApplication,
} from '../../redux/slices/AutoserviceAdminSlice';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { settingsInputClass } from './settingsUi';

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
}

const STATUS_MAP = {
  pending: { label: 'На рассмотрении', tone: 'warning' },
  approved: { label: 'Подключён', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' },
};

export default function AutoserviceTariffSection({ user, isDirector }) {
  const dispatch = useDispatch();
  const { myApplicationState, myLoading, submitting, myError } = useSelector(
    (state) => state.autoserviceAdmin,
  );

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (user?.organization_id && isDirector) {
      dispatch(fetchMyAutoserviceApplication());
    }
  }, [dispatch, user?.organization_id, isDirector]);

  useEffect(() => {
    if (!user) return;
    const fullName = [user.last_name, user.first_name, user.patronymic].filter(Boolean).join(' ');
    setContactName((prev) => prev || fullName);
    setContactPhone((prev) => prev || user.phone || user.organization_phone || '');
  }, [user]);

  const connected = Boolean(
    user?.organization_is_autoservice || myApplicationState?.organization_is_autoservice,
  );
  const application = myApplicationState?.application;
  const markupPercent = myApplicationState?.autoservice_markup_percent ?? 7;
  const priceRub = myApplicationState?.price_rub_per_month ?? 10000;
  const statusMeta = application ? STATUS_MAP[application.status] : null;

  const canSubmit = useMemo(() => {
    if (!isDirector || connected) return false;
    if (application?.status === 'pending') return false;
    return Boolean(contactName.trim() && contactPhone.trim());
  }, [isDirector, connected, application, contactName, contactPhone]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setNotice(null);
    try {
      await dispatch(
        submitAutoserviceApplication({
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          message: message.trim() || null,
        }),
      ).unwrap();
      dispatch(fetchProfile());
      setNotice({ type: 'success', message: 'Заявка отправлена. Мы свяжемся с вами после проверки.' });
    } catch (err) {
      setNotice({ type: 'error', message: err || 'Не удалось отправить заявку' });
    }
  };

  if (!user?.organization_id) return null;

  return (
    <Card className="border-brand-100 bg-gradient-to-br from-brand-50/70 to-surface">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
                />
              </svg>
            </span>
            <div>
              <h2 className="text-sg-subtitle text-ink">Подключить автосервис</h2>
              <p className="text-sm text-ink-muted">Тариф для организаций с записью, заказ-нарядами и клиентской базой</p>
            </div>
          </div>
        </div>
        {connected ? <Badge tone="success">Активен</Badge> : null}
        {statusMeta && !connected ? <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-sg-lg border border-line bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Стоимость</p>
          <p className="mt-1 text-2xl font-bold text-ink">{formatMoney(priceRub)} ₽</p>
          <p className="text-sm text-ink-muted">в месяц</p>
        </div>
        <div className="rounded-sg-lg border border-line bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Наценка на запчасти</p>
          <p className="mt-1 text-2xl font-bold text-ink">{markupPercent}%</p>
          <p className="text-sm text-ink-muted">по умолчанию в заказ-нарядах автосервиса</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-ink-soft">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          Планировщик, клиенты, заказ-наряды и настройки сервиса
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          Переключатель «Продавец / Автосервис» в боковом меню после подключения
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          Клиентский режим автосервиса — как у обычных покупателей на сайте
        </li>
      </ul>

      {connected ? (
        <p className="mt-5 rounded-sg-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          Автосервис подключён. Используйте переключатель «Продавец / Автосервис» в меню слева.
        </p>
      ) : null}

      {!connected && isDirector && application?.status !== 'pending' ? (
        <div className="mt-5 space-y-4 border-t border-line-soft pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Контактное лицо</label>
              <input
                type="text"
                className={settingsInputClass}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Телефон</label>
              <input
                type="tel"
                className={settingsInputClass}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Комментарий</label>
            <textarea
              className={settingsInputClass}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Кратко опишите формат работы сервиса (необязательно)"
            />
          </div>
          {(myError || notice) && (
            <div
              className={`rounded-sg-lg border px-4 py-3 text-sm ${
                notice?.type === 'success'
                  ? 'border-success-200 bg-success-50 text-success-800'
                  : 'border-danger-200 bg-danger-50 text-danger-800'
              }`}
            >
              {notice?.message || myError}
            </div>
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting || myLoading} loading={submitting}>
            Отправить заявку
          </Button>
        </div>
      ) : null}

      {!connected && application?.status === 'pending' ? (
        <p className="mt-5 rounded-sg-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
          Заявка отправлена {application.created_at ? new Date(application.created_at).toLocaleString('ru-RU') : ''}.
          После одобрения администратором автосервис появится в меню.
        </p>
      ) : null}

      {!connected && application?.status === 'rejected' ? (
        <p className="mt-5 rounded-sg-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          Заявка отклонена{application.rejection_reason ? `: ${application.rejection_reason}` : ''}. Вы можете отправить новую заявку.
        </p>
      ) : null}

      {!isDirector && !connected ? (
        <p className="mt-5 text-sm text-ink-muted">Отправить заявку может директор организации.</p>
      ) : null}
    </Card>
  );
}
