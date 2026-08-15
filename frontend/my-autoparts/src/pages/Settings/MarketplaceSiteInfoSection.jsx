import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateOrganization } from '../../redux/slices/OrganizationSlice';
import { Card } from '../../components/UI';
import { SettingsToggle } from './settingsUi';

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
    <Card>
      <h3 className="text-sm font-semibold text-ink">Описание на площадках</h3>
      <p className="mb-4 mt-0.5 text-sm text-ink-muted">Авито и Дром</p>
      <p className="mb-4 text-sm leading-relaxed text-ink-soft">
        При выгрузке в Авито и Дром в конец описания добавляется блок со ссылкой на карточку
        товара на сайте Свой Гараж, чтобы покупатели могли открыть объявление у нас.
      </p>
      <SettingsToggle
        checked={enabled}
        disabled={isUpdating || !user?.is_director}
        onChange={handleToggle}
        label="Добавлять ссылку на Свой Гараж"
        description="Только в выгрузке: описание карточки на сайте не меняется"
      />
    </Card>
  );
}
