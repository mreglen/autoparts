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
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  Button,
  Card,
  EmptyState,
  FieldHint,
  FieldLabel,
  Input,
  SectionHeader,
  Skeleton,
  Textarea,
  fieldClass,
} from '../../components/UI';
import { warehousePageClass } from '../../utils/warehouseListUi';

function InlineNotice({ tone = 'error', children, onClose }) {
  const tones = {
    success: 'border-success-100 bg-success-50 text-success-700',
    error: 'border-danger-100 bg-danger-50 text-danger-700',
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-sg border px-4 py-3 ${tones[tone] || tones.error}`}
      role="status"
    >
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
          aria-label="Закрыть"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function OrgLogo({ src, name }) {
  if (src) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sg border border-line bg-surface-muted sm:h-24 sm:w-24">
        <img
          src={normalizeImageUrl(src)}
          alt={name || 'Логотип'}
          className="max-h-full max-w-full object-contain p-2"
        />
      </div>
    );
  }
  const letter = (name || 'О').trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-2xl font-bold text-brand-700 ring-1 ring-brand-100 sm:h-24 sm:w-24">
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
    legal_name: '',
    legal_address: '',
    inn: '',
    kpp: '',
    ogrn: '',
    director_name: '',
    accountant_name: '',
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
      org.logo_organization && org.logo_organization.startsWith('blob:')
        ? ''
        : org.logo_organization || '';
    setFormData({
      name: org.name || '',
      address: org.address || '',
      phone: org.phone || '',
      legal_name: org.legal_name || '',
      legal_address: org.legal_address || '',
      inn: org.inn || '',
      kpp: org.kpp || '',
      ogrn: org.ogrn || '',
      director_name: org.director_name || '',
      accountant_name: org.accountant_name || '',
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
        org.logo_organization && org.logo_organization.startsWith('blob:')
          ? ''
          : org.logo_organization || '';
      setFormData({
        name: org.name || '',
        address: org.address || '',
        phone: org.phone || '',
        legal_name: org.legal_name || '',
        legal_address: org.legal_address || '',
        inn: org.inn || '',
        kpp: org.kpp || '',
        ogrn: org.ogrn || '',
        director_name: org.director_name || '',
        accountant_name: org.accountant_name || '',
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
          legal_name: formData.legal_name.trim() || null,
          legal_address: formData.legal_address.trim() || null,
          inn: formData.inn.trim() || null,
          kpp: formData.kpp.trim() || null,
          ogrn: formData.ogrn.trim() || null,
          director_name: formData.director_name.trim() || null,
          accountant_name: formData.accountant_name.trim() || null,
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
      <div className={`${warehousePageClass} min-w-0`}>
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
      <div className={`${warehousePageClass} min-w-0 space-y-4`}>
        <PageIntro title="Организация" description="Профиль компании" className="mb-0" />
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
      <div className={`${warehousePageClass} min-w-0 space-y-4`}>
        <PageIntro
          title="Организация"
          description="Профиль компании, склады, доставка и витрина"
          className="mb-0"
        />
        <div className="flex gap-4">
          <Skeleton className="h-24 w-24 rounded-sg" />
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
      <div className={`${warehousePageClass} min-w-0 space-y-4`}>
        <PageIntro title="Организация" className="mb-0" />
        <EmptyState illustration="error" title="Не удалось загрузить" description={error} />
      </div>
    );
  }

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-8`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageIntro
          title="Организация"
          description="Профиль компании, склады, доставка и витрина"
          className="mb-0"
        />
        {isDirector && !isEditing ? (
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={startEditing}>
            Изменить
          </Button>
        ) : null}
      </div>

      {formError && !isEditing ? (
        <InlineNotice tone="error" onClose={() => setFormError('')}>
          <p>{formError}</p>
        </InlineNotice>
      ) : null}

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
                    className="block w-full max-w-[14rem] text-xs text-ink-muted file:mr-3 file:rounded-sg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink-soft"
                  />
                </div>
              </div>
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="organization-name" required>
                    Название
                  </FieldLabel>
                  <Input
                    id="organization-name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="organization-address" required>
                    Адрес
                  </FieldLabel>
                  <DadataAddressInput
                    id="organization-address"
                    value={formData.address}
                    onChange={(value) => setFormData((prev) => ({ ...prev, address: value }))}
                    placeholder="Город, улица, дом"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="organization-phone">Контактный телефон организации</FieldLabel>
                  <Input
                    id="organization-phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="organization-legal-name">Юридическое название</FieldLabel>
                  <Input
                    id="organization-legal-name"
                    name="legal_name"
                    value={formData.legal_name}
                    onChange={handleChange}
                    placeholder="ООО «Компания»"
                  />
                  <FieldHint>Попадает в шапку заказ-наряда и других документов</FieldHint>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel htmlFor="organization-legal-address">Юридический адрес</FieldLabel>
                  <Input
                    id="organization-legal-address"
                    name="legal_address"
                    value={formData.legal_address}
                    onChange={handleChange}
                    placeholder="Город, улица, дом"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="organization-inn">ИНН</FieldLabel>
                  <Input
                    id="organization-inn"
                    name="inn"
                    value={formData.inn}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, '').slice(0, 12);
                      setFormData((prev) => ({ ...prev, inn: next }));
                    }}
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="10 или 12 цифр"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="organization-kpp">КПП</FieldLabel>
                  <Input
                    id="organization-kpp"
                    name="kpp"
                    value={formData.kpp}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setFormData((prev) => ({ ...prev, kpp: next }));
                    }}
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="9 цифр"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="organization-ogrn">ОГРН / ОГРНИП</FieldLabel>
                  <Input
                    id="organization-ogrn"
                    name="ogrn"
                    value={formData.ogrn}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, '').slice(0, 15);
                      setFormData((prev) => ({ ...prev, ogrn: next }));
                    }}
                    inputMode="numeric"
                    maxLength={15}
                    placeholder="13 или 15 цифр"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="organization-director">Руководитель</FieldLabel>
                  <Input
                    id="organization-director"
                    name="director_name"
                    value={formData.director_name}
                    onChange={handleChange}
                    placeholder="ФИО для подписи в УПД"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="organization-accountant">Главный бухгалтер</FieldLabel>
                  <Input
                    id="organization-accountant"
                    name="accountant_name"
                    value={formData.accountant_name}
                    onChange={handleChange}
                    placeholder="ФИО для подписи в УПД"
                  />
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
              <Button type="submit" loading={saving} disabled={saving}>
                Сохранить
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={cancelEditing}
                disabled={saving}
              >
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <div className="flex gap-4">
            <OrgLogo src={org?.logo_organization} name={org?.name} />
            <div className="min-w-0 flex-1 py-0.5">
              <h2 className="text-lg font-semibold text-ink">{org?.name || 'Организация'}</h2>
              <p className="mt-1 text-sm text-ink-muted">{org?.address || 'Адрес не указан'}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{org?.phone || 'Телефон не указан'}</p>
              <div className="mt-3 space-y-0.5 border-t border-line pt-3 text-sm text-ink-muted">
                <p>
                  <span className="font-medium text-ink-soft">Юридическое название: </span>
                  {org?.legal_name || 'не указано'}
                </p>
                <p>
                  <span className="font-medium text-ink-soft">Юридический адрес: </span>
                  {org?.legal_address || 'не указан'}
                </p>
                <p>
                  <span className="font-medium text-ink-soft">ИНН: </span>
                  {org?.inn || 'не указан'}
                </p>
                <p>
                  <span className="font-medium text-ink-soft">КПП: </span>
                  {org?.kpp || 'не указан'}
                </p>
                <p>
                  <span className="font-medium text-ink-soft">ОГРН / ОГРНИП: </span>
                  {org?.ogrn || 'не указан'}
                </p>
                <p>
                  <span className="font-medium text-ink-soft">Руководитель: </span>
                  {org?.director_name || 'не указан'}
                </p>
                <p>
                  <span className="font-medium text-ink-soft">Главный бухгалтер: </span>
                  {org?.accountant_name || 'не указан'}
                </p>
              </div>
              {org?.description ? (
                <p className="mt-3 max-w-2xl text-sm text-ink-soft">{org.description}</p>
              ) : (
                <p className="mt-3 text-sm text-ink-faint">Описание для витрины пока не заполнено.</p>
              )}
              <p className="mt-3 font-mono text-xs text-ink-faint">ID {org?.id}</p>
            </div>
          </div>
        </Card>
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
        <SectionHeader
          title="Автосервис"
          subtitle="Тариф для записи, заказ-нарядов и клиентской базы"
        />
        <AutoserviceTariffSection user={user} isDirector={isDirector} />
      </section>
    </div>
  );
}
