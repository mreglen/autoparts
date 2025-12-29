import React, { useState } from 'react';
import Modal from './Modal';

function ButtonPrimary({ text, isModal = false}) {
    const [showModal, setShowModal] = useState(false);

    const handleClick = () => {
        if (isModal) {
            setShowModal(true);
        }
    };

    return (
        <>
            <button
                className='bg-blue_primary-light px-10 h-12 rounded-md text-white font-bold hover:bg-blue_primary-middle transition-colors ease-in-out duration-200 '
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

export default ButtonPrimary;