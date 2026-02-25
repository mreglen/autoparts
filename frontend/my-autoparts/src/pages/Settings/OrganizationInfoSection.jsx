import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateOrganization, uploadOrganizationLogo } from '../../redux/slices/OrganizationSlice';
import { normalizeImageUrl } from '../../utils/apiClient';

const OrganizationInfoSection = ({ org, onUpdate }) => {
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    logo: '',
    description: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    if (org) {
      // Check if the logo is a blob URL and don't set it as the form value
      const logoValue = org.logo_organization && org.logo_organization.startsWith('blob:') ? '' : org.logo_organization || '';
      setFormData({
        logo: logoValue, // Use logo_organization field
        description: org.description || ''
      });
      setLogoPreview(org.logo_organization || ''); // Set preview for the logo
    }
  }, [org]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      // Don't update form data here, only set the preview
      // The actual logo URL will be updated after successful upload
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    
    setUploading(true);
    try {
      const logoUrl = await dispatch(uploadOrganizationLogo(logoFile)).unwrap();
      // Update formData with the actual uploaded URL, not a blob URL
      setFormData(prev => ({
        ...prev,
        logo: logoUrl
      }));
      // Reset file after successful upload
      setLogoFile(null);
      return logoUrl; // Return the uploaded URL
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error; // Re-throw the error so caller knows
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let logoUrl = formData.logo;
    
    console.log('OrganizationInfoSection handleSubmit - logoFile:', logoFile);
    console.log('OrganizationInfoSection handleSubmit - formData.logo:', formData.logo);
    
    // Upload logo if there's a new file
    if (logoFile) {
      console.log('Uploading new logo...');
      const uploadedLogoUrl = await handleUploadLogo();
      // Use the uploaded logo URL returned from the function
      logoUrl = uploadedLogoUrl;
      console.log('After upload, logoUrl:', logoUrl);
    }
    
    // Prepare data to update - use logo_organization field name
    const updateData = {
      logo_organization: logoUrl, // Use the correct field name
      description: formData.description
    };
    
    console.log('Sending update data:', updateData);
    console.log('Specifically checking logo_organization in updateData:', updateData.logo_organization);
    
    await onUpdate(updateData);
    setIsEditing(false);
    // Clean up object URLs
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
  };

  const handleCancel = () => {
    if (org) {
      // Check if the logo is a blob URL and don't set it as the form value
      const logoValue = org.logo_organization && org.logo_organization.startsWith('blob:') ? '' : org.logo_organization || '';
      setFormData({
        logo: logoValue,
        description: org.description || ''
      });
      setLogoPreview(org.logo_organization || '');
    }
    setIsEditing(false);
    // Clean up object URLs
    if (logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(null);
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  if (isEditing && user?.is_director) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 14a3.001 3.001 0 002.83 2" />
            </svg>
            Дополнительная информация
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Логотип</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2">
              <p className="text-xs text-gray-500">Поддерживаются JPG, PNG, GIF, WEBP и другие форматы изображений</p>
            </div>
          </div>
          
          {logoPreview && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700 mb-1">Предварительный просмотр</p>
              <img 
                src={normalizeImageUrl(logoPreview)} 
                alt="Preview" 
                className="max-h-16 max-w-[120px] object-contain border border-gray-200 rounded"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              maxLength="500"
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Краткое описание вашей организации"
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {formData.description.length}/500
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={uploading}
            >
              {uploading ? 'Загрузка...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              disabled={uploading}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 14a3.001 3.001 0 002.83 2" />
          </svg>
          Дополнительная информация
        </h3>
        {user?.is_director && (
          <button
            onClick={handleEditToggle}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title={isEditing ? 'Отмена' : 'Редактировать'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Логотип</p>
            <div className="mt-1">
              {org?.logo_organization ? (
                <img 
                  src={normalizeImageUrl(org.logo_organization)} 
                  alt="Logo" 
                  className="max-h-16 max-w-[120px] object-contain border border-gray-200 rounded"
                />
              ) : (
                <div className="w-[120px] h-16 bg-gray-200 border border-dashed border-gray-400 rounded flex items-center justify-center text-gray-500 text-sm">
                  Нет логотипа
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Описание</p>
            <p className="font-medium text-gray-900 mt-1">
              {org?.description ? org.description : 'Нет описания'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationInfoSection;