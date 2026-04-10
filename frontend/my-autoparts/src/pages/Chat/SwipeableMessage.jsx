import React, { useState, useRef } from 'react';

const SwipeableMessage = ({ message, onReply, children, isOwn }) => {
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const swipeRef = useRef(null);

    // Минимальное расстояние для свайпа
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => {
        const currentTouch = e.targetTouches[0].clientX;
        const distance = touchStart - currentTouch;
        
        // Only allow swipe in one direction based on message position
        if (isOwn && distance < 0) {
            setSwipeOffset(Math.abs(distance));
        } else if (!isOwn && distance > 0) {
            setSwipeOffset(distance);
        }
        
        setTouchEnd(currentTouch);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setSwipeOffset(0);
            return;
        }

        const distance = touchStart - touchEnd;
        const isSwipeLeft = distance > 0;
        const isSwipeRight = distance < 0;

        // Swipe direction depends on message position
        if (isOwn && isSwipeRight && Math.abs(distance) >= minSwipeDistance) {
            onReply(message);
        } else if (!isOwn && isSwipeLeft && Math.abs(distance) >= minSwipeDistance) {
            onReply(message);
        }

        setSwipeOffset(0);
        setTouchStart(null);
        setTouchEnd(null);
    };

    return (
        <div
            ref={swipeRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="relative"
            style={{
                transform: `translateX(${isOwn ? swipeOffset : -swipeOffset}px)`,
                transition: swipeOffset > 0 ? 'none' : 'transform 0.2s ease'
            }}
        >
            {/* Visual feedback for swipe */}
            {swipeOffset > 30 && (
                <div className={`absolute top-1/2 -translate-y-1/2 ${
                    isOwn ? 'left-0 -translate-x-full pr-3' : 'right-0 translate-x-full pl-3'
                }`}>
                    <svg 
                        className="w-6 h-6 text-blue-500" 
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
                </div>
            )}
            
            {children}
        </div>
    );
};

export default SwipeableMessage;
