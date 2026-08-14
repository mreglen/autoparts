import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    fetchOrganization,
    clearOrganization,
    updateOrganization,
    uploadOrganizationLogo,
} from '../../redux/slices/OrganizationSlice';
import DeliveryMethodsSection from './DeliveryMethodsSection';
import PaymentMethodsSection from './PaymentMethodsSection';
import StorageLocationsSection from './StorageLocationsSection';
import WatermarksSection from './WatermarksSection';
import MarketplaceSiteInfoSection from './MarketplaceSiteInfoSection';
import AutoserviceTariffSection from './AutoserviceTariffSection';
import { PageHeader } from '../../components/UI/SectionHeader';
import Button from '../../components/UI/Button';
import { normalizeImageUrl } from '../../utils/apiClient';
import DadataAddressInput from '../../components/DadataAddressInput/DadataAddressInput';
import {
    SettingsCard,
    SettingsGroupLabel,
    SettingsEmptyState,
    settingsInputClass,
} from './settingsUi';

function OrgLogo({ src, name, size = 'lg' }) {
    const box = size === 'lg' ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-16 w-16';
    if (src) {
        return (
            <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white shadow-sg-sm ${box}`}>
                <img src={normalizeImageUrl(src)} alt={name || 'Логотип'} className="max-h-full max-w-full object-contain p-2" />
            </div>
        );
    }
    const letter = (name || 'О').trim().charAt(0).toUpperCase();
    return (
        <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-sg-sm ${box}`}>
            {letter}
        </div>
    );
}

