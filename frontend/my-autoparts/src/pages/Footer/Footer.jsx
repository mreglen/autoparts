import React from 'react';
import { NavLink } from 'react-router-dom';
import { useShowSiteReviews } from '../../utils/siteReviewsPublic';
import ButtonPrimary from '../UI/ButtonPrimary';

function Footer() {
    const showSiteReviews = useShowSiteReviews();
    return (
        <footer className='2xl:px-80 xl:px-40 lg:px-20 md:px-10 sm:px-5 px-4 bg-gray_primary-dark mt-40 py-14'>
            {/* Верхняя часть футера */}
            <div className='flex flex-col md:flex-row justify-between items-center gap-6'>
                {/* Логотип и название */}
                <NavLink exact to='/' className='flex items-center gap-4'>
                    <img src="/img/orig-1.png" alt="Логотип" className='h-10 w-auto' />
                    <div className='flex flex-col text-white'>
                        <p className='font-bold'>Свой</p>
                        <p className='font-bold'>гараж</p>
                    </div>
                </NavLink>

                {/* Навигация */}
                <nav className='flex flex-wrap justify-center gap-4 text-white font-normal'>
                    <NavLink
                        exact
                        to='/'
                        className='hover:text-blue_primary-light transition-colors ease-in-out'
                    >
                        Главная
                    </NavLink>
                    <NavLink
                        exact
                        to='/autoparts/new'
                        className='hover:text-blue_primary-light transition-colors ease-in-out'
                    >
                        Автозапчасти
                    </NavLink>
                    {showSiteReviews && (
                    <NavLink
                        exact
                        to='/reviews'
                        className='hover:text-blue_primary-light transition-colors ease-in-out'
                    >
                        Отзывы
                    </NavLink>
                    )}
                    <NavLink
                        exact
                        to='/about'
                        className='hover:text-blue_primary-light transition-colors ease-in-out'
                    >
                        О компании
                    </NavLink>
                </nav>

                {/* Кнопка "Записаться" */}
                <ButtonPrimary text='Записаться' isModal={true} />
            </div>

            {/* Нижняя часть футера */}
            <div className='flex flex-col md:flex-row justify-between mt-14 gap-6'>
                {/* Телефон */}
                <div className='text-center md:text-left'>
                    <h1 className='text-white font-bold'>Телефон</h1>
                    <p className='text-gray_primary-light font-light'>+1 234 567 89 01</p>
                    <p className='text-gray_primary-light font-light'>+1 234 567 89 01</p>
                </div>

                {/* Email */}
                <div className='text-center md:text-left'>
                    <h1 className='text-white font-bold'>Email</h1>
                    <p className='text-gray_primary-light font-light'>example@email.com</p>
                    <p className='text-gray_primary-light font-light'>example@email.com</p>
                </div>

                {/* Местоположение */}
                <div className='text-center md:text-left'>
                    <h1 className='text-white font-bold'>Местоположение</h1>
                    <p className='text-gray_primary-light font-light'>п. Ягодный, ул. Фруктовая 17</p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;