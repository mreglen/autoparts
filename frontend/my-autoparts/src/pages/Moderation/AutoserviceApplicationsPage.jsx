import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';
import { useAuthReady } from '../../hooks/useAuthReady';
import { PageHeader } from '../../components/UI/SectionHeader';
import Card from '../../components/UI/Card';
import { Badge } from '../../components/UI/Badge';
import Button from '../../components/UI/Button';
import {
  approveAutoserviceApplication,
  disableAutoserviceOrganization,
  fetchAutoserviceApplications,
  fetchAutoserviceConnectedOrgs,
  pauseAutoserviceOrganization,
  resumeAutoserviceOrganization,
  rejectAutoserviceApplication,
} from '../../redux/slices/AutoserviceAdminSlice';

const STATUS_LABELS = {
  pending: { label: 'Ожидает', tone: 'warning' },
  approved: { label: 'Подключён', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' },
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function AutoserviceApplicationsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isReady, user } = useAuthReady();
  const { applications, connectedOrgs, loading, actionLoading, error } = useSelector(
    (state) => state.autoserviceAdmin,
  );

  const [approveId, setApproveId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [disableOrgId, setDisableOrgId] = useState(null);
  const [toggleOrgId, setToggleOrgId] = useState(null);
  const [toggleToPaused, setToggleToPaused] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.is_admin) navigate('/', { replace: true });
  }, [isReady, user, navigate]);

  useEffect(() => {
    if (isReady && user?.is_admin) {
      dispatch(fetchAutoserviceApplications());
      dispatch(fetchAutoserviceConnectedOrgs());
    }
  }, [dispatch, isReady, user?.is_admin]);

  const refresh = () => {
    dispatch(fetchAutoserviceApplications());
    dispatch(fetchAutoserviceConnectedOrgs());
  };

  const handleApprove = async () => {
    if (!approveId) return;
    await dispatch(approveAutoserviceApplication(approveId));
    setApproveId(null);
    refresh();
  };

  const handleReject = async () => {
    if (!rejectId) return;
    await dispatch(rejectAutoserviceApplication({ applicationId: rejectId, reason: rejectReason }));
    setRejectId(null);
    setRejectReason('');
    refresh();
  };

  const handleDisable = async () => {
    if (!disableOrgId) return;
    await dispatch(disableAutoserviceOrganization(disableOrgId));
    setDisableOrgId(null);
    refresh();
  };

  const handleTogglePause = async () => {
    if (!toggleOrgId) return;
    if (toggleToPaused) {
      await dispatch(pauseAutoserviceOrganization(toggleOrgId));
    } else {
      await dispatch(resumeAutoserviceOrganization(toggleOrgId));
    }
    setToggleOrgId(null);
    refresh();
  };

  if (!isReady || !user?.is_admin) return null;

  const pendingApps = applications.filter((item) => item.status === 'pending');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Регистрация автосервиса"
        subtitle="Заявки на подключение тарифа и список подключённых автосервисов"
      />

      {error ? (
        <div className="rounded-sg-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sg-subtitle text-ink">Заявки</h2>
          <Badge tone="warning">{pendingApps.length} в ожидании</Badge>
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-ink-muted">Загрузка…</p>
          </Card>
        ) : applications.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">Заявок пока нет</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {applications.map((item) => {
              const status = STATUS_LABELS[item.status] || STATUS_LABELS.pending;
              return (
                <Card key={item.id} hover>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink">
                          {item.organization_name || item.organization_id}
                        </h3>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-ink-muted">
                        Контакт: {item.contact_name} · {item.contact_phone}
                      </p>
                      {item.applicant_name ? (
                        <p className="text-sm text-ink-muted">Заявитель: {item.applicant_name}</p>
                      ) : null}
                      {item.message ? (
                        <p className="text-sm text-ink-soft">{item.message}</p>
                      ) : null}
                      <p className="text-xs text-ink-muted">Отправлено: {formatDate(item.created_at)}</p>
                      {item.rejection_reason ? (
                        <p className="text-sm text-danger-700">Причина отказа: {item.rejection_reason}</p>
                      ) : null}
                    </div>

                    {item.status === 'pending' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => setApproveId(item.id)}
                          disabled={actionLoading}
                        >
                          Подключить
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setRejectId(item.id)}
                          disabled={actionLoading}
                        >
                          Отклонить
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sg-subtitle text-ink">Подключённые автосервисы</h2>
        {connectedOrgs.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">Нет подключённых организаций</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {connectedOrgs.map((org) => (
              <Card key={org.organization_id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-ink">{org.organization_name}</h3>
                    <p className="text-sm text-ink-muted">
                      ID {org.organization_id}
                      {org.organization_phone ? ` · ${org.organization_phone}` : ''}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Подключён: {formatDate(org.approved_at)}
                    </p>
                    {org.is_paused ? (
                      <div className="mt-2">
                        <Badge tone="warning">Пауза</Badge>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {org.is_paused ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setToggleOrgId(org.organization_id);
                          setToggleToPaused(false);
                        }}
                      >
                        Возобновить
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setToggleOrgId(org.organization_id);
                          setToggleToPaused(true);
                        }}
                      >
                        Приостановить
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDisableOrgId(org.organization_id)}
                    >
                      Отключить
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmationModal
        isOpen={Boolean(approveId)}
        onClose={() => setApproveId(null)}
        onConfirm={handleApprove}
        title="Подключить автосервис?"
        message="Организация получит доступ к автосервисному кабинету и переключателю «Продавец / Автосервис»."
        confirmText="Подключить"
      />

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-sg-lg border border-line bg-surface p-6 shadow-sg-lg">
            <h3 className="text-lg font-semibold text-ink">Отклонить заявку?</h3>
            <p className="mt-2 text-sm text-ink-muted">При необходимости укажите причину:</p>
            <textarea
              className="mt-3 w-full rounded-sg border border-line px-3 py-2 text-sm"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина отказа (необязательно)"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setRejectId(null); setRejectReason(''); }}>
                Отмена
              </Button>
              <Button variant="danger" onClick={handleReject} disabled={actionLoading}>
                Отклонить
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={Boolean(disableOrgId)}
        onClose={() => setDisableOrgId(null)}
        onConfirm={handleDisable}
        title="Отключить автосервис?"
        message="Организация потеряет доступ к автосервисному кабинету. Продавец продолжит работать как обычно."
        confirmText="Отключить"
      />
      <ConfirmationModal
        isOpen={Boolean(toggleOrgId)}
        onClose={() => setToggleOrgId(null)}
        onConfirm={handleTogglePause}
        title={toggleToPaused ? 'Приостановить автосервис?' : 'Возобновить автосервис?'}
        message={
          toggleToPaused
            ? 'Автосервис будет приостановлен: наценка на новые запчасти станет как у обычного продавца.'
            : 'Автосервис будет возобновлен: наценка на новые запчасти станет автосервисной (7%).'
        }
        confirmText={toggleToPaused ? 'Приостановить' : 'Возобновить'}
      />
    </div>
  );
}
