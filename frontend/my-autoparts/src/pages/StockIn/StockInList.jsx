import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import MediaModal from '../../components/MediaModal/MediaModal';
import { normalizeImageUrl } from '../../utils/apiClient';
import { stripHtmlTags } from '../../utils/text';
import { fetchStockIns } from '../../redux/slices/StockInSlice';

const StockInRow = ({ doc, onToggleExpand, isExpanded, onImageClick }) => (
  <React.Fragment>
    <tr
      className="cursor-pointer hover:bg-gray-50"
      onClick={onToggleExpand}
    >
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.product?.brand || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{doc.product?.article || '—'}</td>
      <td className="px-2 sm:px-6 py-4 text-sm text-gray-500 max-w-0 truncate sm:max-w-none sm:whitespace-normal">{doc.product?.name || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.quantity}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.sale_price ? `${doc.sale_price.toFixed(2)} ₽` : '—'}</td>
      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(doc.created_at).toLocaleDateString('ru-RU')}
      </td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {isExpanded && (
      <tr className="bg-gray-50">
        <td colSpan="6" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото и видео */}
            <div>
              <PhotoThumbnail 
                photos={doc.product?.photos || []} 
                videos={doc.product?.videos || []}
                onImageClick={onImageClick}
              />
            </div>

            {/* Информация */}
            <div className="space-y-4">

              {/* Описание */}
              <div>
                <span className="text-xs text-gray-500">Описание</span>
                <div className="font-medium mt-1">
                  {stripHtmlTags(doc.product?.description) || '—'}
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Дата поступления</span>
                  <div className="font-medium mt-1">
                    {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Склад</span>
                  <div className="font-medium mt-1">
                    {doc.storage_location?.address || `Склад #${doc.storage_location_id}`}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Ответственный</span>
                  <div className="font-medium mt-1">
                    {doc.creator_name || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Состояние</span>
                  <div className="font-medium mt-1">
                    {doc.product?.is_new ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Новый
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Б/у
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )}
  </React.Fragment>
);

const StockInList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { items: stockIns, loading, error } = useSelector((state) => state.stockIn);
  const [authChecked, setAuthChecked] = useState(false);

  const [expandedDocId, setExpandedDocId] = useState(null);
  
  // Состояние для медиа модалки
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  // Сортировка: по умолчанию сначала новые
  const [sortOrder, setSortOrder] = useState('date_desc'); // 'date_desc', 'date_asc', 'name_asc', 'name_desc'
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Check if user has permission to view this page
  // Admin and sellers always have access
  // Employees need 'stock-in' permission code
  const hasPermission = user?.is_admin || user?.is_seller || 
    (user?.is_employee && permissionCodes && permissionCodes.includes('stock-in'));

  // Fetch data - must be before any early returns
  useEffect(() => {
    if (authChecked && hasPermission) {
      dispatch(fetchStockIns());
    }
  }, [dispatch, authChecked, hasPermission]);

  // Check auth - wait for user data to load
  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  // Отсортированный список документов поступления
  // Важно: хук должен вызываться до любых ранних return.
  const sortedStockIns = React.useMemo(() => {
    const items = Array.isArray(stockIns) ? [...stockIns] : [];
    if (sortOrder === 'date_desc') {
      // Сначала новые
      items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortOrder === 'date_asc') {
      // Сначала старые
      items.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sortOrder === 'name_asc' || sortOrder === 'name_desc') {
      items.sort((a, b) => {
        const aName = (a.product?.name || a.product?.brand || a.product?.article || '').toString().toLowerCase();
        const bName = (b.product?.name || b.product?.brand || b.product?.article || '').toString().toLowerCase();
        if (aName < bName) return sortOrder === 'name_asc' ? -1 : 1;
        if (aName > bName) return sortOrder === 'name_asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [stockIns, sortOrder]);

  // Show loading while auth data is loading
  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  const toggleExpand = (id) => {
    setExpandedDocId(expandedDocId === id ? null : id);
  };

  const handleOpenMediaModal = (mediaItems, initialIndex = 0) => {
    console.log('Opening media modal with:', mediaItems, 'at index:', initialIndex);
    
    // Convert media items to format expected by MediaModal
    const formattedMedia = mediaItems.map(item => {
      const url = typeof item === 'string' ? item : (item.full_url || item.photo_url || item.video_url || '');
      console.log('Processing item:', item, 'URL before normalize:', url);
      // Normalize the URL to add backend base URL if needed
      const normalizedUrl = normalizeImageUrl(url);
      console.log('Normalized URL:', normalizedUrl);
      // Determine if it's a video or photo based on URL extension or item type
      const isVideo = normalizedUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
      return {
        type: isVideo ? 'video' : 'image',
        src: normalizedUrl
      };
    });
    
    console.log('Formatted media:', formattedMedia);
    setCurrentMediaItems(formattedMedia);
    setCurrentMediaIndex(initialIndex);
    setMediaModalOpen(true);
  };

  if (loading) {
    return (
      <div className="mt-4 sm:mt-5 px-4 sm:px-0">
        <div className="text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Загрузка документов...</h2>
          <p className="text-gray-600 text-base">Пожалуйста, подождите</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 sm:mt-5 px-4 sm:px-0">
        <div className="text-center py-16 px-6">
          <div className="bg-red-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки документов</h2>
          <p className="text-gray-500 mb-6 text-base">{error}</p>
          <button
            onClick={() => dispatch(fetchStockIns())}
            className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-2xl font-bold text-gray-800">Документы поступления</h1>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {/* Кнопка сортировки как в /autoparts/used */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 min-h-[40px]"
              title="Сортировка"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <span className="hidden sm:inline">Сортировка</span>
              <svg className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-30">
                <button
                  onClick={() => { setSortOrder('date_desc'); setShowSortDropdown(false); }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'date_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>Сначала новые</span>
                    {sortOrder === 'date_desc' && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => { setSortOrder('date_asc'); setShowSortDropdown(false); }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'date_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>Сначала старые</span>
                    {sortOrder === 'date_asc' && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => { setSortOrder('name_asc'); setShowSortDropdown(false); }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'name_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>По алфавиту (А–Я)</span>
                    {sortOrder === 'name_asc' && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => { setSortOrder('name_desc'); setShowSortDropdown(false); }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'name_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <span>По алфавиту (Я–А)</span>
                    {sortOrder === 'name_desc' && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>

          <Link
            to="/my-parts"
            className="px-6 py-3 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-base font-medium min-h-[48px] sm:min-h-0 text-center"
          >
            ← Назад к запчастям
          </Link>
        </div>
      </div>

      {sortedStockIns.length === 0 ? (
        <div className="mt-12 text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Документы поступления отсутствуют</h2>
          <p className="text-gray-600 text-base">Здесь будут отображаться документы поступления запчастей</p>
        </div>
      ) : (
        <>
          {/* Десктопная версия - таблица */}
          <div className="hidden md:block w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Артикул</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кол-во</th>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата поступления</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedStockIns.map((doc) => (
                  <StockInRow
                    key={doc.id}
                    doc={doc}
                    onToggleExpand={() => toggleExpand(doc.id)}
                    isExpanded={expandedDocId === doc.id}
                    onImageClick={handleOpenMediaModal}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Мобильная версия - карточки */}
          <div className="md:hidden space-y-5">
            {sortedStockIns.map((doc) => (
              <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                {/* Заголовок карточки */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-semibold text-gray-900">{doc.product?.brand || '—'}</span>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-gray-500 font-mono">{doc.product?.article || '—'}</span>
                    </div>
                    <h3 className="text-base font-medium text-gray-800 mb-3 leading-tight">{doc.product?.name || '—'}</h3>
                    <div className="text-sm text-gray-600 mb-2">
                      Дата поступления: {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-gray-900 mb-1">
                      {doc.sale_price ? `${doc.sale_price.toFixed(2)} ₽` : '—'}
                    </div>
                    <div className="text-sm text-gray-600">{doc.quantity} шт.</div>
                  </div>
                </div>

                {/* Кнопка показа деталей */}
                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={() => toggleExpand(doc.id)}
                    className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2"
                  >
                    {expandedDocId === doc.id ? 'Скрыть детали' : 'Показать детали'}
                  </button>
                </div>

                {/* Детали документа - мобильная версия */}
                {expandedDocId === doc.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Фото и видео */}
                      <div>
                        <PhotoThumbnail 
                          photos={doc.product?.photos || []} 
                          videos={doc.product?.videos || []}
                        />
                      </div>

                      {/* Информация */}
                      <div className="space-y-4">
                        {/* Описание */}
                        <div>
                          <span className="text-sm text-gray-500 block mb-1">Описание</span>
                          <div className="text-base text-gray-900">{stripHtmlTags(doc.product?.description) || '—'}</div>
                        </div>

                        {/* Дополнительная информация */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-gray-500 block mb-1">Дата поступления</span>
                            <div className="text-base font-medium text-gray-900">
                              {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block mb-1">Склад</span>
                            <div className="text-base font-medium text-gray-900">
                              {doc.storage_location?.address || `Склад #${doc.storage_location_id}`}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block mb-1">Ответственный</span>
                            <div className="text-base font-medium text-gray-900">
                              {doc.creator_name || '—'}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block mb-1">Состояние</span>
                            <div className="text-base font-medium text-gray-900">
                              {doc.product?.is_new ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                  Новый
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                  Б/у
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <MediaModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        mediaItems={currentMediaItems}
        initialIndex={currentMediaIndex}
      />
    </div>
  );
};

export default StockInList;