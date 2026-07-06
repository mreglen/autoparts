import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrganization, clearOrganization } from '../../redux/slices/OrganizationSlice';
import { normalizeImageUrl } from '../../utils/apiClient';

const formatPhoneNumber = (value) => {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }
  let formatted = '+7 ';
  if (digits.length > 1) formatted += `(${digits.slice(1, 4)}`;
  if (digits.length > 4) formatted += `) ${digits.slice(4, 7)}`;
  if (digits.length > 7) formatted += `-${digits.slice(7, 9)}`;
  if (digits.length > 9) formatted += `-${digits.slice(9, 11)}`;
  return formatted;
};

function OrgField({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{value}</span>
    </div>
  );
}

export default function OrganizationCard({ orgId, className = '' }) {
  const dispatch = useDispatch();
  const { data: org, loading, error } = useSelector((state) => state.organization);

  useEffect(() => {
    if (!orgId) return undefined;
    dispatch(fetchOrganization(orgId));
    return () => dispatch(clearOrganization());
  }, [dispatch, orgId]);

  if (!orgId) return null;

  if (loading) {
    return (
      <section className={`animate-pulse rounded-xl border border-gray-200 bg-white p-5 sm:p-6 ${className}`.trim()}>
        <div className="flex gap-3">
          <div className="h-12 w-12 rounded-lg bg-gray-100" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-32 rounded bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-50" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !org) {
    return (
      <section className={`rounded-xl border border-gray-200 bg-white p-5 sm:p-6 ${className}`.trim()}>
        <p className="text-sm text-gray-500">{error || 'Организация не найдена'}</p>
      </section>
    );
  }

  const logoUrl = org.logo_organization ? normalizeImageUrl(org.logo_organization) : null;
  const orgInitials = (org.name || 'Ор').slice(0, 2).toUpperCase();

  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 sm:p-6 ${className}`.trim()}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-gray-500">{orgInitials}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{org.name || 'Организация'}</p>
          <p className="font-mono text-xs text-gray-400">{org.id}</p>
        </div>
      </div>

      {(org.address || org.phone) && (
        <div className="mt-4 border-t border-gray-100 pt-1">
          <OrgField label="Адрес" value={org.address} />
          <OrgField label="Телефон" value={org.phone ? formatPhoneNumber(org.phone) : null} />
        </div>
      )}
    </section>
  );
}
