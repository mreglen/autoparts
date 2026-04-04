import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Search from '../Navigation/Search/Search';
import { fetchPublicSellers } from '../../redux/slices/SellerSlice';
import { normalizeImageUrl } from '../../utils/apiClient';

function Main() {
  const dispatch = useDispatch();
  const { sellers } = useSelector((state) => state.sellers);
  const sliderRef = useRef(null);

  useEffect(() => {
    dispatch(fetchPublicSellers());
  }, [dispatch]);

  const organizations = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const seller of sellers || []) {
      const key = seller.organization_id || seller.organization_name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: key,
        name: seller.organization_name || 'Организация',
        logo: seller.logo_organization ? normalizeImageUrl(seller.logo_organization) : null,
      });
    }
    return items;
  }, [sellers]);

  const scrollOrganizations = (direction) => {
    if (!sliderRef.current) return;
    const amount = Math.round(sliderRef.current.clientWidth * 0.85);
    sliderRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  // Auto-flow organizations left -> right.
  useEffect(() => {
    if (!sliderRef.current || organizations.length === 0) return;
    const el = sliderRef.current;
    const timer = setInterval(() => {
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 260, behavior: 'smooth' });
      }
    }, 2600);
    return () => clearInterval(timer);
  }, [organizations.length]);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-gradient-to-bl from-blue-100/30 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-indigo-100/30 to-transparent"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Добро пожаловать в "Свой Гараж"
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Найдите любую
                  <span className="block text-gray-900 mt-2">
                    автозапчасть
                  </span>
                </h1>
                
                <p className="text-xl text-gray-600 max-w-2xl leading-relaxed">
                  Быстро, надежно и по лучшим ценам. От частных лиц и проверенных магазинов.
                  Экономьте время и деньги с нашей платформой.
                </p>
              </div>
              
              <div className="pt-4">
                <Search />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link 
                  to="/autoparts/new" 
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 text-center shadow-lg"
                >
                  Найти запчасти
                </Link>
                <Link 
                  to="/auth" 
                  className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 text-center shadow-sm"
                >
                  Войти в аккаунт
                </Link>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -top-8 -right-8 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30"></div>
              <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30"></div>
              
              <div className="relative bg-white rounded-2xl shadow-xl p-2 border border-gray-100 overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">Изображение запчастей</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Organizations Slider */}
      <section className="py-14 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Наши организации-партнеры
            </h2>
            <div className="hidden sm:flex gap-2">
              <button
                type="button"
                onClick={() => scrollOrganizations('left')}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-blue-400 text-gray-600 hover:text-blue-600"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollOrganizations('right')}
                className="w-10 h-10 rounded-full bg-white border border-gray-200 hover:border-blue-400 text-gray-600 hover:text-blue-600"
              >
                →
              </button>
            </div>
          </div>

          <div
            ref={sliderRef}
            className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
          >
            {organizations.map((org) => (
              <div
                key={org.id}
                className="snap-start min-w-[240px] sm:min-w-[280px] bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-16 flex items-center justify-center mb-4 bg-gray-50 rounded-lg overflow-hidden">
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="h-12 max-w-[160px] object-contain"
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">Логотип отсутствует</span>
                  )}
                </div>
                <p className="text-center text-gray-900 font-medium line-clamp-2">{org.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Почему выбирают нас?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Мы создали лучшую платформу для поиска автозапчастей
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="group bg-white p-8 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors duration-300">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Быстрая доставка</h3>
              <p className="text-gray-600 leading-relaxed">Получите запчасти в кратчайшие сроки благодаря нашей сети партнеров</p>
            </div>
            
            <div className="group bg-white p-8 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-green-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-green-100 transition-colors duration-300">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Гарантия качества</h3>
              <p className="text-gray-600 leading-relaxed">Все товары проходят строгую проверку перед продажей</p>
            </div>
            
            <div className="group bg-white p-8 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-purple-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-100 transition-colors duration-300">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Лучшие цены</h3>
              <p className="text-gray-600 leading-relaxed">Конкурентные цены от прямых поставщиков без наценок</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Preview */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Популярные категории
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed">
              Широкий ассортимент запчастей для вашего автомобиля
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'Двигатель', icon: 'engine' },
              { name: 'Тормоза', icon: 'brake' },
              { name: 'Подвеска', icon: 'suspension' },
              { name: 'Электрика', icon: 'electric' },
              { name: 'Кузов', icon: 'body' },
              { name: 'Трансмиссия', icon: 'transmission' },
              { name: 'Охлаждение', icon: 'cooling' },
              { name: 'Выхлоп', icon: 'exhaust' }
            ].map((category, index) => (
              <Link 
                key={index}
                to="/autoparts/new"
                className="bg-white rounded-xl p-6 text-center hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-blue-200 group"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-50 transition-colors duration-300">
                  <svg className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {category.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">500K+</div>
              <div className="text-blue-100">Запчастей в каталоге</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">15K+</div>
              <div className="text-blue-100">Довольных клиентов</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">24/7</div>
              <div className="text-blue-100">Поддержка</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">5 лет</div>
              <div className="text-blue-100">На рынке</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto text-center px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Готовы найти нужные запчасти?
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Присоединяйтесь к тысячам довольных клиентов уже сегодня
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/autoparts/new"
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 text-center"
            >
              Начать поиск
            </Link>
            <Link 
              to="/auth"
              className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg border-2 border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 text-center"
            >
              Создать аккаунт
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Main;