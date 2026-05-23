import React from 'react';

const ConfirmModal = ({ isOpen, onClose, title, message, onConfirm, confirmText = "Подтвердить", cancelText = "Отмена", confirmButtonClass = "bg-indigo-600 hover:bg-indigo-700" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="text-center">
                        {/* Warning Icon */}
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
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
                        
                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={async () => {
                                    if (!onConfirm) {
                                        onClose();
                                        return;
                                    }
                                    try {
                                        await Promise.resolve(onConfirm());
                                        onClose();
                                    } catch {
                                        // Родитель обрабатывает ошибку (например через unwrap/)
                                    }
                                }}
                                className={`flex-1 ${confirmButtonClass} text-white py-2 px-4 rounded-md transition-colors`}
                            >
                                {confirmText}
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md transition-colors"
                            >
                                {cancelText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;