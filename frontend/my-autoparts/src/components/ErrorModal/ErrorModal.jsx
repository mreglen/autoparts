import React from 'react';

const ErrorModal = ({ isOpen, onClose, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="text-center">
                        {/* Error Icon */}
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {title}
                        </h3>
                        
                        {/* Message */}
                        <p className="text-gray-600 mb-6">
                            {message}
                        </p>
                        
                        {/* Button */}
                        <button
                            onClick={onClose}
                            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors"
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorModal;