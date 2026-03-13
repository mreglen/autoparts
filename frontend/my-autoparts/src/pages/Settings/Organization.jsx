import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchOrganization, clearOrganization, updateOrganization } from '../../redux/slices/OrganizationSlice';
import DeliveryMethodsSection from './DeliveryMethodsSection';
import StorageLocationsSection from './StorageLocationsSection';
import OrganizationInfoSection from './OrganizationInfoSection';
import WatermarksSection from './WatermarksSection';

// Organization Form Component
const OrganizationForm = ({ org, onUpdate, isEditing, setIsEditing, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
  });

  useEffect(() => {
    if (org) {
      setFormData({
        name: org.name || '',
        address: org.address || '',
        phone: org.phone || ''
      });
    }
  }, [org]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Exclude logo and description as they are handled separately
    const { logo, description, ...otherData } = formData;
    onUpdate(otherData);
    setIsEditing(false);
  };

  // Render form if editing, otherwise show organization info
  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Адрес</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
                
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0h-2M7 19h2m-2 0h-2" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500">Название</p>
          <p className="font-medium text-gray-900">{org?.name || '—'}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500">Адрес</p>
          <p className="font-medium text-gray-900">{org?.address || '—'}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500">Телефон</p>
          <p className="font-medium text-gray-900">{org?.phone || '—'}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500">ID</p>
          <p className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">{org?.id || 'N/A'}</p>
        </div>
      </div>

    </div>
  );
};


export default function Organization() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { data: org, loading, error } = useSelector((state) => state.organization);

  const [isEditing, setIsEditing] = useState(false);

  // Ref to track if initial data has been loaded for this orgId
  const initialLoadRef = useRef({});

  // Check if user is seller or director
  const canAccess = user?.is_seller || user?.is_director;

  useEffect(() => {
    if (user && user.organization_id) {
      // Check if we've already loaded data for this orgId
      const hasLoaded = initialLoadRef.current[`org_${user.organization_id}`];

      if (!hasLoaded) {
        dispatch(fetchOrganization(user.organization_id));
        initialLoadRef.current[`org_${user.organization_id}`] = true;
      }
    }

    return () => {
      // Clear the load flag when component unmounts
      if (user?.organization_id) {
        delete initialLoadRef.current[`org_${user.organization_id}`];
      }
      dispatch(clearOrganization());
    };
  }, [dispatch, user]);

  const handleUpdate = async (formData) => {
    try {
      await dispatch(updateOrganization({
        id: user.organization_id,
        ...formData
      })).unwrap();
    } catch (error) {
      console.error('Error updating organization:', error);
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  if (!canAccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Доступ запрещен</h2>
          <p className="text-gray-600">У вас нет прав для просмотра этой страницы.</p>
        </div>
      </div>
    );
  }

  if (loading && !org) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md border border-red-200 p-6">
          <div className="text-red-600">Ошибка: {error}</div>
        </div>
      </div>
    );
  }

  if (!user?.organization_id) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
          <div className="text-yellow-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Организация не найдена</h2>
          <p className="text-gray-600">У вас пока нет связанной организации.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Организация</h2>
      </div>

      {/* Main Organization Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Основная информация
            </h3>
            {user?.is_director && (
              <button
                onClick={handleEditToggle}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title={isEditing ? 'Отмена' : 'Редактировать'}
              >
                {isEditing ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                )}
              </button>
            )}
          </div>

          <OrganizationForm
            org={org}
            isEditing={isEditing && user?.is_director}
            setIsEditing={setIsEditing}
            onUpdate={handleUpdate}
            onCancel={() => setIsEditing(false)}
          />
        </div>

        {/* Logo and Description Card */}
        <OrganizationInfoSection org={org} onUpdate={handleUpdate} />
      </div>

      {/* Watermarks Section */}
      <div className="mb-6">
        <WatermarksSection org={org} />
      </div>

      {/* Storage Locations and Delivery Methods side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StorageLocationsSection orgId={user.organization_id} />
        <DeliveryMethodsSection orgId={user.organization_id} />
      </div>
    </div>
  );
}