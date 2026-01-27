import React from 'react';

function SuccessNotification({ message, onClose, onConfirm }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96 relative z-50">
                {/* Close button */}
                <button
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                    onClick={onClose}
                >
                    &times;
                </button>

                {/* Icon and title */}
                <div className="text-center mb-4">
                    <div className="mx-auto bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mb-3">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Заявка отправлена</h2>
                </div>

                {/* Message */}
                <div className="mb-6">
                    <p className="text-gray-700 whitespace-pre-line text-center">
                        {message}
                    </p>
                </div>

                {/* Confirm button */}
                <div className="text-center">
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        Продолжить
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SuccessNotification;