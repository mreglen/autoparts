import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrganization, clearOrganization } from '../../redux/slices/OrganizationSlice';
import { normalizeImageUrl } from '../../utils/apiClient';
import { ChevronRight, ProfileBlock } from './profileUi';

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

export default function OrganizationCard({ orgId }) {
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
      <ProfileBlock title="Организация">
        <div className="flex animate-pulse items-center gap-3 px-4 py-4">
          <div className="h-11 w-11 rounded-full bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-gray-100" />
            <div className="h-3 w-20 rounded bg-gray-50" />
          </div>
        </div>
      </ProfileBlock>
    );
  }

  if (error || !org) {
    return (
      <ProfileBlock title="Организация">
        <p className="px-4 py-4 text-sm text-gray-500">{error || 'Организация не найдена'}</p>
      </ProfileBlock>
    );
  }

  const logoUrl = org.logo_organization ? normalizeImageUrl(org.logo_organization) : null;
  const orgInitials = (org.name || 'Ор').slice(0, 2).toUpperCase();
  const phone = org.phone ? formatPhoneNumber(org.phone) : null;

  return (
    <ProfileBlock title="Организация">
      <Link
        to={`/organizations/${org.id}`}
        className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5 hover:bg-gray-50"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-gray-500">{orgInitials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-gray-900">{org.name || 'Организация'}</p>
          {phone ? <p className="truncate text-sm text-gray-400">{phone}</p> : null}
        </div>
        <ChevronRight />
      </Link>
      {org.address ? (
        <div className="px-4 py-3.5">
          <p className="text-sm text-gray-400">Адрес</p>
          <p className="mt-0.5 text-[15px] text-gray-900">{org.address}</p>
        </div>
      ) : null}
    </ProfileBlock>
  );
}