export default function Organization() {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const { data: org, loading, error } = useSelector((state) => state.organization);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        description: '',
        logo: '',
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');

    const canAccess = user?.is_seller || user?.is_director;
    const orgId = user?.organization_id;
    const isDirector = Boolean(user?.is_director);

    useEffect(() => {
        if (!orgId) return undefined;
        dispatch(fetchOrganization(orgId));
        return () => dispatch(clearOrganization());
    }, [dispatch, orgId]);

    useEffect(() => {
        if (!org) return;
        const logoValue =
            org.logo_organization && org.logo_organization.startsWith('blob:') ? '' : org.logo_organization || '';
        setFormData({
            name: org.name || '',
            address: org.address || '',
            phone: org.phone || '',
            description: org.description || '',
            logo: logoValue,
        });
        setLogoPreview(org.logo_organization || '');
    }, [org]);

    const startEditing = () => {
        setFormError('');
        setIsEditing(true);
    };

    const cancelEditing = () => {
        if (org) {
            const logoValue =
                org.logo_organization && org.logo_organization.startsWith('blob:') ? '' : org.logo_organization || '';
            setFormData({
                name: org.name || '',
                address: org.address || '',
                phone: org.phone || '',
                description: org.description || '',
                logo: logoValue,
            });
            setLogoPreview(org.logo_organization || '');
        }
        if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
        setLogoFile(null);
        setFormError('');
        setIsEditing(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.address.trim()) {
            setFormError('Укажите название и адрес организации');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            let logoUrl = formData.logo;
            if (logoFile) {
                logoUrl = await dispatch(uploadOrganizationLogo(logoFile)).unwrap();
            }
            await dispatch(
                updateOrganization({
                    id: orgId,
                    name: formData.name,
                    address: formData.address,
                    phone: formData.phone,
                    description: formData.description,
                    logo_organization: logoUrl,
                }),
            ).unwrap();
            if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
            setLogoFile(null);
            setIsEditing(false);
        } catch (err) {
            setFormError(typeof err === 'string' ? err : 'Не удалось сохранить организацию');
        } finally {
            setSaving(false);
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
                <PageHeader title="Организация" subtitle="Профиль, склады и настройки продаж" />
                <div className="animate-pulse rounded-sg-lg border border-line bg-surface p-6 shadow-sg">
                    <div className="flex gap-5">
                        <div className="h-28 w-28 rounded-2xl bg-surface-subtle" />
                        <div className="flex-1 space-y-3 pt-2">
                            <div className="h-6 w-1/3 rounded bg-surface-subtle" />
                            <div className="h-4 w-2/3 rounded bg-surface-subtle" />
                            <div className="h-4 w-1/2 rounded bg-surface-subtle" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <PageHeader title="Организация" />
                <SettingsEmptyState title="Не удалось загрузить" message={error} variant="error" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <PageHeader
                className="mb-0"
                title="Организация"
                subtitle="Профиль компании, склады, доставка и витрина"
            />

            <SettingsCard padding={false} className="overflow-hidden">
                <div className="bg-gradient-to-br from-brand-50 via-surface to-surface px-5 py-6 sm:px-8 sm:py-8">
                    {isEditing && isDirector ? (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="flex flex-col gap-5 sm:flex-row">
                                <div className="shrink-0 space-y-3">
                                    <OrgLogo src={logoPreview} name={formData.name} />
                                    <label className="block">
                                        <span className="mb-1.5 block text-xs font-medium text-ink-muted">Логотип</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="block w-full max-w-[14rem] text-xs text-ink-muted file:mr-3 file:rounded-sg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"
                                        />
                                    </label>
                                </div>
                                <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Название</label>
                                        <input type="text" name="name" value={formData.name} onChange={handleChange} className={settingsInputClass} required />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Адрес</label>
                                        <DadataAddressInput
                                            id="organization-address"
                                            value={formData.address}
                                            onChange={(value) => setFormData((prev) => ({ ...prev, address: value }))}
                                            placeholder="Город, улица, дом"
                                            className={settingsInputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Телефон</label>
                                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={settingsInputClass} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="mb-1.5 block text-xs font-medium text-ink-muted">Описание</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            maxLength={500}
                                            rows={3}
                                            className={settingsInputClass}
                                            placeholder="Кратко о компании для витрины"
                                        />
                                        <p className="mt-1 text-right text-xs text-ink-muted">{formData.description.length}/500</p>
                                    </div>
                                </div>
                            </div>
                            {formError ? (
                                <p className="rounded-sg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" size="sm" loading={saving} disabled={saving}>
                                    Сохранить
                                </Button>
                                <Button type="button" variant="secondary" size="sm" onClick={cancelEditing} disabled={saving}>
                                    Отмена
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                            <OrgLogo src={org?.logo_organization} name={org?.name} />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{org?.name || 'Организация'}</h2>
                                        <div className="mt-3 flex flex-col gap-1.5 text-sm text-ink-muted">
                                            <p className="flex items-start gap-2">
                                                <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="break-words">{org?.address || 'Адрес не указан'}</span>
                                            </p>
                                            <p className="flex items-center gap-2">
                                                <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                {org?.phone || 'Телефон не указан'}
                                            </p>
                                        </div>
                                    </div>
                                    {isDirector ? (
                                        <Button type="button" variant="secondary" size="sm" onClick={startEditing}>
                                            Изменить
                                        </Button>
                                    ) : null}
                                </div>
                                {org?.description ? (
                                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">{org.description}</p>
                                ) : (
                                    <p className="mt-4 text-sm text-ink-muted">Описание для витрины пока не заполнено.</p>
                                )}
                                <p className="mt-4 font-mono text-xs text-ink-faint">ID {org?.id}</p>
                            </div>
                        </div>
                    )}
                </div>
            </SettingsCard>

            <section>
                <SettingsGroupLabel>Склады</SettingsGroupLabel>
                <StorageLocationsSection orgId={orgId} />
            </section>

            <section>
                <SettingsGroupLabel>Продажи</SettingsGroupLabel>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <DeliveryMethodsSection orgId={orgId} />
                    <PaymentMethodsSection orgId={orgId} />
                </div>
            </section>

            <section>
                <SettingsGroupLabel>Витрина</SettingsGroupLabel>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <WatermarksSection org={org} />
                    <MarketplaceSiteInfoSection org={org} />
                </div>
            </section>

            <section>
                <SettingsGroupLabel>Автосервис</SettingsGroupLabel>
                <AutoserviceTariffSection user={user} isDirector={isDirector} />
            </section>
        </div>
    );
}
