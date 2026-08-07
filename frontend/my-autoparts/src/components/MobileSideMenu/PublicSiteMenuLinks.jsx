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
        isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-900 active:bg-gray-50'
      }`;
    }
    return `mx-2 flex w-[calc(100%-1rem)] items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gray-100 text-gray-900'
        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
    }`;
  };

  return (
    <div className={isDrawer ? 'mt-4 border-t border-gray-100 pt-3' : 'mt-2 border-t border-gray-100 px-1 pt-4 pb-4'}>
      <p
        className={`font-medium text-gray-500 ${
          isDrawer ? 'px-3 pb-2 text-xs' : 'mb-2 px-3 text-xs'
        }`}
      >
        Информация
      </p>
      <nav className={`flex flex-col ${isDrawer ? 'gap-0.5' : 'gap-0.5'}`}>
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
