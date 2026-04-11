import React from 'react';

const ReplyArrow = ({ message, onReply }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onReply(message);
      }}
      aria-label="Ответить на сообщение"
      title="Ответить"
      className={
        `hidden lg:flex z-20 h-9 w-9 shrink-0 self-center items-center justify-center rounded-full ` +
        `bg-white text-gray-600 ring-1 ring-gray-200/95 shadow-md ` +
        `transition-[transform,opacity,box-shadow] duration-200 ease-out motion-reduce:transition-none ` +
        `hover:bg-gray-50 lg:group-hover:bg-gray-50 lg:group-hover:shadow-md ` +
        `active:scale-95 ` +
        `focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ` +
        `pointer-events-none opacity-0 scale-[0.88] ` +
        `lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-hover:scale-100`
      }
    >
      <svg
        className="h-[17px] w-[17px] shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 6 6v0"
        />
      </svg>
    </button>
  );
};

export default ReplyArrow;
