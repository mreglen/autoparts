import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Modal, { ConfirmDialog } from '../../components/UI/Modal';
import { useAuthReady } from '../../hooks/useAuthReady';
import { PageHeader } from '../../components/UI/SectionHeader';
import Card from '../../components/UI/Card';
import { Badge } from '../../components/UI/Badge';
import Button from '../../components/UI/Button';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  approveAutoserviceApplication,
  disableAutoserviceOrganization,
  fetchAutoserviceApplications,
  fetchAutoserviceConnectedOrgs,
  pauseAutoserviceOrganization,
  rejectAutoserviceApplication,
  resumeAutoserviceOrganization,
} from '../../redux/slices/AutoserviceAdminSlice';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

const APPLICATION_STATUS = {
  pending: { label: 'Ожидает', tone: 'warning' },
  approved: { label: 'Одобрена', tone: 'success' },
  rejected: { label: 'Отклонена', tone: 'danger' },
};

export default function AutoserviceApplicationsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isReady, user } = useAuthReady();
  const { applications, connectedOrgs, loading, actionLoading, error } = useSelector(
    (state) => state.autoserviceAdmin,
  );

  const [disableOrgId, setDisableOrgId] = useState(null);
  const [toggleOrgId, setToggleOrgId] = useState(null);
  const [toggleToPaused, setToggleToPaused] = useState(true);
  const [rejectAppId, setRejectAppId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = useCallback(() => {
    dispatch(fetchAutoserviceApplications());
    dispatch(fetchAutoserviceConnectedOrgs());
  }, [dispatch]);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.is_admin) navigate('/', { replace: true });
  }, [isReady, user, navigate]);

  useEffect(() => {
    if (isReady && user?.is_admin) {
      refresh();
    }
  }, [isReady, user?.is_admin, refresh]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/moderation/autoservice-applications') {
        refresh();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [refresh]);

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

  const handleApprove = async (applicationId) => {
    await dispatch(approveAutoserviceApplication(applicationId));
    refresh();
  };

  const handleReject = async (event) => {
    event.preventDefault();
    if (!rejectAppId) return;
    await dispatch(
      rejectAutoserviceApplication({ applicationId: rejectAppId, reason: rejectReason.trim() }),
    );
    setRejectAppId(null);
    setRejectReason('');
    refresh();
  };

  if (!isReady || !user?.is_admin) return null;

  return (
    <div className="space-y-8 max-lg:pb-[var(--sg-mobile-bottom-nav-total,4.5rem)]">
      <PageHeader
        title="Регистрация автосервиса"
        subtitle="Подключённые автосервисы и управление тарифом"
      />

      {error ? (
        <div className="rounded-sg-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sg-subtitle text-ink">Заявки на подключение</h2>
        {loading ? (
          <Card>
            <p className="text-sm text-ink-muted">Загрузка…</p>
          </Card>
        ) : applications.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">Нет заявок</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const statusMeta = APPLICATION_STATUS[app.status] || {
                label: app.status,
                tone: 'neutral',
              };
              return (
                <Card key={app.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink">
                          {app.organization_name || `Организация ${app.organization_id}`}
                        </h3>
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {app.contact_name}
                        {app.contact_phone ? ` · ${app.contact_phone}` : ''}
                        {app.applicant_name ? ` · заявитель: ${app.applicant_name}` : ''}
                      </p>
                      {app.message ? (
                        <p className="mt-1 text-sm text-ink-muted">{app.message}</p>
                      ) : null}
                      {app.rejection_reason ? (
                        <p className="mt-1 text-sm text-danger-700">
                          Причина отклонения: {app.rejection_reason}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-ink-muted">
                        Подана: {formatDate(app.created_at)}
                        {app.reviewed_at ? ` · рассмотрена: ${formatDate(app.reviewed_at)}` : ''}
                      </p>
                    </div>
                    {app.status === 'pending' ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          onClick={() => handleApprove(app.id)}
                          disabled={actionLoading}
                        >
                          Одобрить
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRejectAppId(app.id);
                            setRejectReason('');
                          }}
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
        {loading ? (
          <Card>
            <p className="text-sm text-ink-muted">Загрузка…</p>
          </Card>
        ) : connectedOrgs.length === 0 ? (
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
                        variant="secondary"
                        onClick={() => {
                          setToggleOrgId(org.organization_id);
                          setToggleToPaused(false);
                        }}
                        disabled={actionLoading}
                      >
                        Возобновить
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setToggleOrgId(org.organization_id);
                          setToggleToPaused(true);
                        }}
                        disabled={actionLoading}
                      >
                        Приостановить
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => setDisableOrgId(org.organization_id)}
                      disabled={actionLoading}
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

      <Modal
        open={Boolean(rejectAppId)}
        onClose={() => setRejectAppId(null)}
        title="Отклонить заявку"
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setRejectAppId(null)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              form="reject-autoservice-application-form"
              variant="danger"
              className="w-full sm:w-auto"
              disabled={actionLoading}
            >
              Отклонить
            </Button>
          </div>
        )}
      >
        <form id="reject-autoservice-application-form" onSubmit={handleReject}>
          <label
            htmlFor="reject-autoservice-application-reason"
            className="mb-2 block text-sm font-medium text-ink"
          >
            Причина отклонения
          </label>
          <textarea
            id="reject-autoservice-application-reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={4}
            className="w-full min-h-[6rem] rounded-xl border border-gray-300 px-3 py-2 text-sm max-md:text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Например: неполные данные, дубликат заявки…"
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(disableOrgId)}
        onClose={() => setDisableOrgId(null)}
        onConfirm={handleDisable}
        title="Отключить автосервис?"
        message="Организация потеряет доступ к автосервисному кабинету. Продавец продолжит работать как обычно."
        confirmLabel="Отключить"
        danger
        loading={actionLoading}
      />
      <ConfirmDialog
        open={Boolean(toggleOrgId)}
        onClose={() => setToggleOrgId(null)}
        onConfirm={handleTogglePause}
        title={toggleToPaused ? 'Приостановить автосервис?' : 'Возобновить автосервис?'}
        message={
          toggleToPaused
            ? 'Автосервис будет приостановлен: наценка на новые запчасти станет как у обычного продавца.'
            : 'Автосервис будет возобновлен: наценка на новые запчасти станет автосервисной (7%).'
        }
        confirmLabel={toggleToPaused ? 'Приостановить' : 'Возобновить'}
        loading={actionLoading}
      />
    </div>
  );
}
