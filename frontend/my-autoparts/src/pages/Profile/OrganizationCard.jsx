// src/components/OrganizationCard.jsx
import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEmployees, fetchOrganization, fetchStorageLocations, clearOrganization, updateOrganization } from '../../redux/slices/OrganizationSlice';
import StorageLocationsSection from './StorageLocationsSection';
import EmployeesSection from './EmployeesSection';

// Функция форматирования телефона
const formatPhoneNumber = (value) => {
    if (!value) return '';

    // Удаляем все нецифровые символы
    let digits = value.replace(/\D/g, '');

    // Если начинается с 7 или 8, заменяем на 7
    if (digits.startsWith('7') || digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }

    // Форматируем как +7 (XXX) XXX-XX-XX
    let formatted = '+7 ';
    if (digits.length > 1) {
        formatted += '(' + digits.slice(1, 4);
    }
    if (digits.length > 4) {
        formatted += ') ' + digits.slice(4, 7);
    }
    if (digits.length > 7) {
        formatted += '-' + digits.slice(7, 9);
    }
    if (digits.length > 9) {
        formatted += '-' + digits.slice(9, 11);
    }

    return formatted;
};

// Функция для получения только цифр из отформатированного номера
const getDigitsFromFormatted = (formatted) => {
    return formatted.replace(/\D/g, '');
};

