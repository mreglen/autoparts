import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateOrganization } from '../../redux/slices/OrganizationSlice';
import { SettingsCard, SettingsSectionHeader } from './settingsUi';

const WatermarksSection = ({ org }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  
  // Get current watermark value from organization
  const currentWatermark = org?.watermark || 0;
  
  // Local state for checkboxes
  const [watermarks, setWatermarks] = useState({
    ownGarage: false,  // "Свой Гараж" logo - watermark = 1
    companyLogo: false // Company logo - watermark = 2
  });
  
  const [isUpdating, setIsUpdating] = useState(false);

  // Update checkboxes based on organization watermark value
  useEffect(() => {
    if (org && org.watermark !== undefined) {
      setWatermarks({
        ownGarage: org.watermark === 1,
        companyLogo: org.watermark === 2
      });
    }
  }, [org]);

  // Handle checkbox changes
  const handleWatermarkChange = async (type) => {
    if (isUpdating || !user?.organization_id) return;
    
    setIsUpdating(true);
    
    let newWatermarkValue;
    
    if (type === 'ownGarage') {
      // If clicking already checked checkbox, uncheck it (set to 0)
      // If clicking unchecked checkbox, set to 1 and uncheck companyLogo
      newWatermarkValue = watermarks.ownGarage ? 0 : 1;
    } else if (type === 'companyLogo') {
      // If clicking already checked checkbox, uncheck it (set to 0)
      // If clicking unchecked checkbox, set to 2 and uncheck ownGarage
      newWatermarkValue = watermarks.companyLogo ? 0 : 2;
    }
    
    // Optimistic UI update
    const newWatermarks = {
      ownGarage: newWatermarkValue === 1,
      companyLogo: newWatermarkValue === 2
    };
    setWatermarks(newWatermarks);
    
    try {
      // Update organization with new watermark value
      await dispatch(updateOrganization({
        id: user.organization_id,
        watermark: newWatermarkValue
      })).unwrap();
    } catch (error) {
      console.error('Error updating watermark:', error);
      // Revert back on error
      setWatermarks({
        ownGarage: currentWatermark === 1,
        companyLogo: currentWatermark === 2
      });
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
        action={isUpdating ? <span className="text-xs text-gray-500">Сохранение...</span> : null}
      />

      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition-colors hover:bg-gray-50">
          <input
            type="checkbox"
            checked={watermarks.ownGarage}
            onChange={() => handleWatermarkChange('ownGarage')}
            disabled={isUpdating}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
          <span className="text-sm font-medium text-gray-800">Логотип «Свой Гараж»</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition-colors hover:bg-gray-50">
          <input
            type="checkbox"
            checked={watermarks.companyLogo}
            onChange={() => handleWatermarkChange('companyLogo')}
            disabled={isUpdating}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
          <span className="text-sm font-medium text-gray-800">Логотип компании</span>
        </label>
      </div>
    </SettingsCard>
  );
};

export default WatermarksSection;
