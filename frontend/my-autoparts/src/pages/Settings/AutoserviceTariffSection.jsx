import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProfile } from '../../redux/slices/AuthSlice';
import {
  fetchMyAutoserviceApplication,
  submitAutoserviceApplication,
} from '../../redux/slices/AutoserviceAdminSlice';
import {
  Badge,
  Button,
  Card,
  FieldHint,
  FieldLabel,
  Input,
  Textarea,
} from '../../components/UI';
import Toast from '../../components/UI/Toast';

const STATUS_MAP = {
  pending: { label: 'На рассмотрении', tone: 'warning' },
  approved: { label: 'Подключён', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' },
};

export default function AutoserviceTariffSection({ user, org, isDirector }) {
  const dispatch = useDispatch();
  const { myApplicationState, myLoading, submitting, myError } = useSelector(
    (state) => state.autoserviceAdmin,
  );

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDirections, setSelectedDirections] = useState({ seller: false, autoservice: false });
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

  const sellerConnected = Boolean(org?.is_seller_business ?? user?.is_seller);
  const autoserviceConnected = Boolean(
    org?.is_autoservice || user?.organization_is_autoservice || myApplicationState?.organization_is_autoservice,
  );
  const application = myApplicationState?.application;
  const statusMeta = application ? STATUS_MAP[application.status] : null;
  const hasAvailableDirections = !sellerConnected || !autoserviceConnected;

  const canSubmit = useMemo(() => {
    if (!isDirector || application?.status === 'pending') return false;
    const selected = (!sellerConnected && selectedDirections.seller)
      || (!autoserviceConnected && selectedDirections.autoservice);
    return Boolean(selected && contactName.trim() && contactPhone.trim());
  }, [isDirector, application, sellerConnected, autoserviceConnected, selectedDirections, contactName, contactPhone]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setNotice(null);
    try {
      await dispatch(
        submitAutoserviceApplication({
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          message: message.trim() || null,
          requested_seller: !sellerConnected && selectedDirections.seller,
          requested_autoservice: !autoserviceConnected && selectedDirections.autoservice,
        }),
      ).unwrap();
      dispatch(fetchProfile());
      setNotice({
        type: 'success',
        message: 'Заявка отправлена. Мы свяжемся с вами после проверки.',
      });
    } catch (err) {
      setNotice({ type: 'error', message: err || 'Не удалось отправить заявку' });
    }
  };

  if (!user?.organization_id) return null;

  return (
    <Card>
      <Toast message={notice?.type === 'success' ? notice.message : null} variant="success" onClose={() => setNotice(null)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">Направления бизнеса</h3>
          <p className="mt-0.5 text-sm text-ink-muted">Активные возможности организации и подключение новых</p>
        </div>
        {statusMeta ? <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={sellerConnected || !isDirector || application?.status === 'pending'}
          onClick={() => setSelectedDirections((prev) => ({ ...prev, seller: !prev.seller }))}
          className={`rounded-sg border p-4 text-left transition ${sellerConnected ? 'border-success-100 bg-success-50' : selectedDirections.seller ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-line bg-white hover:border-brand-300'} disabled:cursor-default`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">Продавец (авторазбор)</span>
            <Badge tone={sellerConnected ? 'success' : selectedDirections.seller ? 'brand' : 'neutral'}>{sellerConnected ? 'Подключён' : selectedDirections.seller ? 'Выбрано' : 'Можно подключить'}</Badge>
          </span>
          <span className="mt-2 block text-sm text-ink-muted">Продажа запчастей, склад, заказы и покупатели.</span>
        </button>
        <button
          type="button"
          disabled={autoserviceConnected || !isDirector || application?.status === 'pending'}
          onClick={() => setSelectedDirections((prev) => ({ ...prev, autoservice: !prev.autoservice }))}
          className={`rounded-sg border p-4 text-left transition ${autoserviceConnected ? 'border-success-100 bg-success-50' : selectedDirections.autoservice ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-line bg-white hover:border-brand-300'} disabled:cursor-default`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">Автосервис</span>
            <Badge tone={autoserviceConnected ? 'success' : selectedDirections.autoservice ? 'brand' : 'neutral'}>{autoserviceConnected ? 'Подключён' : selectedDirections.autoservice ? 'Выбрано' : 'Можно подключить'}</Badge>
          </span>
          <span className="mt-2 block text-sm text-ink-muted">Запись, клиенты, заказ-наряды и планировщик.</span>
        </button>
      </div>

      {hasAvailableDirections && isDirector && application?.status !== 'pending' ? (
        <div className="mt-5 space-y-4 border-t border-line pt-5">
          <p className="text-sm text-ink-muted">Выберите направление выше и отправьте заявку администратору. Биллинг пока не используется.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><FieldLabel htmlFor="business-contact-name">Контактное лицо</FieldLabel><Input id="business-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
            <div><FieldLabel htmlFor="business-contact-phone">Телефон</FieldLabel><Input id="business-contact-phone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
          </div>
          <div><FieldLabel htmlFor="business-message">Комментарий</FieldLabel><Textarea id="business-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Дополнительная информация (необязательно)" /></div>
          {(myError || notice) && notice?.type !== 'success' ? <FieldHint error>{notice?.message || myError}</FieldHint> : null}
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting || myLoading} loading={submitting}>Отправить на модерацию</Button>
        </div>
      ) : null}

      {application?.status === 'pending' ? (
        <p className="mt-5 rounded-sg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-800">Заявка на дополнительное направление отправлена и ожидает модерации.</p>
      ) : null}
      {application?.status === 'rejected' ? (
        <p className="mt-5 rounded-sg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">Заявка отклонена{application.rejection_reason ? `: ${application.rejection_reason}` : ''}. Можно выбрать направление и отправить новую заявку.</p>
      ) : null}
      {!isDirector && hasAvailableDirections ? <p className="mt-5 text-sm text-ink-muted">Отправить заявку может директор организации.</p> : null}
    </Card>
  );
}
