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
import DadataAddressInput from '../../components/DadataAddressInput/DadataAddressInput';
import { normalizeImageUrl } from '../../utils/apiClient';
import {
    Button,
    Card,
    EmptyState,
    FieldHint,
    FieldLabel,
    Input,
    PageHeader,
    SectionHeader,
    Skeleton,
    Textarea,
    fieldClass,
} from '../../components/UI';

function OrgLogo({ src, name }) {
    if (src) {
        return (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24">
                <img src={normalizeImageUrl(src)} alt={name || 'Логотип'} className="max-h-full max-w-full object-contain p-2" />
            </div>
        );
    }
    const letter = (name || 'О').trim().charAt(0).toUpperCase();
    return (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-2xl font-bold text-white sm:h-24 sm:w-24">
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
            <div className="w-full min-w-0">
                <EmptyState
                    illustration="error"
                    title="Доступ запрещён"
                    description="У вас нет прав для просмотра этой страницы."
                />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div className="w-full min-w-0 space-y-10">
                <PageHeader title="Организация" />
                <EmptyState
                    illustration="empty"
                    title="Организация не найдена"
                    description="У вас пока нет связанной организации."
                />
            </div>
        );
    }

    if (loading && !org) {
        return (
            <div className="w-full min-w-0 space-y-10">
                <PageHeader title="Организация" subtitle="Профиль компании, склады, доставка и витрина" />
                <div className="flex gap-4">
                    <Skeleton className="h-24 w-24 rounded-xl" />
                    <div className="flex-1 space-y-2 pt-1">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full min-w-0 space-y-10">
                <PageHeader title="Организация" />
                <EmptyState illustration="error" title="Не удалось загрузить" description={error} />
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 space-y-10">
            <PageHeader
                className="mb-0"
                title="Организация"
                subtitle="Профиль компании, склады, доставка и витрина"
                action={
                    isDirector && !isEditing ? (
                        <Button type="button" variant="secondary" size="sm" onClick={startEditing}>
                            Изменить
                        </Button>
                    ) : null
                }
            />

            {isEditing && isDirector ? (
                <Card>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex flex-col gap-5 sm:flex-row">
                            <div className="shrink-0 space-y-3">
                                <OrgLogo src={logoPreview} name={formData.name} />
                                <div>
                                    <FieldLabel htmlFor="organization-logo">Логотип</FieldLabel>
                                    <input
                                        id="organization-logo"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="block w-full max-w-[14rem] text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-700"
                                    />
                                </div>
                            </div>
                            <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <FieldLabel htmlFor="organization-name" required>Название</FieldLabel>
                                    <Input id="organization-name" name="name" value={formData.name} onChange={handleChange} />
                                </div>
                                <div className="sm:col-span-2">
                                    <FieldLabel htmlFor="organization-address" required>Адрес</FieldLabel>
                                    <DadataAddressInput
                                        id="organization-address"
                                        value={formData.address}
                                        onChange={(value) => setFormData((prev) => ({ ...prev, address: value }))}
                                        placeholder="Город, улица, дом"
                                        className={fieldClass}
                                    />
                                </div>
                                <div>
                                    <FieldLabel htmlFor="organization-phone">Телефон</FieldLabel>
                                    <Input id="organization-phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} />
                                </div>
                                <div className="sm:col-span-2">
                                    <FieldLabel htmlFor="organization-description">Описание</FieldLabel>
                                    <Textarea
                                        id="organization-description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        maxLength={500}
                                        rows={3}
                                        placeholder="Кратко о компании для витрины"
                                    />
                                    <FieldHint>{formData.description.length}/500</FieldHint>
                                </div>
                            </div>
                        </div>
                        {formError ? <FieldHint error>{formError}</FieldHint> : null}
                        <div className="flex flex-wrap gap-2">
                            <Button type="submit" size="sm" loading={saving} disabled={saving}>
                                Сохранить
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={cancelEditing} disabled={saving}>
                                Отмена
                            </Button>
                        </div>
                    </form>
                </Card>
            ) : (
                <div className="flex gap-4">
                    <OrgLogo src={org?.logo_organization} name={org?.name} />
                    <div className="min-w-0 flex-1 py-0.5">
                        <h2 className="text-lg font-semibold text-gray-900">{org?.name || 'Организация'}</h2>
                        <p className="mt-1 text-sm text-gray-500">{org?.address || 'Адрес не указан'}</p>
                        <p className="mt-0.5 text-sm text-gray-500">{org?.phone || 'Телефон не указан'}</p>
                        {org?.description ? (
                            <p className="mt-3 max-w-2xl text-sm text-gray-600">{org.description}</p>
                        ) : (
                            <p className="mt-3 text-sm text-gray-400">Описание для витрины пока не заполнено.</p>
                        )}
                        <p className="mt-3 font-mono text-xs text-gray-400">ID {org?.id}</p>
                    </div>
                </div>
            )}

            <section className="space-y-4">
                <StorageLocationsSection orgId={orgId} />
            </section>

            <section className="space-y-4">
                <SectionHeader title="Продажи" subtitle="Доставка и оплата для покупателей" />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <DeliveryMethodsSection orgId={orgId} />
                    <PaymentMethodsSection orgId={orgId} />
                </div>
            </section>

            <section className="space-y-4">
                <SectionHeader title="Витрина" subtitle="Водяные знаки и выгрузка на площадки" />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <WatermarksSection org={org} />
                    <MarketplaceSiteInfoSection org={org} />
                </div>
            </section>

            <section className="space-y-4">
                <SectionHeader title="Автосервис" subtitle="Тариф для записи, заказ-нарядов и клиентской базы" />
                <AutoserviceTariffSection user={user} isDirector={isDirector} />
            </section>
        </div>
    );
}
