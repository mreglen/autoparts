import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateOrganization } from '../../redux/slices/OrganizationSlice';
import { SettingsCard, SettingsSectionHeader } from './settingsUi';

const OPTIONS = [
  {
    value: 0,
    title: 'Без знака',
    description: 'Фото товаров без наложения',
  },
  {
    value: 1,
    title: '«Свой Гараж»',
    description: 'Логотип площадки на фото',
  },
  {
    value: 2,
    title: 'Логотип компании',
    description: 'Ваш логотип на фото',
  },
];

const WatermarksSection = ({ org }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const currentWatermark = org?.watermark || 0;
  const [selected, setSelected] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (org && org.watermark !== undefined) {
      setSelected(org.watermark || 0);
    }
  }, [org]);

  const handleSelect = async (value) => {
    if (isUpdating || !user?.organization_id || value === selected) return;

    setIsUpdating(true);
    setSelected(value);

    try {
      await dispatch(
        updateOrganization({
          id: user.organization_id,
          watermark: value,
        }),
      ).unwrap();
    } catch (error) {
      console.error('Error updating watermark:', error);
      setSelected(currentWatermark);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SettingsCard>
      <SettingsSectionHeader
        title="Водяные знаки"
        subtitle="Наложение на фото товаров"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        action={isUpdating ? <span className="text-xs text-ink-muted">Сохранение…</span> : null}
      />

      <div className="grid gap-2">
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={isUpdating}
              onClick={() => handleSelect(option.value)}
              className={`flex w-full items-start gap-3 rounded-sg border px-4 py-3.5 text-left transition-colors disabled:opacity-60 ${
                active
                  ? 'border-brand-200 bg-brand-50/70 ring-1 ring-brand-100'
                  : 'border-line bg-white hover:border-brand-200'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  active ? 'border-brand-600 bg-brand-600' : 'border-line bg-white'
                }`}
              >
                {active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">{option.title}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
};

export default WatermarksSection;
