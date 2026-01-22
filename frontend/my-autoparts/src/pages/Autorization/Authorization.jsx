// Authorization.jsx
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { resetRegistration } from '../../redux/slices/AuthSlice'; 
import Login from './Login/Login';
import Registration from './Registration/Registration';

export default function Authorization() {
  const [showRegister, setShowRegister] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSwitch = () => {
    dispatch(resetRegistration()); 
    setShowRegister(!showRegister);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Return to Home Button */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Вернуться на главную
          </button>
        </div>
        <div className="p-8">
          {showRegister ? <Registration /> : <Login />}
        </div>
        <div className="bg-gray-50 px-8 py-4 text-center">
          <p className="text-sm text-gray-600">
            {showRegister ? (
              <>
                Уже есть аккаунт?{' '}
                <button
                  type="button"
                  onClick={handleSwitch}
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Войти
                </button>
              </>
            ) : (
              <>
                Нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={handleSwitch}
                  className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Создать
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}