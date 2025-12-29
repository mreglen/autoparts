import React, { useState } from 'react';
import Modal from './Modal'

function ButtonOpacity({ text, isModal = false }) {
    const [showModal, setShowModal] = useState(false);

    const handleClick = () => {
        if (isModal) {
            setShowModal(true);
        }
    };


    return (
        <>
            <button
                className='px-10 h-12 rounded-md text-white font-bold border-blue_primary-light border-2 hover:scale-105 transition-transform ease-in-out dark:text-blue_primary-light'
                onClick={handleClick}
            >
                {text}
            </button>

            {showModal && (
                <Modal onClose={() => setShowModal(false)} />
            )}
        </>
    );
}

export default ButtonOpacity;