

function ButtonLogIn({ text}) {

    return (
        <>
            <button
                className='px-10 h-12 rounded-md text-white font-bold border-blue_primary-light border-2 hover:scale-105 transition-transform ease-in-out dark:text-blue_primary-light'
            >
                {text}
            </button>
        </>
    );
}

export default ButtonLogIn;