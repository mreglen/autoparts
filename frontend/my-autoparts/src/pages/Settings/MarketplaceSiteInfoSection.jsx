import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateOrganization } from '../../redux/slices/OrganizationSlice';
import { SettingsCard, SettingsSectionHeader } from './settingsUi';

export default function MarketplaceSiteInfoSection({ org }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [enabled, setEnabled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(org?.append_marketplace_site_info));
  }, [org?.append_marketplace_site_info]);

  const handleToggle = async () => {
    if (isUpdating || !user?.organization_id || !org?.id) return;
    const next = !enabled;
    setIsUpdating(true);
    setEnabled(next);
    try {
      await dispatch(
        updateOrganization({
          id: org.id,
          append_marketplace_site_info: next,
        }),
      ).unwrap();
    } catch (error) {
      console.error('Error updating marketplace site info setting:', error);
      setEnabled(Boolean(org?.append_marketplace_site_info));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SettingsCard>
      <SettingsSectionHeader
        title="Описание на площадках"
        subtitle="Авито и Дром"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        }
      />
      <p className="mb-4 text-sm text-gray-600">
        При выгрузке в Авито и Дром в конец описания добавляется блок со ссылкой на карточку
        товара на сайте Свой Гараж, чтобы покупатели могли открыть объявление у нас.
      </p>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          checked={enabled}
          disabled={isUpdating || !user?.is_director}
          onChange={handleToggle}
        />
        <span className="text-sm text-gray-800">
          <span className="font-medium">Добавлять информацию о площадке в конце описания</span>
          <span className="mt-0.5 block text-gray-500">
            Текст со ссылкой на товар на Свой Гараж добавляется только в выгрузку, описание в
            карточке на сайте не меняется.
          </span>
        </span>
      </label>
    </SettingsCard>
  );
}
