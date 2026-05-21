import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { uploadOrganizationLogo } from '../../redux/slices/OrganizationSlice';
import { normalizeImageUrl } from '../../utils/apiClient';
import {
    SettingsCard,
    SettingsSectionHeader,
    SettingsInfoRow,
    SettingsEditButton,
    settingsInputClass,
    settingsBtnPrimary,
    settingsBtnSecondary,
} from './settingsUi';

const LogoIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const DescriptionIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
);

const OrganizationInfoSection = ({ org, onUpdate }) => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ logo: '', description: '' });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (org) {
            const logoValue =
                org.logo_organization && org.logo_organization.startsWith('blob:') ? '' : org.logo_organization || '';
            setFormData({ logo: logoValue, description: org.description || '' });
            setLogoPreview(org.logo_organization || '');
        }
    }, [org]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleUploadLogo = async () => {
        if (!logoFile) return null;
        setUploading(true);
        try {
            const logoUrl = await dispatch(uploadOrganizationLogo(logoFile)).unwrap();
            setFormData((prev) => ({ ...prev, logo: logoUrl }));
            setLogoFile(null);
            return logoUrl;
        } finally {
            setUploading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let logoUrl = formData.logo;
        if (logoFile) {
            logoUrl = await handleUploadLogo();
        }
        await onUpdate({ logo_organization: logoUrl, description: formData.description });
        setIsEditing(false);
        if (logoPreview && logoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview);
        }
    };

    const handleCancel = () => {
        if (org) {
            const logoValue =
                org.logo_organization && org.logo_organization.startsWith('blob:') ? '' : org.logo_organization || '';
            setFormData({ logo: logoValue, description: org.description || '' });
            setLogoPreview(org.logo_organization || '');
        }
        setIsEditing(false);
        if (logoPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview);
        }
        setLogoFile(null);
    };

    const headerIcon = (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    );

    if (isEditing && user?.is_director) {
        return (
            <SettingsCard>
                <SettingsSectionHeader title="Брендинг" subtitle="Логотип и описание для витрины" icon={headerIcon} />
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">Логотип</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className={`${settingsInputClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700`}
                        />
                        <p className="mt-1.5 text-xs text-gray-500">JPG, PNG, WEBP и другие форматы изображений</p>
                    </div>
                    {logoPreview && (
                        <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                            <img
                                src={normalizeImageUrl(logoPreview)}
                                alt="Превью"
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    )}
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600">Описание</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            maxLength={500}
                            rows={4}
                            className={settingsInputClass}
                            placeholder="Краткое описание вашей организации"
                        />
                        <p className="mt-1 text-right text-xs text-gray-500">{formData.description.length}/500</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className={settingsBtnPrimary} disabled={uploading}>
                            {uploading ? 'Загрузка...' : 'Сохранить'}
                        </button>
                        <button type="button" onClick={handleCancel} className={settingsBtnSecondary} disabled={uploading}>
                            Отмена
                        </button>
                    </div>
                </form>
            </SettingsCard>
        );
    }

    return (
        <SettingsCard>
            <SettingsSectionHeader
                title="Брендинг"
                subtitle="Логотип и описание для витрины"
                icon={headerIcon}
                action={
                    user?.is_director && (
                        <SettingsEditButton
                            isEditing={isEditing}
                            onClick={() => setIsEditing(true)}
                            onCancel={handleCancel}
                        />
                    )
                }
            />
            <div className="space-y-3">
                <SettingsInfoRow label="Логотип" icon={<LogoIcon />}>
                    {org?.logo_organization ? (
                        <div className="mt-2 flex h-16 w-28 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <img
                                src={normalizeImageUrl(org.logo_organization)}
                                alt="Логотип"
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    ) : (
                        <p className="mt-0.5 text-sm text-gray-500">Не загружен</p>
                    )}
                </SettingsInfoRow>
                <SettingsInfoRow
                    label="Описание"
                    value={org?.description || 'Нет описания'}
                    icon={<DescriptionIcon />}
                />
            </div>
        </SettingsCard>
    );
};

export default OrganizationInfoSection;
