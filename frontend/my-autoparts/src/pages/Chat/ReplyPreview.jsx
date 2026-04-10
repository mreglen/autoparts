import React from 'react';

const ReplyPreview = ({ replyTo, onCancel }) => {
    if (!replyTo) return null;

    return (
        <div className="bg-gray-50 border-l-4 border-blue-500 px-4 py-2 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                    <svg 
                        className="w-4 h-4 text-blue-500 flex-shrink-0" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth="2" 
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                        />
                    </svg>
                    <span className="text-xs font-medium text-blue-600">
                        Ответ на сообщение
                    </span>
                </div>
                <p className="text-xs text-gray-600 truncate">
                    {replyTo.message || (replyTo.media && replyTo.media.length > 0 ? '📎 Медиафайл' : 'Сообщение')}
                </p>
            </div>
            <button
                onClick={onCancel}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                title="Отменить ответ"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

export default ReplyPreview;
