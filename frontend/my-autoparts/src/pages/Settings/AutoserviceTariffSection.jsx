import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProfile } from '../../redux/slices/AuthSlice';
import {
  fetchMyAutoserviceApplication,
  submitAutoserviceApplication,
} from '../../redux/slices/AutoserviceAdminSlice';
import {
  DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  fetchPublicSiteConfig,
} from '../../redux/slices/PublicInfoSlice';
import Button from '../../components/UI/Button';
import { Badge, Card, FieldHint, FieldLabel, Input, Textarea } from '../../components/UI';

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
    dispatch(fetchPublicSiteConfig(true));
  }, [dispatch]);

  useEffect(() => {
    if (!user) return;
    const fullName = [user.last_name, user.first_name, user.patronymic].filter(Boolean).join(' ');
    setContactName((prev) => prev || fullName);
    setContactPhone((prev) => prev || user.phone || user.organization_phone || '');
  }, [user]);

  const autoserviceMarkupFromConfig = useSelector(
    (state) => state.publicInfo.autoserviceMarkupPercent ?? DEFAULT_AUTOSERVICE_MARKUP_PERCENT,
  );
  const connected = Boolean(
    user?.organization_is_autoservice || myApplicationState?.organization_is_autoservice,
  );
  const application = myApplicationState?.application;
  const markupPercent = autoserviceMarkupFromConfig;
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
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Подключить автосервис</h3>
          <p className="mt-0.5 text-sm text-gray-500">Запись, заказ-наряды и клиентская база</p>
        </div>
        {connected ? <Badge tone="success">Активен</Badge> : null}
        {statusMeta && !connected ? <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-gray-100 px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Стоимость</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{formatMoney(priceRub)} ₽</p>
          <p className="text-sm text-gray-500">в месяц</p>
        </div>
        <div className="rounded-xl bg-gray-100 px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Наценка на запчасти</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{markupPercent}%</p>
          <p className="text-sm text-gray-500">по умолчанию в заказ-нарядах</p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
        <li>Планировщик, клиенты, заказ-наряды и настройки сервиса</li>
        <li>Переключатель «Продавец / Автосервис» в меню после подключения</li>
        <li>Клиентский режим автосервиса — как у покупателей на сайте</li>
      </ul>

      {connected ? (
        <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Автосервис подключён. Используйте переключатель «Продавец / Автосервис» в меню слева.
        </p>
      ) : null}

      {!connected && isDirector && application?.status !== 'pending' ? (
        <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="autoservice-contact-name">Контактное лицо</FieldLabel>
              <Input
                id="autoservice-contact-name"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="autoservice-contact-phone">Телефон</FieldLabel>
              <Input
                id="autoservice-contact-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="autoservice-message">Комментарий</FieldLabel>
            <Textarea
              id="autoservice-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Кратко опишите формат работы сервиса (необязательно)"
            />
          </div>
          {(myError || notice) && (
            notice?.type === 'success' ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice.message}</p>
            ) : (
              <FieldHint error>{notice?.message || myError}</FieldHint>
            )
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting || myLoading} loading={submitting}>
            Отправить заявку
          </Button>
        </div>
      ) : null}

      {!connected && application?.status === 'pending' ? (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Заявка отправлена {application.created_at ? new Date(application.created_at).toLocaleString('ru-RU') : ''}.
          После одобрения администратором автосервис появится в меню.
        </p>
      ) : null}

      {!connected && application?.status === 'rejected' ? (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          Заявка отклонена{application.rejection_reason ? `: ${application.rejection_reason}` : ''}. Вы можете отправить новую заявку.
        </p>
      ) : null}

      {!isDirector && !connected ? (
        <p className="mt-5 text-sm text-gray-500">Отправить заявку может директор организации.</p>
      ) : null}
    </Card>
  );
}
