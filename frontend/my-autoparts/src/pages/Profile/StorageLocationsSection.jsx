// src/components/StorageLocationsSection.jsx
import { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
    createStorageLocation,
    updateStorageLocation,
    deleteStorageLocation,
    fetchStorageLocations,
} from '../../redux/slices/OrganizationSlice';

const DadataAddressInput = ({ value, onChange, onSuggestionSelect, placeholder = 'Город, улица, дом' }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [inputValue, setInputValue] = useState(value || '');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    const handleInputChange = async (e) => {
        const val = e.target.value;
        setInputValue(val);
        onChange(val);

        if (val.length < 3) {
            setSuggestions([]);
            setHighlightedIndex(-1);
            return;
        }

        try {
            const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: 'Token a1a8fbcf263bb8a2e549b1aa7fe56c08c1a2da1d',
                },
                body: JSON.stringify({ query: val, count: 5 }),
            });
            const data = await res.json();
            setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
            setHighlightedIndex(-1); // сброс при новом запросе
        } catch (err) {
            setSuggestions([]);
            setHighlightedIndex(-1);
        }
    };

    const selectSuggestion = (suggestion) => {
        setInputValue(suggestion.value);
        onChange(suggestion.value);
        onSuggestionSelect(suggestion);
        setSuggestions([]);
        setHighlightedIndex(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0) {
                selectSuggestion(suggestions[highlightedIndex]);
            } else if (suggestions.length > 0) {
                // Если ничего не выделено — выбрать первую
                selectSuggestion(suggestions[0]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setSuggestions([]);
            setHighlightedIndex(-1);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target) &&
                inputRef.current !== e.target
            ) {
                setSuggestions([]);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                autoComplete="off"
            />
            {suggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded shadow-lg mt-1 max-h-48 overflow-auto">
                    {suggestions.map((s, i) => (
                        <li
                            key={i}
                            onClick={() => selectSuggestion(s)}
                            onMouseEnter={() => setHighlightedIndex(i)}
                            className={`px-3 py-2 cursor-pointer text-sm ${i === highlightedIndex ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-gray-100'
                                }`}
                        >
                            {s.value}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default function StorageLocationsSection({ orgId, storageLocations, loadingLocations, locationsError }) {
    const dispatch = useDispatch();

    const [editingLocationId, setEditingLocationId] = useState(null);
    const [editingAddress, setEditingAddress] = useState(''); // ✅ состояние для редактируемого адреса
    const [newLocationAddress, setNewLocationAddress] = useState('');
    const [newLocationData, setNewLocationData] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [showActionDropdown, setShowActionDropdown] = useState(null); // Track which location's actions are open

    // При начале редактирования — загружаем текущий адрес
    useEffect(() => {
        if (editingLocationId) {
            const loc = storageLocations.find((l) => l.id === editingLocationId);
            if (loc) {
                setEditingAddress(loc.address || '');
            }
        }
    }, [editingLocationId, storageLocations]);

    const handleAddLocation = () => {
        if (!newLocationAddress.trim()) return;
        const { city, street, house } = newLocationData?.data || {};
        if (!city || !street || !house) {
            console.warn('Адрес должен содержать город, улицу и дом');
            return;
        }

        dispatch(
            createStorageLocation({
                address: newLocationAddress,
                organization_id: orgId,
            })
        ).then(() => {
            setNewLocationAddress('');
            setNewLocationData(null);
            setIsAdding(false);
            dispatch(fetchStorageLocations(orgId));
        });
    };

    const handleSaveEdit = () => {
        if (!editingAddress.trim()) return;

        // Проверка через DaData не обязательна при редактировании,
        // но можно добавить, если нужно
        dispatch(
            updateStorageLocation({
                id: editingLocationId,
                address: editingAddress,
                organization_id: orgId,
            })
        ).then(() => {
            setEditingLocationId(null);
            setEditingAddress('');
            dispatch(fetchStorageLocations(orgId));
        });
    };

    const handleDelete = (id) => {
        dispatch(deleteStorageLocation(id)).then(() => dispatch(fetchStorageLocations(orgId)));
        setShowActionDropdown(null); // Close dropdown after delete
    };

    const handleActionClick = (locationId) => {
        setShowActionDropdown(showActionDropdown === locationId ? null : locationId);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showActionDropdown && !e.target.closest('.actions-dropdown-container')) {
                setShowActionDropdown(null);
            }
        };

        if (showActionDropdown) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showActionDropdown]);

    const handleAddressSelect = (suggestion, targetId = null) => {
        if (targetId === 'new') {
            setNewLocationData(suggestion);
        } else if (targetId === 'edit') {
            setEditingAddress(suggestion.value);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-md font-medium text-gray-800">Склады</h3>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        + Добавить
                    </button>
                )}
            </div>

            {/* Форма добавления */}
            {isAdding && (
                <div className="mb-3 p-2 border border-gray-200 rounded bg-gray-50">
                    <DadataAddressInput
                        value={newLocationAddress}
                        onChange={setNewLocationAddress}
                        onSuggestionSelect={(s) => handleAddressSelect(s, 'new')}
                        placeholder="Город, улица, дом"
                    />
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={handleAddLocation}
                            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                            Сохранить
                        </button>
                        <button
                            onClick={() => {
                                setIsAdding(false);
                                setNewLocationAddress('');
                                setNewLocationData(null);
                            }}
                            className="text-xs px-2 py-1 border border-gray-400 text-gray-700 rounded hover:bg-gray-100"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            )}

            {/* Список складов */}
            {loadingLocations ? (
                <div className="space-y-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                    ))}
                </div>
            ) : locationsError ? (
                <p className="text-sm text-red-600">Не удалось загрузить склады</p>
            ) : storageLocations.length > 0 ? (
                <div className="space-y-2">
                    {storageLocations.map((loc) => (
                        <div
                            key={loc.id}
                            className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200"
                        >
                            {editingLocationId === loc.id ? (
                                <DadataAddressInput
                                    value={editingAddress}
                                    onChange={setEditingAddress}
                                    onSuggestionSelect={(s) => handleAddressSelect(s, 'edit')}
                                    placeholder="Город, улица, дом"
                                />
                            ) : (
                                <span className="text-sm text-gray-800 truncate flex-1">{loc.address || 'Без адреса'}</span>
                            )}

                            <div className="flex gap-1 shrink-0">
                                {editingLocationId === loc.id ? (
                                    <>
                                        <button
                                            onClick={handleSaveEdit}
                                            className="text-xs text-green-600 hover:underline"
                                        >
                                            Сохранить
                                        </button>
                                        <button
                                            onClick={() => setEditingLocationId(null)}
                                            className="text-xs text-gray-600 hover:underline"
                                        >
                                            Отмена
                                        </button>
                                    </>
                                ) : (
                                    <div className="relative actions-dropdown-container">
                                        <button
                                            onClick={() => handleActionClick(loc.id)}
                                            className="text-xs font-medium border-2 border-gray-400 rounded px-2 py-1 bg-transparent hover:bg-gray-100 transition-colors flex items-center gap-1"
                                        >
                                            Действия
                                            <img
                                                src="/img/arrow_sm.svg"
                                                alt=""
                                                className={`w-3 h-3 transition-transform duration-200 filter brightness-0 ${showActionDropdown === loc.id ? 'rotate-90' : ''}`}
                                                style={{ filter: 'brightness(0) saturate(100%) invert(61%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(89%)' }}
                                            />
                                        </button>
                                        
                                        {/* Action dropdown */}
                                        {showActionDropdown === loc.id && (
                                            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                                <div className="py-1">
                                                    <button
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setEditingLocationId(loc.id);
                                                            setShowActionDropdown(null);
                                                        }}
                                                        className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                                                    >
                                                        Редактировать
                                                    </button>
                                                    <button
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            handleDelete(loc.id);
                                                        }}
                                                        className="block w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50 hover:text-gray-900"
                                                    >
                                                        Удалить
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-500 italic">Нет складов</p>
            )}
        </div>
    );
}