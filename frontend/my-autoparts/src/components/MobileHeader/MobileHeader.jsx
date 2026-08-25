import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getPageTitle } from '../../hooks/useMobileMenuShell';
import useHistoryBack from '../../hooks/useHistoryBack';
import { useShowYandexBadge } from '../../utils/siteReviewsPublic';
import HeaderYandexBadge from '../Seo/HeaderYandexBadge';
import CitySelectModal from '../CitySelectModal/CitySelectModal';
import { useSelectedCity } from '../../hooks/useSelectedCity';
import { PWA_START_PATH, usePwaStandalone } from '../../utils/pwaStandalone';
import { Z_MOBILE_HEADER } from '../../constants/mobileTokens';
import { Button } from '../UI';
import {
  HeaderAvatar,
  HeaderCityChip,
  HeaderIconButton,
  HeaderLogo,
} from '../Header/headerPrimitives';

function MenuDotsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export default function MobileHeader({ onMenuClick, showMenuButton = true, hidden = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useSelector((state) => state.auth);
  const {
    city: selectedCity,
    isModalOpen: isCityModalOpen,
    openModal: openCityModal,
    closeModal: closeCityModal,
    selectCity,
    cities,
    citiesStatus,
    citiesError,
    loadCities,
  } = useSelectedCity();

  const pageTitle = getPageTitle(location.pathname);
  const isHome = location.pathname === '/';
  const isAutopartsListRoot =
    location.pathname === '/autoparts' ||
    location.pathname === '/autoparts/new' ||
    location.pathname === '/autoparts/used';
  const showCityChip = isHome || isAutopartsListRoot;
  const showBack = !isHome && !isAutopartsListRoot;

  const firstName = user?.first_name || user?.name?.split?.(' ')?.[0] || 'П';
  const profilePath = '/profile';
  const showYandexBadge = useShowYandexBadge();

  const isPwa = usePwaStandalone();
  const handleBack = useHistoryBack(isPwa ? PWA_START_PATH : '/');

  return (
    <>
      <header
        className={`lg:hidden fixed inset-x-0 top-0 border-b border-line bg-surface pt-safe-top ${hidden ? 'hidden' : ''}`}
        style={{ zIndex: Z_MOBILE_HEADER }}
      >
        {showYandexBadge ? <HeaderYandexBadge /> : null}
        <div className="flex h-[3.75rem] items-center gap-2.5 px-4 sm:px-6">
          {showBack ? (
            <HeaderIconButton onClick={handleBack} label="Назад">
              <BackIcon />
            </HeaderIconButton>
          ) : (
            <HeaderLogo />
          )}

          <div className="min-w-0 flex-1 text-center sm:text-left">
            {showBack ? (
              <p className="truncate text-[15px] font-semibold text-ink">{pageTitle}</p>
            ) : showCityChip ? (
              <HeaderCityChip
                city={selectedCity}
                onClick={openCityModal}
                isOpen={isCityModalOpen}
                className="mx-auto sm:mx-0"
              />
            ) : (
              <p className="truncate text-[15px] font-semibold text-ink">{pageTitle}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <HeaderIconButton onClick={() => navigate('/autoparts/new')} label="Поиск в каталоге">
              <SearchIcon />
            </HeaderIconButton>

            {token && user ? (
              <Link to={profilePath} aria-label="Профиль" className="shrink-0 active:scale-[0.97]">
                <HeaderAvatar initial={firstName} />
              </Link>
            ) : (
              <Button
                variant="soft"
                size="sm"
                className="shrink-0"
                onClick={() => navigate('/auth')}
              >
                Войти
              </Button>
            )}

            {showMenuButton ? (
              <HeaderIconButton onClick={onMenuClick} label="Открыть меню" accent>
                <MenuDotsIcon />
              </HeaderIconButton>
            ) : null}
          </div>
        </div>
      </header>
      <CitySelectModal
        isOpen={isCityModalOpen}
        onClose={closeCityModal}
        selectedCity={selectedCity}
        cities={cities}
        citiesStatus={citiesStatus}
        citiesError={citiesError}
        onSelect={selectCity}
        onRetry={loadCities}
      />
    </>
  );
}
