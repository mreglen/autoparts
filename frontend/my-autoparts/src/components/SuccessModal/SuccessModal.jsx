import React from 'react';

const SuccessModal = ({ isOpen, onClose, title, message, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="text-center">
                        {/* Success Icon */}
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
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
                            onClick={() => {
                                if (onConfirm) {
                                    onConfirm();
                                }
                                onClose();
                            }}
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors"
                        >
                            Продолжить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuccessModal;