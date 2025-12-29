// src/pages/Home.js

import React from 'react';
import { Link } from 'react-router-dom';
import Search from '../Navigation/Search/Search';


function Main() {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero bg-gradient-to-r from-blue-900 to-blue-700 text-white py-16 px-4 md:px-8">
        <div className="container mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="md:w-1/2 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Найдите любую автозапчасть</h1>
            <p className="text-xl mb-6">Быстро, надежно, по лучшим ценам. От частных лиц и проверенных магазинов.</p>
            <Search />
          </div>
          <div className="md:w-1/2">
            <img
              src="/img/car-parts-hero.jpg"
              alt="Автозапчасти"
              className="rounded-lg shadow-xl w-full max-w-md mx-auto md:mx-0"
            />
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 px-4 md:px-8 bg-gray-50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Почему выбирают нас?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="text-blue-600 text-4xl mb-4">🔧</div>
              <h3 className="text-xl font-semibold mb-2">Широкий ассортимент</h3>
              <p>Более 500 000 запчастей для всех марок автомобилей — от ВАЗ до Tesla.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="text-green-600 text-4xl mb-4">💰</div>
              <h3 className="text-xl font-semibold mb-2">Лучшие цены</h3>
              <p>Сравнивайте цены от разных продавцов и выбирайте выгодное предложение.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="text-orange-600 text-4xl mb-4">📦</div>
              <h3 className="text-xl font-semibold mb-2">Быстрая доставка</h3>
              <p>Запчасти в наличии на складах по всей стране — получите товар за 1-3 дня.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 md:px-8">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Популярные категории</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'Двигатель', img: '/img/engine.jpg' },
              { name: 'Трансмиссия', img: '/img/transmission.jpg' },
              { name: 'Подвеска', img: '/img/suspension.jpg' },
              { name: 'Тормоза', img: '/img/brakes.jpg' },
              { name: 'Электрика', img: '/img/electrics.jpg' },
              { name: 'Фильтры', img: '/img/filters.jpg' },
              { name: 'Кузов', img: '/img/body.jpg' },
              { name: 'Масла', img: '/img/oil.jpg' }
            ].map((cat, idx) => (
              <Link
                key={idx}
                to={`/category/${cat.name.toLowerCase()}`}
                className="block bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition group"
              >
                <img
                  src={cat.img}
                  alt={cat.name}
                  className="w-full h-32 object-cover group-hover:scale-105 transition"
                />
                <div className="p-4 text-center">
                  <h3 className="font-semibold">{cat.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Sell Your Parts */}
      <section className="py-16 px-4 md:px-8 bg-blue-50">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">У вас есть запчасти?</h2>
          <p className="text-lg mb-8">Разместите объявление — найдите покупателя за пару минут!</p>
          <Link
            to="/sell"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition"
          >
            Разместить объявление
          </Link>
        </div>
      </section>

      {/* Latest Listings */}
      <section className="py-16 px-4 md:px-8">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Новые объявления</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                <img
                  src={`/img/listing-${i}.jpg`}
                  alt="Запчасть"
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-bold text-lg">Щуп масляный LEX SP2114</h3>
                  <p className="text-gray-600 mb-2">BMW, Mercedes, Audi</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-red-600">282 ₽</span>
                    <span className="text-sm text-gray-500">В наличии</span>
                  </div>
                  <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">
                    Купить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-16 px-4 md:px-8 bg-gray-800 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Готовы начать?</h2>
          <p className="text-xl mb-8">Ищите, покупайте, продавайте — всё в одном месте.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/autoparts"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition"
            >
              Начать поиск
            </Link>
            <Link
              to="/sell"
              className="bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-green-700 transition"
            >
              Разместить запчасть
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Main;