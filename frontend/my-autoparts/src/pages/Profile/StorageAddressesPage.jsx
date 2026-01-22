import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { 
  fetchLocationsWithCells, 
  fetchStorageCells, 
  createStorageCell, 
  updateStorageCell, 
  deleteStorageCell,
  fetchProductStorageCells
} from '../../redux/slices/StorageCellsSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchProducts } from '../../redux/slices/ProductSlice';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';

const StorageAddressesPage = () => {
  // All hooks must be called at the top level
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const { 
    locationsWithCells, 
    loading, 
    error,
    lastModified
  } = useSelector(state => state.storageCells);
  
  const { storageLocations } = useSelector(state => state.organization);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    storage_location_id: ''
  });
  
  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cellToDelete, setCellToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Notification state
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (user?.organization_id) {
      // Fetch seller's storage locations
      dispatch(fetchStorageLocations(user.organization_id));
      // Fetch all locations with cells (will be filtered on display)
      dispatch(fetchLocationsWithCells());
      // Fetch seller's storage cells
      dispatch(fetchStorageCells());
    }
  }, [dispatch, user?.organization_id]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('Storage cells state updated:', locationsWithCells);
  }, [locationsWithCells]);
  
  // Refresh all storage-related data when storage cells are modified
  useEffect(() => {
    // This will trigger re-fetching of all storage-related data
    if (user?.organization_id && lastModified) {
      dispatch(fetchProducts());
      // Also refresh storage cell data
      dispatch(fetchLocationsWithCells());
      dispatch(fetchStorageCells());
    }
  }, [lastModified]); // Trigger when storage cells are modified

  // Filter locations to show only seller's organization warehouses
  const sellerLocations = storageLocations.filter(location => 
    location.organization_id === user?.organization_id
  );
  
  // Filter locationsWithCells to show only seller's organization
  const sellerLocationsWithCells = locationsWithCells.filter(location => 
    location.organization_id === user?.organization_id
  );

  // Redirect unauthorized users - this must come after all hooks
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_seller) return <Navigate to="/" replace />;

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingCell) {
      // Update existing cell
      await dispatch(updateStorageCell({
        id: editingCell.id,
        ...formData
      }));
      setEditingCell(null);
    } else {
      // Create new cell
      await dispatch(createStorageCell(formData));
    }
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      storage_location_id: ''
    });
    setShowAddForm(false);
  };

  const handleEdit = (cell) => {
    setEditingCell(cell);
    setFormData({
      name: cell.name,
      description: cell.description || '',
      storage_location_id: cell.storage_location_id ? cell.storage_location_id.toString() : ''
    });
    setShowAddForm(true);
    // Scroll to form
    setTimeout(() => {
      const formElement = document.getElementById('storage-cell-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleDeleteClick = (cell) => {
    setCellToDelete(cell);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cellToDelete) return;
    
    console.log('=== DELETE OPERATION STARTED ===');
    console.log('Deleting cell:', cellToDelete);
    console.log('Current token exists:', !!localStorage.getItem('token'));
    
    setDeleteLoading(true);
    
    try {
      // Dispatch the delete action
      const resultAction = await dispatch(deleteStorageCell(cellToDelete.id));
      console.log('Delete action result:', resultAction);
      console.log('Result type:', resultAction.type);
      
      // Check if the action was fulfilled
      if (deleteStorageCell.fulfilled.match(resultAction)) {
        console.log('✅ Delete successful, removed cell ID:', resultAction.payload);
        
        // Close modal and reset state
        setShowDeleteModal(false);
        setCellToDelete(null);
        
        // Show success notification
        setNotification({
          type: 'success',
          message: `Адрес "${cellToDelete.name}" успешно удален`
        });
        
        // Auto-hide notification after 3 seconds
        setTimeout(() => {
          setNotification(null);
        }, 3000);
        
        console.log('=== DELETE OPERATION COMPLETED SUCCESSFULLY ===');
        
      } else if (deleteStorageCell.rejected.match(resultAction)) {
        // Handle rejection
        console.error('❌ Delete rejected:', resultAction.payload);
        console.error('Error details:', resultAction.error);
        console.error('Full error object:', resultAction);
        
        // Check if it's an authentication error
        const errorMessage = resultAction.payload || resultAction.error?.message;
        if (errorMessage?.includes('401') || 
            errorMessage?.includes('Unauthorized') ||
            errorMessage?.includes('invalid') ||
            errorMessage?.includes('expired')) {
          throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
        }
        
        throw new Error(errorMessage || 'Не удалось удалить адрес');
      }
      
    } catch (error) {
      console.error('💥 Delete failed with exception:', error);
      console.error('Error stack:', error.stack);
      
      // Show error notification
      setNotification({
        type: 'error',
        message: error.message || 'Ошибка при удалении адреса'
      });
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
      
      console.log('=== DELETE OPERATION FAILED ===');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setCellToDelete(null);
  };

  const handleCancel = () => {
    setEditingCell(null);
    setShowAddForm(false);
    setFormData({
      name: '',
      description: '',
      storage_location_id: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-md ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {notification.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${notification.type === 'success' ? 'text-green-500 hover:bg-green-100 focus:ring-green-600' : 'text-red-500 hover:bg-red-100 focus:ring-red-600'}`}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Адресное хранение</h1>
            <p className="mt-1 text-gray-600">
              Управление складскими ячейками и адресным хранением
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {showAddForm ? 'Отмена' : '+ Добавить адрес'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div id="storage-cell-form" className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingCell ? 'Редактировать адрес' : 'Добавить новую адрес'}
            </h2>
            {editingCell && (
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                ID: {editingCell.id}
              </span>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingCell ? (
              // Single column form when editing (warehouse hidden)
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название ячейки *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Например: A1, Стеллаж 1, Полка 2"
                />
              </div>
            ) : (
              // Two column form when creating (with warehouse selection)
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название ячейки *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Например: A1, Стеллаж 1, Полка 2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Склад *
                  </label>
                  <select
                    name="storage_location_id"
                    value={formData.storage_location_id}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Выберите склад</option>
                    {sellerLocations.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.address}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Описание ячейки (необязательно)"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loading 
                  ? 'Сохранение...' 
                  : (editingCell ? 'Сохранить изменения' : 'Создать ячейку')
                }
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading/Error */}
      {loading && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Загрузка данных...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Ошибка загрузки</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Locations with Cells */}
      {!loading && !error && (
        <div className="space-y-6">
          {sellerLocationsWithCells.map(location => (
            <div key={location.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Склад #{location.id}</h3>
                    <p className="text-gray-600 mt-1">{location.address}</p>
                  </div>
                  <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                    {location.cells.length} адрес
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {location.cells.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Нет адресов</h3>
                    <p className="mt-1 text-sm text-gray-500">В этом складе пока нет созданных адресов.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {location.cells.map(cell => (
                      <div key={cell.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-all duration-200 hover:border-indigo-300 group min-w-[200px] max-w-[250px] flex-shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate text-base">{cell.name}</h4>
                            {cell.description && (
                              <p className="text-sm text-gray-600 truncate mt-1">{cell.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 ml-3 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDeleteClick(cell)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-all duration-200"
                              title="Удалить ячейку"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEdit(cell)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all duration-200"
                              title="Редактировать ячейку"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sellerLocationsWithCells.length === 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-12">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет складов</h3>
            <p className="mt-1 text-sm text-gray-500">
              {user?.is_seller 
                ? 'Для начала работы с адресным хранением необходимо создать склады в разделе "Склады".'
                : 'Только продавцы могут работать с адресным хранением.'
              }
            </p>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Удаление ячейки"
        message={`Вы уверены, что хотите удалить адрес "${cellToDelete?.name}"?

Будут также удалены все связи с товарами.

Внимание: Это действие нельзя отменить.`}
        confirmText="Удалить адрес"
        cancelText="Отмена"
        isLoading={deleteLoading}
        danger={true}
      />
    </div>
  );
};

export default StorageAddressesPage;