export default function OrganizationCard({ orgId }) {
    const dispatch = useDispatch();
    const {
        data: org,
        storageLocations,
        loading,
        loadingLocations,
        error,
        locationsError,
    } = useSelector((state) => state.organization);

    // 👇 Добавляем получение user из auth slice
    const user = useSelector((state) => state.auth.user);

    // Состояние для редактирования телефона
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [phoneValue, setPhoneValue] = useState('');

    // Состояние для редактирования имени организации
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');

    // Состояние для редактирования адреса
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [addressValue, setAddressValue] = useState('');

    // Состояние для подсказок Dadata
    const [suggestions, setSuggestions] = useState([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (orgId) {
            dispatch(fetchOrganization(orgId));
            dispatch(fetchStorageLocations(orgId));
            dispatch(fetchEmployees(orgId));
        } else {
            dispatch(clearOrganization());
        }
        return () => {
            dispatch(clearOrganization());
        };
    }, [dispatch, orgId]);

    // Инициализируем значения при загрузке организации
    useEffect(() => {
        if (org?.name) {
            setNameValue(org.name);
        }
        if (org?.address) {
            setAddressValue(org.address);
        }
        if (org?.phone) {
            // Если телефон уже есть в базе, форматируем его для отображения
            setPhoneValue(formatPhoneNumber(org.phone));
        } else if (org && !org.phone) {
            setPhoneValue('');
        }
    }, [org?.name, org?.address, org?.phone, org]);

    // Закрывать выпадающий список при клике вне его
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current !== e.target) {
                setSuggestions([]);
                setHighlightedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Обработчики для телефона
    const handlePhoneEdit = () => {
        setIsEditingPhone(true);
        setPhoneValue(org?.phone ? formatPhoneNumber(org.phone) : '');
    };

    const handlePhoneSave = async () => {
        try {
            // Отправляем на сервер только цифры, или null если пусто
            const digitsOnly = getDigitsFromFormatted(phoneValue);
            const phoneToSend = digitsOnly && digitsOnly.length >= 10 ? digitsOnly : null;

            await dispatch(updateOrganization({
                id: orgId,
                phone: phoneToSend
            })).unwrap();
            setIsEditingPhone(false);
        } catch (error) {
            console.error('Ошибка обновления телефона:', error);
        }
    };

    const handlePhoneCancel = () => {
        setIsEditingPhone(false);
        setPhoneValue(org?.phone ? formatPhoneNumber(org.phone) : '');
    };

    const handlePhoneChange = (e) => {
        const input = e.target.value;
        const formatted = formatPhoneNumber(input);
        setPhoneValue(formatted);
    };

    const handlePhoneKeyDown = (e) => {
        // Разрешаем специальные клавиши
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || e.key === 'Enter' ||
            e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            return;
        }

        // Разрешаем только цифры
        if (!/\d/.test(e.key)) {
            e.preventDefault();
        }
    };

    // Обработчики для имени организации
    const handleNameEdit = () => {
        setIsEditingName(true);
        setNameValue(org?.name || '');
    };

    const handleNameSave = async () => {
        try {
            const trimmedName = nameValue.trim();
            if (!trimmedName) {
                alert('Название организации не может быть пустым');
                return;
            }

            await dispatch(updateOrganization({
                id: orgId,
                name: trimmedName
            })).unwrap();
            setIsEditingName(false);
        } catch (error) {
            console.error('Ошибка обновления имени организации:', error);
        }
    };

    const handleNameCancel = () => {
        setIsEditingName(false);
        setNameValue(org?.name || '');
    };

    const handleNameChange = (e) => {
        setNameValue(e.target.value);
    };

    const handleNameKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleNameSave();
        } else if (e.key === 'Escape') {
            handleNameCancel();
        }
    };

    // Обработчики для адреса
    const handleAddressEdit = () => {
        setIsEditingAddress(true);
        setAddressValue(org?.address || '');
        setSuggestions([]);
        setHighlightedIndex(-1);
    };

    const handleAddressSave = async () => {
        try {
            const trimmedAddress = addressValue.trim();
            if (!trimmedAddress) {
                alert('Адрес не может быть пустым');
                return;
            }

            // Проверяем формат адреса (город, улица, дом)
            const addressParts = trimmedAddress.split(',').map(part => part.trim());
            if (addressParts.length < 3) {
                alert('Адрес должен содержать: город, улица, дом (разделенные запятыми)');
                return;
            }

            await dispatch(updateOrganization({
                id: orgId,
                address: trimmedAddress
            })).unwrap();
            setIsEditingAddress(false);
        } catch (error) {
            console.error('Ошибка обновления адреса:', error);
        }
    };

    const handleAddressCancel = () => {
        setIsEditingAddress(false);
        setAddressValue(org?.address || '');
        setSuggestions([]);
        setHighlightedIndex(-1);
    };


    const handleAddressKeyDown = (e) => {
        // Обработка навигации по подсказкам
        if (suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev > 0 ? prev - 1 : -1
                );
            } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                selectAddress(suggestions[highlightedIndex]);
            } else if (e.key === 'Escape') {
                setSuggestions([]);
                setHighlightedIndex(-1);
            }
            return;
        }

        // Обычная обработка для сохранения/отмены
        if (e.key === 'Enter') {
            handleAddressSave();
        } else if (e.key === 'Escape') {
            handleAddressCancel();
        }
    };

    // Функция для обработки изменения адреса с подсказками Dadata
    const handleAddressInputChange = async (value) => {
        setAddressValue(value);
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

    // Функция выбора адреса из подсказок
    const selectAddress = (suggestion) => {
        setAddressValue(suggestion.value);
        setSuggestions([]);
        setHighlightedIndex(-1);
        inputRef.current?.focus();
    };

    if (!orgId) return null;

    if (loading) {
        return (
            <div className="w-full bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !org) {
        return (
            <div className="w-full bg-white rounded-xl shadow-md border border-red-200 p-6">
                <p className="text-red-600">{error || 'Организация не найдена'}</p>
            </div>
        );
    }

    return (
        <div className="w-full bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0h-2M7 19h2m-2 0h-2" />
                </svg>
                Организация и склады
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Информация об организации */}
                <div>
                    <h3 className="text-md font-medium text-gray-800 mb-3">Информация</h3>
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">Название</p>
                                {user?.is_director && !isEditingName && (
                                    <button
                                        onClick={handleNameEdit}
                                        className="text-blue-500 hover:text-blue-700 text-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {isEditingName ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={nameValue}
                                        onChange={handleNameChange}
                                        onKeyDown={handleNameKeyDown}
                                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                        placeholder="Введите название организации"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleNameSave}
                                        className="text-green-500 hover:text-green-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handleNameCancel}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <p className="font-medium text-gray-900">{org.name || '—'}</p>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">Адрес</p>
                                {user?.is_director && !isEditingAddress && (
                                    <button
                                        onClick={handleAddressEdit}
                                        className="text-blue-500 hover:text-blue-700 text-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {isEditingAddress ? (
                                <div className="space-y-2">
                                    <div className="relative" ref={dropdownRef}>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={addressValue}
                                            onChange={(e) => handleAddressInputChange(e.target.value)}
                                            onKeyDown={handleAddressKeyDown}
                                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                            placeholder="г. Москва, ул. Ленина, д. 15"
                                            autoFocus
                                        />
                                        {suggestions.length > 0 && (
                                            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
                                                {suggestions.map((s, i) => (
                                                    <li
                                                        key={i}
                                                        onClick={() => selectAddress(s)}
                                                        onMouseEnter={() => setHighlightedIndex(i)}
                                                        className={`px-4 py-2 cursor-pointer ${
                                                            i === highlightedIndex
                                                                ? 'bg-indigo-100 text-indigo-800'
                                                                : 'hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {s.value}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <p className="text-xs text-gray-500">Формат: город, улица, дом</p>
                                        <button
                                            onClick={handleAddressSave}
                                            className="text-green-500 hover:text-green-700"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleAddressCancel}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="font-medium text-gray-900">{org.address || '—'}</p>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">Телефон</p>
                                {user?.is_director && !isEditingPhone && (
                                    <button
                                        onClick={handlePhoneEdit}
                                        className="text-blue-500 hover:text-blue-700 text-sm"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {isEditingPhone ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={phoneValue}
                                        onChange={handlePhoneChange}
                                        onKeyDown={handlePhoneKeyDown}
                                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                        placeholder="+7 (XXX) XXX-XX-XX"
                                        maxLength={18}
                                    />
                                    <button
                                        onClick={handlePhoneSave}
                                        className="text-green-500 hover:text-green-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={handlePhoneCancel}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <p className="font-medium text-gray-900">{org.phone ? formatPhoneNumber(org.phone) : '—'}</p>
                            )}
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">ID</p>
                            <p className="font-mono text-sm text-gray-700 bg-gray-50 px-2 py-1 rounded">{org.id}</p>
                        </div>
                    </div>
                </div>

                {/* Склады */}
                <StorageLocationsSection
                    orgId={orgId}
                    storageLocations={storageLocations}
                    loadingLocations={loadingLocations}
                    locationsError={locationsError}
                />
            </div>

            {/* Сотрудники — отдельно под основным блоком */}
            {user?.is_director && (
                <div className="mt-6">
                    <EmployeesSection orgId={orgId} />
                </div>
            )}
        </div>
    );
}