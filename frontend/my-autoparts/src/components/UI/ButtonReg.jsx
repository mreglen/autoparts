

function ButtonReg({ text }) {
  return (
    <button
      type="button"
      className="bg-red-500 px-10 h-12 rounded-md text-white font-bold hover:bg-red-600 transition-colors ease-in-out duration-200"
    >
      {text}
    </button>
  );
}

export default ButtonReg;