import React, { useState, useEffect } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

const PhotoThumbnail = ({ photos = [], videos = [], onImageClick }) => {
  const [objectUrls, setObjectUrls] = useState(new Map());
  
  // Combine photos and videos into a single media array
  const allMedia = React.useMemo(() => {
    const photoItems = (photos || []).map(photo => ({
      type: 'photo',
      item: photo,
      url: typeof photo === 'string' ? photo : (photo.full_url || photo.photo_url || '')
    }));
    
    const videoItems = (videos || []).map(video => ({
      type: 'video',
      item: video,
      url: typeof video === 'string' ? video : (video.full_url || video.video_url || '')
    }));
    
    return [...photoItems, ...videoItems];
  }, [photos, videos]);

  // Создаем и очищаем object URLs для File объектов
  useEffect(() => {
    const newUrls = new Map();

    photos.forEach((item, index) => {
      if (item instanceof File) {
        const url = URL.createObjectURL(item);
        newUrls.set(index, url);
      }
    });

    setObjectUrls(newUrls);

    // Cleanup function
    return () => {
      newUrls.forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [photos]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      objectUrls.forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [objectUrls]);

  if (!allMedia || allMedia.length === 0) {
    return <div className="text-gray-500 italic">Нет медиа</div>;
  }

  const isVideoItem = (media) => media.type === 'video';

  return (
    <div className="flex flex-wrap gap-2">
      {allMedia.map((media, index) => {
       const mediaUrl = normalizeImageUrl(media.url);

       if (isVideoItem(media)) {
         return (
            <div 
              key={index} 
              className="relative group cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                // Pass the original item instead of the wrapped media object
                onImageClick && onImageClick(allMedia.map(m => m.item), index);
              }}
            >
              <video
                src={mediaUrl}
                className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-lg border shadow-sm transition-opacity duration-200 group-hover:opacity-90"
                controls={false}
                muted
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg transition-opacity duration-200 group-hover:bg-opacity-20">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          );
        } else {
          return (
            <img
              key={index}
              src={mediaUrl}
              alt={`Медиа ${index + 1}`}
              className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                // Pass the original item instead of the wrapped media object
                onImageClick && onImageClick(allMedia.map(m => m.item), index);
              }}
              onError={(e) => {
                console.warn(`Failed to load media: ${mediaUrl}`);
                e.target.style.display = 'none';
              }}
              loading="lazy"
            />
          );
        }
      })}
    </div>
  );
};

export default PhotoThumbnail;
