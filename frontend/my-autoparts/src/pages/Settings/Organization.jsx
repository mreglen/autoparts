import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchOrganization, clearOrganization, updateOrganization } from '../../redux/slices/OrganizationSlice';
import DeliveryMethodsSection from './DeliveryMethodsSection';
import PaymentMethodsSection from './PaymentMethodsSection';
import StorageLocationsSection from './StorageLocationsSection';
import OrganizationInfoSection from './OrganizationInfoSection';
import WatermarksSection from './WatermarksSection';
import MarketplaceSiteInfoSection from './MarketplaceSiteInfoSection';
import AutoserviceTariffSection from './AutoserviceTariffSection';
import { PageHeader } from '../../components/UI/SectionHeader';
import Card from '../../components/UI/Card';
import {
    SettingsSectionHeader,
    SettingsInfoRow,
    SettingsEditButton,
    SettingsEmptyState,
    settingsInputClass,
    settingsBtnPrimary,
    settingsBtnSecondary,
} from './settingsUi';

function IconWrap({ children }) {
    return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-subtle text-ink-muted">
            {children}
        </span>
    );
}

const Icons = {
    building: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
    pin: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),
    phone: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
    ),
    id: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
    ),
    info: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
};

function OrganizationForm({ org, isEditing, onUpdate, onCancel }) {
    const [formData, setFormData] = useState({ name: '', address: '', phone: '' });

    useEffect(() => {
        if (org) {
            setFormData({
                name: org.name || '',
                address: org.address || '',
                phone: org.phone || '',
            });
        }
    }, [org]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onUpdate(formData);
    };

    if (isEditing) {
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-muted">Название</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className={settingsInputClass} required />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-muted">Адрес</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className={settingsInputClass} required />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-muted">Телефон</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={settingsInputClass} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                    <button type="submit" className={settingsBtnPrimary}>Сохранить</button>
                    <button type="button" onClick={onCancel} className={settingsBtnSecondary}>Отмена</button>
                </div>
            </form>
        );
    }

    return (
        <div className="space-y-3">
            <SettingsInfoRow label="Название" value={org?.name} icon={<IconWrap>{Icons.building}</IconWrap>} />
            <SettingsInfoRow label="Адрес" value={org?.address} icon={<IconWrap>{Icons.pin}</IconWrap>} />
            <SettingsInfoRow label="Телефон" value={org?.phone} icon={<IconWrap>{Icons.phone}</IconWrap>} />
            <SettingsInfoRow label="ID организации" icon={<IconWrap>{Icons.id}</IconWrap>}>
                <p className="mt-0.5 font-mono text-sm font-medium text-ink">{org?.id || '—'}</p>
            </SettingsInfoRow>
        </div>
    );
}

export default function Organization() {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const { data: org, loading, error } = useSelector((state) => state.organization);
    const [isEditing, setIsEditing] = useState(false);

    const canAccess = user?.is_seller || user?.is_director;
    const orgId = user?.organization_id;
    const isDirector = Boolean(user?.is_director);

    useEffect(() => {
        if (!orgId) return undefined;
        dispatch(fetchOrganization(orgId));
        return () => dispatch(clearOrganization());
    }, [dispatch, orgId]);

    const handleUpdate = async (formData) => {
        try {
            await dispatch(updateOrganization({ id: orgId, ...formData })).unwrap();
            setIsEditing(false);
        } catch (err) {
            console.error('Error updating organization:', err);
        }
    };

    if (!canAccess) {
        return (
            <div className="space-y-6">
                <SettingsEmptyState title="Доступ запрещён" message="У вас нет прав для просмотра этой страницы." variant="error" />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div className="space-y-6">
                <PageHeader title="Организация" />
                <SettingsEmptyState title="Организация не найдена" message="У вас пока нет связанной организации." />
            </div>
        );
    }

    if (loading && !org) {
        return (
            <div className="space-y-6">
                <PageHeader title="Организация" subtitle="Склады, доставка, брендинг и автосервис" />
                <Card>
                    <div className="animate-pulse space-y-4">
                        <div className="h-5 w-1/3 rounded bg-surface-subtle" />
                        <div className="h-12 rounded-sg bg-surface-subtle" />
                        <div className="h-12 rounded-sg bg-surface-subtle" />
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <PageHeader title="Организация" />
                <Card>
                    <p className="text-sm text-danger-700">Ошибка: {error}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Организация"
                subtitle="Склады, доставка, брендинг и подключение автосервиса"
            />

            <AutoserviceTariffSection user={user} isDirector={isDirector} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card padding="none" className="overflow-hidden">
                    <div className="border-b border-line-soft px-5 py-4 sm:px-6">
                        <SettingsSectionHeader
                            title="Основная информация"
                            subtitle="Название, адрес и контакты"
                            icon={<IconWrap>{Icons.info}</IconWrap>}
                            action={
                                isDirector && (
                                    <SettingsEditButton
                                        isEditing={isEditing}
                                        onClick={() => setIsEditing(true)}
                                        onCancel={() => setIsEditing(false)}
                                    />
                                )
                            }
                        />
                    </div>
                    <div className="px-5 py-4 sm:px-6">
                        <OrganizationForm
                            org={org}
                            isEditing={isEditing && isDirector}
                            onUpdate={handleUpdate}
                            onCancel={() => setIsEditing(false)}
                        />
                    </div>
                </Card>

                <OrganizationInfoSection org={org} onUpdate={handleUpdate} />
            </div>

            <WatermarksSection org={org} />
            <MarketplaceSiteInfoSection org={org} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <StorageLocationsSection orgId={orgId} />
                <DeliveryMethodsSection orgId={orgId} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PaymentMethodsSection orgId={orgId} />
            </div>
        </div>
    );
}
