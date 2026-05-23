import React, { useState } from 'react';

const RejectProductModal = ({ isOpen, onClose, onReject, productName }) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onReject(reason.trim());
        setReason('');
        setError('');
    };

    const handleClose = () => {
        setReason('');
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Отклонить запчасть
                        </h3>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    {productName && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">Запчасть:</p>
                            <p className="font-medium text-gray-900">{productName}</p>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                                Комментарий (необязательно)
                            </label>
                            <textarea
                                id="reason"
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    if (error) setError('');
                                }}
                                rows="4"
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                                    error ? 'border-red-500' : 'border-gray-300'
                                }`}
                                placeholder="Укажите причину отклонения, если нужно..."
                            />
                            {error && (
                                <p className="mt-1 text-sm text-red-600">{error}</p>
                            )}
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors"
                            >
                                Отклонить
                            </button>
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md transition-colors"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RejectProductModal;