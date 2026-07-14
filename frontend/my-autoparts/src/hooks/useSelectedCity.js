import { useCallback, useEffect, useState } from 'react';
import { apiAxiosUnauth } from '../utils/apiClient';
import { extractCityFromAddress } from '../utils/organizationCity';
import {
  CITY_CHANGED_EVENT,
  getSelectedCity,
  setSelectedCity,
} from '../utils/selectedCityStorage';

let citiesPromise = null;

function buildUniqueCities(organizations) {
  const byKey = new Map();
  for (const org of organizations || []) {
    const address = String(org?.address || '').trim();
    if (!address) continue;
    const city = extractCityFromAddress(address);
    if (!city) continue;
    const key = city.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, city);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.localeCompare(b, 'ru', { sensitivity: 'base' })
  );
}

export function fetchAvailableCities() {
  if (!citiesPromise) {
    citiesPromise = apiAxiosUnauth
      .get('/public/organizations')
      .then((res) => buildUniqueCities(res.data || []))
      .catch((err) => {
        citiesPromise = null;
        throw err;
      });
  }
  return citiesPromise;
}

export function useSelectedCity() {
  const [city, setCity] = useState(() => getSelectedCity());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cities, setCities] = useState([]);
  const [citiesStatus, setCitiesStatus] = useState('idle');
  const [citiesError, setCitiesError] = useState(null);

  useEffect(() => {
    const onCityChanged = (event) => {
      const next = event?.detail?.city || getSelectedCity();
      setCity(next);
    };
    const onStorage = (event) => {
      if (event.key === 'sg_selected_city') {
        setCity(getSelectedCity());
      }
    };
    window.addEventListener(CITY_CHANGED_EVENT, onCityChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CITY_CHANGED_EVENT, onCityChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const loadCities = useCallback(async () => {
    setCitiesStatus((prev) => (prev === 'succeeded' ? prev : 'loading'));
    setCitiesError(null);
    try {
      const list = await fetchAvailableCities();
      setCities(list);
      setCitiesStatus('succeeded');
      return list;
    } catch (err) {
      setCitiesError(err?.message || 'Не удалось загрузить города');
      setCitiesStatus('failed');
      return [];
    }
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    void loadCities();
  }, [loadCities]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const selectCity = useCallback((nextCity) => {
    const saved = setSelectedCity(nextCity);
    setCity(saved);
    setIsModalOpen(false);
  }, []);

  return {
    city,
    isModalOpen,
    openModal,
    closeModal,
    selectCity,
    cities,
    citiesStatus,
    citiesError,
    loadCities,
  };
}
