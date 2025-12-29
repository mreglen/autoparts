import React from 'react';

import ButtonPrimary from '../../../components/UI/ButtonPrimary';
import ButtonOpacity from '../../../components/UI/ButtonOpacity';


const SliderComponent = () => {
    return (
        <div className='bg-gray_primary-dark rounded-md p-6 sm:p-10 mt-12'>
            <div className='flex flex-col md:flex-row justify-between items-center gap-8'>
                <div className='flex flex-col gap-6 text-center md:text-left'>
                    <div>
                        <h1 className='text-white font-extrabold text-4xl sm:text-5xl'>
                            Запишитесь быстро <br className='hidden sm:block' />
                            в приложении
                        </h1>
                        <p className='text-white font-normal text-lg sm:text-xl mt-4'>
                            Скачивайте прямо сейчас
                        </p>
                    </div>
                    <div className='flex flex-col sm:flex-row gap-4'>
                        <ButtonPrimary text='Установить приложение' />
                        <ButtonOpacity text='Записаться' isModal={true} />
                    </div>
                </div>


                <div className='w-full md:w-auto'>
                    <img
                        src="/img/Mask group.png"
                        alt="Баннер"
                        className='w-full h-auto rounded-md'
                    />
                </div>
            </div>
        </div>
    );

};

export default SliderComponent;