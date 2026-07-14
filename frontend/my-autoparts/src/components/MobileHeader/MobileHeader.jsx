import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getPageTitle } from '../../hooks/useMobileMenuShell';
import useHistoryBack from '../../hooks/useHistoryBack';
import { useShowYandexBadge } from '../../utils/siteReviewsPublic';
import HeaderYandexBadge from '../Seo/HeaderYandexBadge';
import CitySelectModal from '../CitySelectModal/CitySelectModal';
import { useSelectedCity } from '../../hooks/useSelectedCity';

function HeaderIconButton({ onClick, to, label, children, accent, badge = 0 }) {
    const className = `relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.97] ${
        accent
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700 active:bg-indigo-100'
            : 'border-gray-200/80 bg-white text-gray-600 active:bg-gray-50'
    }`;

    const content = (
        <>
            {children}
            {badge > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badge > 99 ? '99+' : badge}
                </span>
            ) : null}
        </>
    );

    if (to) {
        return (
            <Link to={to} aria-label={label} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <button type="button" onClick={onClick} aria-label={label} className={className}>
            {content}
        </button>
    );
}

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

function LocationPinIcon({ className = 'h-3.5 w-3.5' }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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

    const handleBack = useHistoryBack('/');

    return (
        <>
        <header className={`lg:hidden fixed inset-x-0 top-0 z-40 border-b border-gray-200/90 bg-white/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/85 pt-safe-top ${hidden ? 'hidden' : ''}`}>
            {showYandexBadge ? <HeaderYandexBadge /> : null}
            <div className="flex h-[3.75rem] items-center gap-2.5 px-3 sm:px-4">
                {showBack ? (
                    <HeaderIconButton onClick={handleBack} label="Назад">
                        <BackIcon />
                    </HeaderIconButton>
                ) : (
                    <Link
                        to="/"
                        className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl py-1 pr-2 active:opacity-80"
                        aria-label="На главную"
                    >
                        <img
                            src="/img/LogoWithoutBg.png"
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg object-contain"
                        />
                        <div className="min-w-0 leading-tight text-blue-900">
                            <span className="block truncate text-sm font-bold">Свой</span>
                            <span className="block truncate text-sm font-bold">Гараж</span>
                        </div>
                    </Link>
                )}

                <div className="min-w-0 flex-1 text-center sm:text-left">
                    {showBack ? (
                        <p className="truncate text-[15px] font-semibold text-gray-900">{pageTitle}</p>
                    ) : showCityChip ? (
                        <button
                            type="button"
                            onClick={openCityModal}
                            className="mx-auto inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-xs font-medium text-gray-600 transition active:bg-gray-50 sm:mx-0"
                            aria-haspopup="dialog"
                            aria-expanded={isCityModalOpen}
                            aria-label={`Город: ${selectedCity}`}
                        >
                            <LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                            <span className="truncate">г. {selectedCity}</span>
                            <svg className="h-3 w-3 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    ) : (
                        <p className="truncate text-[15px] font-semibold text-gray-900">{pageTitle}</p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    <HeaderIconButton onClick={() => navigate('/autoparts/new')} label="Поиск в каталоге">
                        <SearchIcon />
                    </HeaderIconButton>

                    {token && user ? (
                        <Link
                            to={profilePath}
                            aria-label="Профиль"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200/80 bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white shadow-sm active:scale-[0.97]"
                        >
                            {firstName.charAt(0).toUpperCase()}
                        </Link>
                    ) : (
                        <button
                            type="button"
                            onClick={() => navigate('/auth')}
                            className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 active:bg-indigo-100"
                        >
                            Войти
                        </button>
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
