import React from 'react';
import ButtonPrimary from '../../../components/UI/ButtonPrimary';

function Banner(props) {
    return (
        <div className='bg-blue_primary-dark rounded-md p-6 sm:p-10 mt-20 sm:mt-40 h-auto'>
            <div className='flex flex-col md:flex-row justify-between items-center gap-8'>
                {/* Левая часть: текст и кнопка */}
                <div className='flex flex-col gap-6 text-center md:text-left'>
                    <div>
                        <h1 className='text-white font-extrabold text-3xl sm:text-4xl lg:text-5xl max-w-xs sm:max-w-md lg:max-w-xl'>
                            {props.hText}
                        </h1>
                        <p className='text-white font-normal text-base sm:text-lg lg:text-xl mt-4'>
                            {props.pText}
                        </p>
                    </div>
                    <div className='flex flex-col sm:flex-row gap-4'>
                        <ButtonPrimary text={props.btnText} isModal={true}/>
                    </div>
                </div>

                {/* Правая часть: изображение */}
                <div className='w-full md:w-auto'>
                    <img
                        src={props.bannerImg}
                        alt="Баннер"
                        className='w-full h-auto rounded-md sm:h-64 lg:h-80'
                    />
                </div>
            </div>
        </div>
    );
}

export default Banner;