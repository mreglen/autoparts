import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStorageLocations, createStorageLocation, updateStorageLocation, deleteStorageLocation } from '../../redux/slices/OrganizationSlice';

const StorageLocationsSection = ({ orgId }) => {
  const dispatch = useDispatch();
  const { storageLocations, loadingLocations, locationsError } = useSelector(
    (state) => state.organization
  );
  
  const [isAdding, setIsAdding] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [editingId, setEditingId] = useState(null);
  const [editLocation, setEditLocation] = useState('');
  const [editSuggestions, setEditSuggestions] = useState([]);
  const [editHighlightedIndex, setEditHighlightedIndex] = useState(-1);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const editInputRef = useRef(null);
  const editDropdownRef = useRef(null);

  // Закрывать выпадающий список при клике вне его
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current !== e.target) {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
      if (editDropdownRef.current && !editDropdownRef.current.contains(e.target) && editInputRef.current !== e.target) {
        setEditSuggestions([]);
        setEditHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- DaData API Functions ---
  const handleAddressChange = async (value) => {
    setNewLocation(value);
    setHighlightedIndex(-1);
    if (!value || value.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Token a1a8fbcf263bb8a2e549b1aa7fe56c08c1a2da1d',
        },
        body: JSON.stringify({ query: value, count: 5 }),
      });
      if (!response.ok) {
        setSuggestions([]);
        return;
      }
      const result = await response.json();
      setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
    } catch (err) {
      setSuggestions([]);
    }
  };

  const selectAddress = (suggestion) => {
    setNewLocation(suggestion.value);
    setSuggestions([]);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleEditAddressChange = async (value) => {
    setEditLocation(value);
    setEditHighlightedIndex(-1);
    if (!value || value.length < 3) {
      setEditSuggestions([]);
      return;
    }
    try {
      const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Token a1a8fbcf263bb8a2e549b1aa7fe56c08c1a2da1d',
        },
        body: JSON.stringify({ query: value, count: 5 }),
      });
      if (!response.ok) {
        setEditSuggestions([]);
        return;
      }
      const result = await response.json();
      setEditSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
    } catch (err) {
      setEditSuggestions([]);
    }
  };

  const selectEditAddress = (suggestion) => {
    setEditLocation(suggestion.value);
    setEditSuggestions([]);
    setEditHighlightedIndex(-1);
    editInputRef.current?.focus();
  };

  // Load storage locations when component mounts
  useEffect(() => {
    if (orgId) {
      dispatch(fetchStorageLocations(orgId));
    }
  }, [dispatch, orgId]);

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (!newLocation.trim()) return;
    
    try {
      await dispatch(createStorageLocation({
        address: newLocation.trim(),
        organization_id: orgId
      })).unwrap();
      
      setNewLocation('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding storage location:', error);
    }
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    if (!editLocation.trim()) return;
    
    try {
      await dispatch(updateStorageLocation({
        id: editingId,
        address: editLocation.trim(),
        organization_id: orgId
      })).unwrap();
      
      setEditingId(null);
      setEditLocation('');
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error updating storage location:', error);
    }
  };

  const handleDeleteLocation = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить этот склад?')) {
      try {
        await dispatch(deleteStorageLocation(id)).unwrap();
        setOpenDropdownId(null);
      } catch (error) {
        console.error('Error deleting storage location:', error);
      }
    }
  };

  const startEditing = (location) => {
    setEditingId(location.id);
    setEditLocation(location.address);
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 w-full min-h-[350px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Склады
        </h3>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          + Добавить склад
        </button>
      </div>
      
      {/* Add new location form */}
      {isAdding ? (
        <form onSubmit={handleAddLocation} className="mb-4">
          <div className="flex gap-2 relative" ref={dropdownRef}>
            <input
              ref={inputRef}
              type="text"
              value={newLocation}
              onChange={(e) => handleAddressChange(e.target.value)}
              onKeyDown={(e) => {
                if (!suggestions.length) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
                } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                  e.preventDefault();
                  selectAddress(suggestions[highlightedIndex]);
                } else if (e.key === 'Escape') {
                  setSuggestions([]);
                  setHighlightedIndex(-1);
                }
              }}
              placeholder="Введите адрес склада"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => selectAddress(s)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`px-4 py-2 cursor-pointer ${i === highlightedIndex
                      ? 'bg-blue-100 text-blue-800'
                      : 'hover:bg-gray-100'
                      }`}
                  >
                    {s.value}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Добавить
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewLocation('');
                setSuggestions([]);
                setHighlightedIndex(-1);
              }}
              className="px-3 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}
      
      {loadingLocations ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      ) : locationsError ? (
        <div className="text-red-600 text-sm">{locationsError}</div>
      ) : (
        <div className="space-y-2">
          {storageLocations && storageLocations.length > 0 ? (
            storageLocations.map(location => (
              editingId === location.id ? (
                <form key={location.id} onSubmit={handleUpdateLocation} className="flex gap-2 p-2 bg-blue-50 rounded border">
                  <div className="relative" ref={editDropdownRef}>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editLocation}
                      onChange={(e) => handleEditAddressChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (!editSuggestions.length) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setEditHighlightedIndex(prev =>
                            prev < editSuggestions.length - 1 ? prev + 1 : prev
                          );
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setEditHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
                        } else if (e.key === 'Enter' && editHighlightedIndex >= 0) {
                          e.preventDefault();
                          selectEditAddress(editSuggestions[editHighlightedIndex]);
                        } else if (e.key === 'Escape') {
                          setEditSuggestions([]);
                          setEditHighlightedIndex(-1);
                        }
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm w-full"
                      required
                    />
                    {editSuggestions.length > 0 && (
                      <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {editSuggestions.map((s, i) => (
                          <li
                            key={i}
                            onClick={() => selectEditAddress(s)}
                            onMouseEnter={() => setEditHighlightedIndex(i)}
                            className={`px-4 py-2 cursor-pointer ${i === editHighlightedIndex
                              ? 'bg-blue-100 text-blue-800'
                              : 'hover:bg-gray-100'
                              }`}
                          >
                            {s.value}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditLocation('');
                      setEditSuggestions([]);
                      setEditHighlightedIndex(-1);
                    }}
                    className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-sm"
                  >
                    Отмена
                  </button>
                </form>
              ) : (
                <div key={location.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border min-h-[52px]">
                  <span className="flex-1 truncate pr-2">{location.address}</span>
                  <div className="relative inline-block text-left">
                    <button
                      onClick={() => setOpenDropdownId(openDropdownId === location.id ? null : location.id)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-50 transition-colors flex items-center gap-1"
                    >
                      Действия
                      <img
                        src="/img/arrow_sm.svg"
                        alt=""
                        className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${openDropdownId === location.id ? 'rotate-90' : ''}`}
                        style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                      />
                    </button>
                    
                    {openDropdownId === location.id && (
                      <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              startEditing(location);
                              setOpenDropdownId(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                          >
                            Редактировать
                          </button>
                          <button
                            onClick={() => {
                              handleDeleteLocation(location.id);
                              setOpenDropdownId(null);
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            ))
          ) : (
            <p className="text-gray-500 italic">Нет складов</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StorageLocationsSection;