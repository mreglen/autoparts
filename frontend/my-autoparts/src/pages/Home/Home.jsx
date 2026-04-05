import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Hero Section */}
            <section className="relative pt-20 pb-32 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10"></div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            <div className="space-y-6">
                                <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                    Добро пожаловать в "Свой Гараж"
                                </div>
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                                    Найдите любую
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"> автозапчасть</span>
                                </h1>
                                <p className="text-xl text-gray-600 max-w-2xl">
                                    Быстро, надежно и по лучшим ценам. От частных лиц и проверенных магазинов.
                                    Экономьте время и деньги с нашей платформой.
                                </p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link 
                                    to="/autoparts/new" 
                                    className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 text-center"
                                >
                                    Найти запчасти
                                </Link>
                                <Link 
                                    to="/auth" 
                                    className="px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-md transition-all duration-300 text-center"
                                >
                                    Войти в аккаунт
                                </Link>
                            </div>
                        </div>
                        
                        <div className="relative">
                            <div className="absolute -top-8 -right-8 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
                            <div className="absolute -bottom-8 -left-8 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
                            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                                <img 
                                    src="/img/car-parts-hero.jpg" 
                                    alt="Автозапчасти" 
                                    className="w-full h-auto rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Почему выбирают нас?
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Мы создали лучшую платформу для поиска автозапчастей
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="text-center group">
                            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-100 transition-colors duration-300">
                                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Быстрая доставка</h3>
                            <p className="text-gray-600">Получите запчасти в кратчайшие сроки благодаря нашей сети партнеров</p>
                        </div>
                        
                        <div className="text-center group">
                            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-green-100 transition-colors duration-300">
                                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Гарантия качества</h3>
                            <p className="text-gray-600">Все товары проходят строгую проверку перед продажей</p>
                        </div>
                        
                        <div className="text-center group">
                            <div className="w-20 h-20 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-100 transition-colors duration-300">
                                <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-3">Лучшие цены</h3>
                            <p className="text-gray-600">Конкурентные цены от прямых поставщиков без наценок</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Categories Preview */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Популярные категории
                        </h2>
                        <p className="text-xl text-gray-600">
                            Широкий ассортимент запчастей для вашего автомобиля
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { name: 'Двигатель', icon: '⚙️' },
                            { name: 'Тормоза', icon: '🛑' },
                            { name: 'Подвеска', icon: '🚗' },
                            { name: 'Электрика', icon: '⚡' },
                            { name: 'Кузов', icon: '🛡️' },
                            { name: 'Трансмиссия', icon: '🔄' },
                            { name: 'Охлаждение', icon: '❄️' },
                            { name: 'Выхлоп', icon: '💨' }
                        ].map((category, index) => (
                            <Link 
                                key={index}
                                to="/autoparts/new"
                                className="bg-white rounded-xl p-6 text-center hover:shadow-lg transition-shadow duration-300 border border-gray-100 hover:border-blue-200 group"
                            >
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                                    {category.icon}
                                </div>
                                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {category.name}
                                </h3>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
                <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Готовы найти нужные запчасти?
                    </h2>
                    <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                        Присоединяйтесь к тысячам довольных клиентов уже сегодня
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link 
                            to="/autoparts/new"
                            className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors duration-300 text-center"
                        >
                            Начать поиск
                        </Link>
                        <Link 
                            to="/auth"
                            className="px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition-all duration-300 text-center"
                        >
                            Создать аккаунт
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Home;