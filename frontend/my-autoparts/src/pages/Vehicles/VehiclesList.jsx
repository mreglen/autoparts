import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { fetchVehicles } from '../../redux/slices/ProductSlice';

const VehicleTableRow = ({ vehicle, isExpanded, onToggleExpand }) => {
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.actions-dropdown')) {
        setShowActions(false);
      }
    };
    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  return (
    <React.Fragment>
      <tr className="hover:bg-gray-50">
        <td
          className="px-2 py-3 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
          onClick={onToggleExpand}
        >
          {vehicle.brand || '—'}
        </td>
        <td
          className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
          onClick={onToggleExpand}
        >
          {vehicle.model || '—'}
        </td>
        <td
          className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
          onClick={onToggleExpand}
        >
          {vehicle.generation || '—'}
        </td>
        <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-500 text-right align-middle">
          <div className="relative actions-dropdown inline-flex justify-end w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1 ml-auto"
            >
              Действия
              <img
                src="/img/arrow_sm.svg"
                alt=""
                className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showActions ? 'rotate-90' : ''}`}
                style={{
                  filter:
                    'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)',
                }}
              />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 min-w-[10rem] bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown py-1 text-left">
                <Link
                  to={`/vehicles/edit/${vehicle.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block w-full px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  Редактировать
                </Link>
              </div>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan="4" className="px-6 py-4 border-t">
            <div>
              <span className="text-xs text-gray-500">Описание</span>
              <div className="font-medium mt-1 whitespace-pre-wrap">
                {vehicle.description?.trim() ? vehicle.description : '—'}
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

function VehiclesList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { vehicles, vehiclesLoading, error } = useSelector((state) => state.products);
  const [authChecked, setAuthChecked] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [sortOrder, setSortOrder] = useState('brand_asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee &&
      permissionCodes &&
      (permissionCodes.includes('my-parts') || permissionCodes.includes('stock-in')));

  useEffect(() => {
    if (authChecked && hasPermission) {
      dispatch(fetchVehicles());
    }
  }, [dispatch, authChecked, hasPermission]);

  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  const sortedVehicles = useMemo(() => {
    const list = Array.isArray(vehicles) ? [...vehicles] : [];
    const key = (v) =>
      `${(v.brand || '').toLowerCase()}\0${(v.model || '').toLowerCase()}\0${(v.generation || '').toLowerCase()}`;
    list.sort((a, b) => {
      const cmp = key(a).localeCompare(key(b), 'ru');
      return sortOrder === 'brand_desc' ? -cmp : cmp;
    });
    return list;
  }, [vehicles, sortOrder]);

  if (!authChecked) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  if (vehiclesLoading) {
    return (
      <div className="mt-4 sm:mt-5 px-4 sm:px-0">
        <div className="text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg
              className="animate-spin h-10 w-10 text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Загрузка автомобилей…</h2>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Ошибка загрузки</h2>
          <p className="text-gray-500 mb-6 text-base">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchVehicles())}
            className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 min-h-[48px]"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-2xl font-bold text-gray-800">Автомобили</h1>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 min-h-[40px]"
              title="Сортировка"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                />
              </svg>
              <span className="hidden sm:inline">Сортировка</span>
              <svg
                className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-30">
                <button
                  type="button"
                  onClick={() => {
                    setSortOrder('brand_asc');
                    setShowSortDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'brand_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                >
                  По марке (А–Я)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSortOrder('brand_desc');
                    setShowSortDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${sortOrder === 'brand_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                >
                  По марке (Я–А)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start mb-6 gap-4">
        <button
          type="button"
          onClick={() => navigate('/vehicles/add')}
          className="px-6 py-3 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-base font-medium min-h-[48px] sm:min-h-0"
        >
          Добавить автомобиль
        </button>
      </div>

      {sortedVehicles.length === 0 ? (
        <div className="mt-12 text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Автомобилей пока нет</h2>
          <p className="text-gray-600 text-base mb-6">Добавьте первый автомобиль по кнопке выше</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Марка
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Модель
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Поколение
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedVehicles.map((v) => (
                  <VehicleTableRow
                    key={v.id}
                    vehicle={v}
                    isExpanded={expandedId === v.id}
                    onToggleExpand={() => toggleExpand(v.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-5">
            {sortedVehicles.map((v) => (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-gray-900">{v.brand || '—'}</div>
                    <div className="text-sm text-gray-600 mt-1">{v.model || '—'}</div>
                    <div className="text-sm text-gray-500 mt-1">Поколение: {v.generation || '—'}</div>
                  </div>
                  <div className="relative actions-dropdown flex-shrink-0">
                    <MobileActionsButton vehicleId={v.id} />
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => toggleExpand(v.id)}
                    className="w-full text-indigo-600 text-sm font-medium hover:text-indigo-800 transition-colors py-2"
                  >
                    {expandedId === v.id ? 'Скрыть детали' : 'Показать детали'}
                  </button>
                </div>
                {expandedId === v.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500 block mb-1">Описание</span>
                    <div className="text-base text-gray-900 whitespace-pre-wrap">
                      {v.description?.trim() ? v.description : '—'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MobileActionsButton({ vehicleId }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.actions-dropdown')) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative actions-dropdown ml-auto">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="text-gray-600 hover:text-gray-800 text-xs font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
      >
        Действия
        <img
          src="/img/arrow_sm.svg"
          alt=""
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          style={{
            filter:
              'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)',
          }}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[10rem] bg-white border border-gray-200 rounded-md shadow-lg z-10 actions-dropdown py-1">
          <Link
            to={`/vehicles/edit/${vehicleId}`}
            onClick={(e) => e.stopPropagation()}
            className="block w-full px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
          >
            Редактировать
          </Link>
        </div>
      )}
    </div>
  );
}

export default VehiclesList;
