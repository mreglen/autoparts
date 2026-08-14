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
          <h3 className="text-sm font-semibold text-gray-900">Водяные знаки</h3>
          <p className="mt-0.5 text-sm text-gray-500">Наложение на фото товаров</p>
        </div>
        {isUpdating ? <span className="text-xs text-gray-500">Сохранение…</span> : null}
      </div>

      <div className="space-y-2 rounded-xl bg-gray-100 p-2">
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={isUpdating}
              onClick={() => handleSelect(option.value)}
              className={`flex w-full items-start gap-3 rounded-xl px-4 py-3.5 text-left transition disabled:opacity-60 ${
                active ? 'bg-white' : 'bg-transparent hover:bg-white/70'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  active ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 bg-white'
                }`}
              >
                {active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
              <span>
                <span className="block text-sm font-medium text-gray-900">{option.title}</span>
                <span className="mt-0.5 block text-sm text-gray-500">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default WatermarksSection;
