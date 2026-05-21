import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOrganization, clearOrganization } from '../../redux/slices/OrganizationSlice';
import { normalizeImageUrl } from '../../utils/apiClient';

const formatPhoneNumber = (value) => {
    if (!value) return '';
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('7') || digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }
    let formatted = '+7 ';
    if (digits.length > 1) formatted += '(' + digits.slice(1, 4);
    if (digits.length > 4) formatted += ') ' + digits.slice(4, 7);
    if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
    if (digits.length > 9) formatted += '-' + digits.slice(9, 11);
    return formatted;
};

function OrgInfoRow({ icon, label, value, mono }) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                <p className={`mt-0.5 text-sm font-medium text-gray-900 break-words ${mono ? 'font-mono' : ''}`}>
                    {value || '—'}
                </p>
            </div>
        </div>
    );
}

const OrgNameIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 21h18M9 21V9a1 1 0 011-1h4a1 1 0 011 1v12M9 21H5a1 1 0 01-1-1v-4a1 1 0 011-1h2M15 21h4a1 1 0 001-1v-4a1 1 0 00-1-1h-2M7 7h.01M12 7h.01M17 7h.01M7 11h.01M12 11h.01M17 11h.01"
        />
    </svg>
);

const AddressIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const PhoneIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
        />
    </svg>
);

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
            <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`.trim()}>
                <div className="flex animate-pulse gap-4">
                    <div className="h-16 w-16 rounded-xl bg-gray-200" />
                    <div className="flex-1 space-y-3">
                        <div className="h-5 w-1/3 rounded bg-gray-200" />
                        <div className="h-12 rounded-xl bg-gray-100" />
                        <div className="h-12 rounded-xl bg-gray-100" />
                    </div>
                </div>
            </section>
        );
    }

    if (error || !org) {
        return (
            <section className={`rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6 ${className}`.trim()}>
                <p className="text-sm text-red-600">{error || 'Организация не найдена'}</p>
            </section>
        );
    }

    const logoUrl = org.logo_organization ? normalizeImageUrl(org.logo_organization) : null;
    const orgInitials = (org.name || 'Ор').slice(0, 2).toUpperCase();

    return (
        <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`.trim()}>
            <div className="flex gap-4 border-b border-gray-100 pb-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
                    {logoUrl ? (
                        <img src={logoUrl} alt={org.name || 'Логотип'} className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-lg font-bold text-indigo-600">{orgInitials}</span>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-gray-900">Организация</h3>
                    <p className="mt-0.5 truncate text-sm font-medium text-gray-700">{org.name || 'Без названия'}</p>
                    <p className="mt-1 font-mono text-xs text-gray-500">ID {org.id}</p>
                </div>
            </div>

            <div className="mt-5 space-y-3">
                <OrgInfoRow label="Название" value={org.name} icon={<OrgNameIcon />} />
                <OrgInfoRow label="Адрес" value={org.address} icon={<AddressIcon />} />
                <OrgInfoRow
                    label="Телефон"
                    value={org.phone ? formatPhoneNumber(org.phone) : null}
                    icon={<PhoneIcon />}
                />
            </div>
        </section>
    );
}
