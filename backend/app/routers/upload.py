# app/routers/upload.py
import os
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException, Response
from ..s3 import upload_file as s3_upload_file

# Максимальный размер файла в байтах (50MB для фото, 70MB для видео)
MAX_PHOTO_SIZE = 50 * 1024 * 1024  # 50MB
MAX_VIDEO_SIZE = 70 * 1024 * 1024  # 70MB

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("/photo-s3")
async def upload_photo_to_s3(file: UploadFile = File(...)):
    print(f"=== PHOTO UPLOAD TO S3 REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    print(f"Headers: {dict(file.headers) if hasattr(file, 'headers') else 'No headers'}")

    if not file.content_type or not file.content_type.startswith("image/"):
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END PHOTO UPLOAD TO S3 (REJECTED) ===")
        raise HTTPException(400, "Разрешены только изображения")

    # Проверяем размер файла перед загрузкой
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > MAX_PHOTO_SIZE:
        raise HTTPException(
            413,
            f"Файл слишком большой. Размер: {file_size/1024/1024:.1f}MB. Максимальный размер: {MAX_PHOTO_SIZE/1024/1024}MB"
        )

    # Возвращаем указатель файла в начало для повторного чтения
    await file.seek(0)

    # Получаем расширение файла
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""

    # Список поддерживаемых форматов изображений
    allowed_extensions = (
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".jfif-tbn",
        ".heic", ".heif", ".tiff", ".tif", ".bmp", ".svg", ".ico",
        ".raw", ".cr2", ".nef", ".arw", ".dng", ".orf", ".rw2"
    )

    # Проверяем расширение файла
    if ext and ext not in allowed_extensions:
        raise HTTPException(400, "Недопустимый формат изображения")

    # Дополнительная проверка по MIME типу для распространенных форматов
    allowed_mime_types = (
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
        "image/bmp", "image/tiff", "image/x-icon", "image/heic", "image/heif"
    )

    if file.content_type not in allowed_mime_types:
        # Для неизвестных MIME типов, но с правильным расширением - позволяем
        # (например, некоторые форматы могут иметь специфические MIME типы)
        if not ext:
            raise HTTPException(400, "Недопустимый тип файла")

    filename = f"photos/{uuid.uuid4().hex}{ext}"
    
    print(f"Uploading file to S3 with filename: {filename}")
    
    try:
        # Upload to S3/MinIO
        file_url = s3_upload_file(file_content, filename, file.content_type)
        print(f"File uploaded successfully to S3: {file_url}")
        
        result = {"url": file_url, "provider": "s3"}
        print(f"Upload successful: {result}")
        print("=== END PHOTO UPLOAD TO S3 ===")
        return result
    except Exception as e:
        print(f"Error uploading to S3: {str(e)}")
        raise HTTPException(500, f"Ошибка при загрузке файла в хранилище: {str(e)}")


@router.post("/media-s3")
async def upload_media_to_s3(file: UploadFile = File(...)):
    print(f"=== MEDIA UPLOAD TO S3 REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    print(f"Headers: {dict(file.headers) if hasattr(file, 'headers') else 'No headers'}")

    # Check if file is an image or video
    is_image = file.content_type and file.content_type.startswith("image/")
    is_video = file.content_type and file.content_type.startswith("video/")
    
    if not is_image and not is_video:
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END MEDIA UPLOAD TO S3 (REJECTED) ===")
        raise HTTPException(400, "Разрешены только изображения и видео")

    # Determine max file size based on file type
    max_size = MAX_VIDEO_SIZE if is_video else MAX_PHOTO_SIZE
    max_size_mb = MAX_VIDEO_SIZE/1024/1024 if is_video else MAX_PHOTO_SIZE/1024/1024
    
    # Check file size before upload
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > max_size:
        raise HTTPException(
            413,
            f"Файл слишком большой. Размер: {file_size/1024/1024:.1f}MB. Максимальный размер: {max_size_mb}MB"
        )

    # Return file pointer to the beginning for re-reading
    await file.seek(0)

    # Get file extension
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""

    # Define allowed extensions based on file type
    if is_image:
        allowed_extensions = (
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".jfif-tbn",
            ".heic", ".heif", ".tiff", ".tif", ".bmp", ".svg", ".ico",
            ".raw", ".cr2", ".nef", ".arw", ".dng", ".orf", ".rw2"
        )
        allowed_mime_types = (
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
            "image/bmp", "image/tiff", "image/x-icon", "image/heic", "image/heif"
        )
        # Validate extension
        if ext and ext not in allowed_extensions:
            raise HTTPException(400, "Недопустимый формат изображения")
        
        # Validate MIME type
        if file.content_type not in allowed_mime_types:
            if not ext:
                raise HTTPException(400, "Недопустимый тип файла")
        
        # Prepare filename for S3
        filename = f"photos/{uuid.uuid4().hex}{ext}"
        
    elif is_video:
        allowed_extensions = (
            ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm", ".m4v", ".3gp", ".mpeg", ".mpg"
        )
        allowed_mime_types = (
            "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-ms-wmv",
            "video/x-flv", "video/x-matroska", "video/webm", "video/3gpp",
            "video/mpeg"
        )
        # Validate extension
        if ext and ext not in allowed_extensions:
            raise HTTPException(400, "Недопустимый формат видео")
        
        # Validate MIME type
        if file.content_type not in allowed_mime_types:
            if not ext:
                raise HTTPException(400, "Недопустимый тип файла")
        
        # Prepare filename for S3
        filename = f"videos/{uuid.uuid4().hex}{ext}"

    print(f"Uploading media to S3 with filename: {filename}")
    
    try:
        # Upload to S3/MinIO
        file_url = s3_upload_file(file_content, filename, file.content_type)
        print(f"File uploaded successfully to S3: {file_url}")
        
        result = {"url": file_url, "provider": "s3"}
        print(f"Upload successful: {result}")
        print("=== END MEDIA UPLOAD TO S3 ===")
        return result
    except Exception as e:
        print(f"Error uploading to S3: {str(e)}")
        raise HTTPException(500, f"Ошибка при загрузке файла в хранилище: {str(e)}")


@router.post("/organization-logo-s3")
async def upload_organization_logo_to_s3(file: UploadFile = File(...)):
    print(f"=== ORGANIZATION LOGO UPLOAD TO S3 REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    print(f"Headers: {dict(file.headers) if hasattr(file, 'headers') else 'No headers'}")

    if not file.content_type or not file.content_type.startswith("image/"):
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END ORGANIZATION LOGO UPLOAD TO S3 (REJECTED) ===")
        raise HTTPException(400, "Разрешены только изображения")

    # Проверяем размер файла перед загрузкой
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > MAX_PHOTO_SIZE:
        raise HTTPException(
            413,
            f"Файл слишком большой. Размер: {file_size/1024/1024:.1f}MB. Максимальный размер: {MAX_PHOTO_SIZE/1024/1024}MB"
        )

    # Возвращаем указатель файла в начало для повторного чтения
    await file.seek(0)

    # Получаем расширение файла
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""

    # Список поддерживаемых форматов изображений
    allowed_extensions = (
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".jfif-tbn",
        ".heic", ".heif", ".tiff", ".tif", ".bmp", ".svg", ".ico",
        ".raw", ".cr2", ".nef", ".arw", ".dng", ".orf", ".rw2"
    )

    # Проверяем расширение файла
    if ext and ext not in allowed_extensions:
        raise HTTPException(400, "Недопустимый формат изображения")

    # Дополнительная проверка по MIME типу для распространенных форматов
    allowed_mime_types = (
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
        "image/bmp", "image/tiff", "image/x-icon", "image/heic", "image/heif"
    )

    if file.content_type not in allowed_mime_types:
        # Для неизвестных MIME типов, но с правильным расширением - позволяем
        # (например, некоторые форматы могут иметь специфические MIME типы)
        if not ext:
            raise HTTPException(400, "Недопустимый тип файла")

    filename = f"logos/{uuid.uuid4().hex}{ext}"
    
    print(f"Uploading organization logo to S3 with filename: {filename}")
    
    try:
        # Upload to S3/MinIO
        file_url = s3_upload_file(file_content, filename, file.content_type)
        print(f"File uploaded successfully to S3: {file_url}")
        
        result = {"url": file_url, "provider": "s3"}
        print(f"Upload successful: {result}")
        print("=== END ORGANIZATION LOGO UPLOAD TO S3 ===")
        return result
    except Exception as e:
        print(f"Error uploading to S3: {str(e)}")
        raise HTTPException(500, f"Ошибка при загрузке файла в хранилище: {str(e)}")