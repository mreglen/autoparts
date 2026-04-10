import React from 'react';

const ReplyArrow = ({ message, onReply, isOwn }) => {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onReply(message);
            }}
            className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 ${
                isOwn ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
            } p-1.5 hover:bg-gray-100 rounded-full transition-colors bg-white/80`}
            title="Ответить на сообщение"
        >
            <svg 
                className={`w-4 h-4 ${isOwn ? 'text-blue-600' : 'text-gray-500'}`} 
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
        </button>
    );
};

export default ReplyArrow;
