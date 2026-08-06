import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';

const BUYER_LINKS = [
  { to: '/autoparts/new', label: 'Новые запчасти' },
  { to: '/autoparts/used', label: 'Б/у запчасти' },
  { to: '/catalog', label: 'Каталог' },
  { to: '/delivery', label: 'Доставка' },
  { to: '/payment', label: 'Оплата' },
];

const COMPANY_LINKS = [
  { to: '/about', label: 'О компании' },
  { to: '/organizations', label: 'Организации' },
  { to: '/privacy', label: 'Конфиденциальность' },
  { to: '/offer', label: 'Оферта' },
  { to: '/cookie-policy', label: 'Cookie' },
];

export default function SiteFooter() {
  const showSiteReviews = useShowSiteReviews();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const year = new Date().getFullYear();

  const buyerLinks = BUYER_LINKS.filter((link) => showNewAutoparts || link.to !== '/autoparts/new');

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-sg-content px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2">
              <img src="/img/LogoWithoutBg.png" alt="" className="h-9 w-9 object-contain" />
              <span className="text-base font-bold text-ink">Свой Гараж</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
              Новые и б/у автозапчасти: поиск по артикулу, чат с продавцом и заказ в одном месте.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Покупателям</p>
            <ul className="mt-3 space-y-2">
              {buyerLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-ink-soft hover:text-brand-700">
                    {link.label}
                  </Link>
                </li>
              ))}
              {showSiteReviews ? (
                <li>
                  <Link to="/reviews" className="text-sm text-ink-soft hover:text-brand-700">
                    Отзывы
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Компания</p>
            <ul className="mt-3 space-y-2">
              {COMPANY_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-ink-soft hover:text-brand-700">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Продавцам</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/auth" className="text-sm text-ink-soft hover:text-brand-700">
                  Войти в кабинет
                </Link>
              </li>
              <li>
                <a href="/#seller-registration" className="text-sm text-ink-soft hover:text-brand-700">
                  Стать продавцом
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Свой Гараж</p>
          <p>Маркетплейс автозапчастей</p>
        </div>
      </div>
    </footer>
  );
}
