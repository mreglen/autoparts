import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateOrganization } from '../../redux/slices/OrganizationSlice';

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
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Водяные знаки
        </h3>
        {isUpdating && (
          <span className="text-xs text-gray-500">Сохранение...</span>
        )}
      </div>
      
      <div className="space-y-4">
        {/* "Свой Гараж" Logo Checkbox */}
        <div className="flex items-start gap-3">
          <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={watermarks.ownGarage}
                onChange={() => handleWatermarkChange('ownGarage')}
                disabled={isUpdating}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm font-medium text-gray-700">Логотип "Свой Гараж"</span>
            </label>
          </div>
        </div>

        {/* Company Logo Checkbox */}
        <div className="flex items-start gap-3">
          <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0h-2M7 19h2m-2 0h-2" />
            </svg>
          </div>
          <div className="flex-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={watermarks.companyLogo}
                onChange={() => handleWatermarkChange('companyLogo')}
                disabled={isUpdating}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm font-medium text-gray-700">Логотип компании</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatermarksSection;
