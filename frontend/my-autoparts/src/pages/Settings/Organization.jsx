import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchOrganization, clearOrganization, updateOrganization } from '../../redux/slices/OrganizationSlice';
import DeliveryMethodsSection from './DeliveryMethodsSection';
import StorageLocationsSection from './StorageLocationsSection';
import OrganizationInfoSection from './OrganizationInfoSection';
import WatermarksSection from './WatermarksSection';
import {
    SettingsCard,
    SettingsSectionHeader,
    SettingsInfoRow,
    SettingsEditButton,
    SettingsEmptyState,
    settingsInputClass,
    settingsBtnPrimary,
    settingsBtnSecondary,
} from './settingsUi';

const OrgNameIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V9a1 1 0 011-1h4a1 1 0 011 1v12M9 21H5a1 1 0 01-1-1v-4a1 1 0 011-1h2M15 21h4a1 1 0 001-1v-4a1 1 0 00-1-1h-2M7 7h.01M12 7h.01M17 7h.01M7 11h.01M12 11h.01M17 11h.01" />
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
);

const IdIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
);

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
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Название</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className={settingsInputClass} required />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Адрес</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className={settingsInputClass} required />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Телефон</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={settingsInputClass} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                    <button type="submit" className={settingsBtnPrimary}>
                        Сохранить
                    </button>
                    <button type="button" onClick={onCancel} className={settingsBtnSecondary}>
                        Отмена
                    </button>
                </div>
            </form>
        );
    }

    return (
        <div className="space-y-3">
            <SettingsInfoRow label="Название" value={org?.name} icon={<OrgNameIcon />} />
            <SettingsInfoRow label="Адрес" value={org?.address} icon={<AddressIcon />} />
            <SettingsInfoRow label="Телефон" value={org?.phone} icon={<PhoneIcon />} />
            <SettingsInfoRow label="ID организации" icon={<IdIcon />}>
                <p className="mt-0.5 font-mono text-sm font-medium text-gray-900">{org?.id || '—'}</p>
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
            <div className="mt-4 space-y-6 px-4 sm:mt-5 sm:px-0">
                <SettingsEmptyState title="Доступ запрещён" message="У вас нет прав для просмотра этой страницы." variant="error" />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div className="mt-4 space-y-6 px-4 sm:mt-5 sm:px-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Организация</h1>
                    <p className="mt-1 text-sm text-gray-500">Настройки компании</p>
                </div>
                <SettingsEmptyState title="Организация не найдена" message="У вас пока нет связанной организации." />
            </div>
        );
    }

    if (loading && !org) {
        return (
            <div className="mt-4 space-y-6 px-4 sm:mt-5 sm:px-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Организация</h1>
                    <p className="mt-1 text-sm text-gray-500">Настройки компании</p>
                </div>
                <SettingsCard>
                    <div className="animate-pulse space-y-4">
                        <div className="h-5 w-1/3 rounded bg-gray-200" />
                        <div className="h-12 rounded-xl bg-gray-100" />
                        <div className="h-12 rounded-xl bg-gray-100" />
                    </div>
                </SettingsCard>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mt-4 space-y-6 px-4 sm:mt-5 sm:px-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Организация</h1>
                </div>
                <SettingsCard>
                    <p className="text-sm text-red-600">Ошибка: {error}</p>
                </SettingsCard>
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-6 px-4 sm:mt-5 sm:px-0">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Организация</h1>
                <p className="mt-1 text-sm text-gray-500">Основные данные, склады и доставка</p>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SettingsCard>
                    <SettingsSectionHeader
                        title="Основная информация"
                        subtitle="Название, адрес и контакты"
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3" />
                            </svg>
                        }
                        action={
                            user?.is_director && (
                                <SettingsEditButton
                                    isEditing={isEditing}
                                    onClick={() => setIsEditing(true)}
                                    onCancel={() => setIsEditing(false)}
                                />
                            )
                        }
                    />
                    <OrganizationForm
                        org={org}
                        isEditing={isEditing && user?.is_director}
                        onUpdate={handleUpdate}
                        onCancel={() => setIsEditing(false)}
                    />
                </SettingsCard>

                <OrganizationInfoSection org={org} onUpdate={handleUpdate} />
            </div>

            <WatermarksSection org={org} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <StorageLocationsSection orgId={orgId} />
                <DeliveryMethodsSection orgId={orgId} />
            </div>
        </div>
    );
}
