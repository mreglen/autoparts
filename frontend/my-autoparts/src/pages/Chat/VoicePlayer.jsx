import React, { useRef, useState, useEffect } from 'react';

/**
 * Кастомный плеер для голосовых сообщений Авито
 * - Play/pause с анимацией
 * - Progress bar
 * - Отображение времени
 */
function VoicePlayer({ src, isOwn }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * duration;

    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remaining = duration - currentTime;

  return (
    <div className="flex items-center gap-2 my-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!isLoaded}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white disabled:opacity-50'
            : 'bg-blue-100 hover:bg-blue-200 text-blue-600 disabled:opacity-50'
        }`}
        aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
      >
        {isPlaying ? (
          // Pause icon
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          // Play icon
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div
        className={`flex-1 h-1.5 rounded-full cursor-pointer relative ${
          isOwn ? 'bg-white/30' : 'bg-gray-200'
        }`}
        onClick={handleSeek}
        role="slider"
        aria-label="Прогресс воспроизведения"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className={`h-full rounded-full transition-all ${
            isOwn ? 'bg-white' : 'bg-blue-600'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time display */}
      <span
        className={`text-xs flex-shrink-0 min-w-[2.5rem] text-right ${
          isOwn ? 'text-blue-100' : 'text-gray-500'
        }`}
      >
        {formatTime(remaining)}
      </span>
    </div>
  );
}

export default VoicePlayer;
