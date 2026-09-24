import { useState } from 'react';

const GRID_SIZE = 4;
const TILES = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i + 1);
const CORRECT_COLUMNS = [1, 2];
const CORRECT_TILES = TILES.filter((n) => CORRECT_COLUMNS.includes((n - 1) % GRID_SIZE));

export default function ImageCaptcha({ onVerify }) {
    const [selected, setSelected] = useState([]);
    const [status, setStatus] = useState('idle');

    const toggle = (n) => {
        if (status === 'passed') return;
        setStatus('idle');
        setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
    };

    const check = () => {
        const ok =
            selected.length === CORRECT_TILES.length &&
            CORRECT_TILES.every((n) => selected.includes(n));
        setStatus(ok ? 'passed' : 'failed');
        if (!ok) setSelected([]);
        onVerify?.(ok);
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-700">
                Подтвердите, что вы не робот: выберите <span className="font-semibold">нужные картинки</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
                {TILES.map((n) => {
                    const isSelected = selected.includes(n);
                    return (
                        <button
                            key={n}
                            type="button"
                            onClick={() => toggle(n)}
                            aria-pressed={isSelected}
                            className={`relative aspect-[3/4] overflow-hidden rounded-md border-2 transition ${
                                isSelected ? 'border-indigo-600 ring-2 ring-indigo-300' : 'border-gray-200 hover:border-gray-400'
                            }`}
                        >
                            <img
                                src={`/img/captcha/${n}.jpg`}
                                alt={`Картинка ${n}`}
                                draggable={false}
                                className="w-full h-full object-cover select-none"
                            />
                            {isSelected && (
                                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                                    ✓
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {status === 'failed' && (
                <p className="text-sm text-red-600">Неверно, попробуйте ещё раз</p>
            )}
            {status === 'passed' ? (
                <p className="text-sm text-green-600 font-medium">Проверка пройдена</p>
            ) : (
                <button
                    type="button"
                    onClick={check}
                    disabled={selected.length === 0}
                    className="w-full py-2 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-60 transition-colors"
                >
                    Проверить
                </button>
            )}
        </div>
    );
}
