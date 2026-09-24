import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest, apiRequestUnauth } from '../../utils/apiClient';
import { BECOME_CLIENT_CONFIRM } from '../../utils/autoservicePublic';
import { Button, PageHeader } from '../../components/UI';
import { Badge } from '../../components/UI/Badge';
import { ConfirmDialog } from '../../components/UI/Modal';

export default function AutoserviceWelcomePage() {
  const { isReady, isAuthenticated } = useAuthReady();
  const clientStatus = useSelector((state) => state.autoserviceClient.status);

  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [myOrgIds, setMyOrgIds] = useState(() => new Set());
  const [confirmOrg, setConfirmOrg] = useState(null);
  const [savingOrgId, setSavingOrgId] = useState(null);
  const [error, setError] = useState('');

  const loadOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const data = await apiRequestUnauth('/public/autoservice/organizations');
      setOrgs(Array.isArray(data) ? data : []);
    } catch {
      setOrgs([]);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const loadMyOrgs = useCallback(async () => {
    try {
      const data = await apiRequest('/autoservice/clients/me/orgs');
      setMyOrgIds(new Set((Array.isArray(data) ? data : []).map((row) => row.organization_id)));
    } catch {
      setMyOrgIds(new Set());
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadMyOrgs();
    }
  }, [isReady, isAuthenticated, loadMyOrgs]);

  const handleBecomeClient = async () => {
    if (!confirmOrg) return;
    setError('');
    setSavingOrgId(confirmOrg.organization_id);
    try {
      await apiRequest(
        `/autoservice/clients/me?organization_id=${encodeURIComponent(confirmOrg.organization_id)}`,
        { method: 'POST' },
      );
      await loadMyOrgs();
      setConfirmOrg(null);
    } catch (err) {
      setError(err?.message || 'Не удалось стать клиентом');
    } finally {
      setSavingOrgId(null);
    }
  };

  const isEmpty = useMemo(() => !orgsLoading && orgs.length === 0, [orgsLoading, orgs]);

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader title="Автосервисы" />

      <p className="mt-2 text-sm text-ink-soft">
        Станьте клиентом сервиса, чтобы записываться на ремонт и видеть историю работ.
      </p>

      {error ? (
        <p className="mt-4 rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 divide-y divide-line-soft rounded-sg-lg border border-line bg-surface">
        {orgsLoading ? (
          <p className="px-4 py-6 text-center text-sm text-ink-muted">Загрузка…</p>
        ) : isEmpty ? (
          <p className="px-4 py-6 text-center text-sm text-ink-muted">
            Пока нет подключённых автосервисов
          </p>
        ) : (
          orgs.map((org) => {
            const alreadyClient = myOrgIds.has(org.organization_id);
            return (
              <div key={org.organization_id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {org.name || 'Автосервис'}
                    </p>
                    {(org.address || org.phone) ? (
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {[org.address, org.phone].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {org.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{org.description}</p>
                    ) : null}
                  </div>
                  {alreadyClient ? (
                    <Badge tone="success" className="shrink-0">Вы клиент</Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setConfirmOrg(org)}
                      disabled={!isAuthenticated || savingOrgId === org.organization_id || clientStatus === 'loading'}
                      loading={savingOrgId === org.organization_id}
                    >
                      Стать клиентом
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {isAuthenticated && myOrgIds.size > 0 ? (
        <div className="mt-4 text-center">
          <Link to="/autoservice/repair-booking" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Перейти к записи на ремонт
          </Link>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmOrg)}
        onClose={() => setConfirmOrg(null)}
        onConfirm={handleBecomeClient}
        title="Стать клиентом?"
        message={confirmOrg ? BECOME_CLIENT_CONFIRM(confirmOrg.name || 'этого сервиса') : ''}
        confirmLabel="Стать клиентом"
        loading={Boolean(savingOrgId)}
      />
    </div>
  );
}
