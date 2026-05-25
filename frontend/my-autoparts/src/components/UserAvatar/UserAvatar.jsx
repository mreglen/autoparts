import React, { useState } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

function getInitials(firstName, lastName) {
    const l = lastName?.[0] || '';
    const f = firstName?.[0] || '';
    return (l + f).toUpperCase() || '?';
}

const SIZE_CLASSES = {
    sm: 'h-8 w-8 text-xs rounded-lg',
    md: 'h-10 w-10 text-sm rounded-xl',
    lg: 'h-14 w-14 text-base rounded-xl',
    xl: 'h-20 w-20 text-2xl rounded-2xl',
};

export default function UserAvatar({
    avatarUrl,
    firstName,
    lastName,
    size = 'md',
    className = '',
    ringClassName = '',
}) {
    const [imgError, setImgError] = useState(false);
    const src = avatarUrl && !imgError ? normalizeImageUrl(avatarUrl) : null;
    const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

    if (src) {
        return (
            <img
                src={src}
                alt=""
                className={`shrink-0 object-cover bg-gray-100 ${sizeClass} ${className}`}
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <div
            className={`flex shrink-0 items-center justify-center bg-indigo-600 font-bold text-white ${sizeClass} ${ringClassName} ${className}`}
            aria-hidden
        >
            {getInitials(firstName, lastName)}
        </div>
    );
}
