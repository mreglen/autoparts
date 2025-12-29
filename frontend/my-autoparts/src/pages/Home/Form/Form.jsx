import React from 'react';
import ButtonPrimary from '../../../components/UI/ButtonPrimary';


function Form() {
    return (
        <div className="bg-gray_primary-dark p-10 rounded-md mt-40">
           
            <h1 className="text-white text-5xl font-extrabold mb-6">Отправьте заявку</h1>

           
            <form className="space-y-4 max-w-md">
              
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Ваше имя"
                        className="w-full px-4 py-2 bg-gray-200 rounded-md focus:outline-none focus:bg-white"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center pr-3 text-gray-500">
                        <img src="/img/user (1) 1.svg" alt="" />
                    </span>
                </div>

             
                <div className="relative">
                    <input
                        type="tel"
                        placeholder="Ваш номер"
                        className="w-full px-4 py-2 bg-gray-200 rounded-md focus:outline-none focus:bg-white"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center pr-3 text-gray-500">
                        <img src="/img/telephone 1.svg" alt="" />
                    </span>
                </div> 

                <ButtonPrimary text='Отправить' />
            </form>
        </div>
    );
}

export default Form;