import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/UI/Modal';
import { useAuthReady } from '../../hooks/useAuthReady';
import { PageHeader } from '../../components/UI/SectionHeader';
import Card from '../../components/UI/Card';
import { Badge } from '../../components/UI/Badge';
import Button from '../../components/UI/Button';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  disableAutoserviceOrganization,
  fetchAutoserviceConnectedOrgs,
  pauseAutoserviceOrganization,
  resumeAutoserviceOrganization,
} from '../../redux/slices/AutoserviceAdminSlice';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function AutoserviceApplicationsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isReady, user } = useAuthReady();
  const { connectedOrgs, loading, actionLoading, error } = useSelector(
    (state) => state.autoserviceAdmin,
  );

  const [disableOrgId, setDisableOrgId] = useState(null);
  const [toggleOrgId, setToggleOrgId] = useState(null);
  const [toggleToPaused, setToggleToPaused] = useState(true);

  const refresh = useCallback(() => {
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
