import React from 'react';
import { NavLink } from 'react-router-dom';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';

export function getPublicSiteMenuLinks(showSiteReviews) {
  const links = [
    { path: '/organizations', label: 'Организации' },
    { path: '/delivery', label: 'Доставка' },
    { path: '/about', label: 'О компании' },
    ...(showSiteReviews ? [{ path: '/reviews', label: 'Отзывы' }] : []),
    { path: '/payment', label: 'Оплата' },
  ];
  return links;
}

/**
 * Публичные страницы сайта в боковом / выездном меню.
 */
export default function PublicSiteMenuLinks({ variant = 'drawer', onNavigate }) {
  const showSiteReviews = useShowSiteReviews();
  const links = getPublicSiteMenuLinks(showSiteReviews);
  const isDrawer = variant === 'drawer';

  const itemClass = ({ isActive }) => {
    if (isDrawer) {
      return `flex min-h-[44px] w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-800 active:bg-gray-50'
      }`;
    }
    return `flex w-full items-center border-l-4 px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'
    }`;
  };

  return (
    <div className={isDrawer ? 'mt-4 border-t border-gray-100 pt-3' : 'mt-4 border-t border-gray-200 pt-4'}>
      <p
        className={`font-semibold uppercase tracking-wider text-gray-400 ${
          isDrawer ? 'px-3 pb-2 text-xs' : 'mb-2 px-4 text-[11px]'
        }`}
      >
        Информация
      </p>
      <nav className={`flex flex-col ${isDrawer ? 'gap-0.5' : 'gap-0'}`}>
        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            onClick={onNavigate}
            className={itemClass}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
