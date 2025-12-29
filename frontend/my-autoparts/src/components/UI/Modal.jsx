import React, { useState } from 'react';
import ButtonPrimary from './ButtonPrimary';

function Modal({ onClose }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Submitted:', { name, phone });
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
            <div className="bg-white p-6 rounded-lg w-80 relative z-50">
                {/* Кнопка закрытия */}
                <button
                    className="float-right text-gray-600 hover:text-gray-800"
                    onClick={onClose}
                >
                    &times;
                </button>

                {/* Заголовок */}
                <h2 className="text-xl font-bold mb-4">Введите данные</h2>

                {/* Форма */}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Имя</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2">Телефон</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                            required
                        />
                    </div>

                    {/* Кнопка отправки */}
                    <ButtonPrimary text="Отправить" />
                </form>
            </div>
        </div>
    );
}

export default Modal;