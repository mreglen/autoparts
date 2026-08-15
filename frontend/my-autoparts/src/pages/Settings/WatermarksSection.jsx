import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateOrganization } from '../../redux/slices/OrganizationSlice';
import { Card } from '../../components/UI';

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
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Водяные знаки</h3>
          <p className="mt-0.5 text-sm text-ink-muted">Наложение на фото товаров</p>
        </div>
        {isUpdating ? <span className="text-xs text-ink-muted">Сохранение…</span> : null}
      </div>

      <div className="space-y-2 rounded-sg border border-line bg-surface-subtle p-2">
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={isUpdating}
              onClick={() => handleSelect(option.value)}
              className={`flex w-full items-start gap-3 rounded-sg px-4 py-3.5 text-left transition disabled:opacity-60 ${
                active
                  ? 'bg-surface shadow-sg-sm ring-1 ring-brand-100'
                  : 'bg-transparent hover:bg-surface/70'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  active
                    ? 'border-brand-600 bg-brand-600'
                    : 'border-line bg-surface'
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
    </Card>
  );
};

export default WatermarksSection;
