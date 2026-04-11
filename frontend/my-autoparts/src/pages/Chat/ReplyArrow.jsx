import React from 'react';

const ReplyArrow = ({ message, onReply, isOwn }) => {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onReply(message);
            }}
            className={`pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 transition-opacity absolute z-10 top-1/2 -translate-y-1/2 p-1.5 rounded-full shadow-sm ${
                isOwn
                    ? 'right-full mr-2'
                    : 'left-full ml-2'
            } ${
                isOwn
                    ? 'bg-blue-500/35 hover:bg-blue-500/55 text-white'
                    : 'bg-white/95 hover:bg-gray-100 text-gray-600 ring-1 ring-gray-200/80'
            }`}
            title="Ответить на сообщение"
        >
            <svg 
                className="w-4 h-4" 
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
