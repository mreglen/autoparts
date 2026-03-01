# app/routers/upload.py
import os
import uuid
import subprocess
import tempfile
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, HTTPException, Response
from fastapi.responses import FileResponse

# Максимальный размер файла в байтах (50MB для фото, 70MB для видео)
MAX_PHOTO_SIZE = 50 * 1024 * 1024  # 50MB
MAX_VIDEO_SIZE = 70 * 1024 * 1024  # 70MB

UPLOAD_DIR = "uploads"
ORG_LOGO_DIR = "uploads/logo_organizations"
VIDEO_DIR = "uploads/videos"

os.makedirs(ORG_LOGO_DIR, exist_ok=True)
os.makedirs(VIDEO_DIR, exist_ok=True)

os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.options("/photo")
async def options_upload_photo():
    """Handle OPTIONS request for photo upload"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        }
    )

@router.post("/photo")
async def upload_photo(file: UploadFile = File(...)):
    print(f"=== PHOTO UPLOAD REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    print(f"Headers: {dict(file.headers) if hasattr(file, 'headers') else 'No headers'}")

    if not file.content_type or not file.content_type.startswith("image/"):
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END PHOTO UPLOAD (REJECTED) ===")
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

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    print(f"Saving file to: {filepath}")
    print(f"Upload dir exists: {os.path.exists(UPLOAD_DIR)}")

    # Создаем директорию, если не существует
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Сохраняем файл (используем уже прочитанный контент)
    with open(filepath, "wb") as f:
        f.write(file_content)
        print(f"File saved successfully, size: {file_size} bytes")

    # Возвращаем относительный URL
    result = {"url": f"/uploads/{filename}"}
    print(f"Upload successful: {result}")
    print("=== END PHOTO UPLOAD ===")
    return result


# Unified upload handler that supports both images and videos
@router.options("/media")
async def options_upload_media():
    """Handle OPTIONS request for media upload"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.post("/media")
async def upload_media(file: UploadFile = File(...)):
    print(f"=== MEDIA UPLOAD REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    print(f"Headers: {dict(file.headers) if hasattr(file, 'headers') else 'No headers'}")

    # Check if file is an image or video
    is_image = file.content_type and file.content_type.startswith("image/")
    is_video = file.content_type and file.content_type.startswith("video/")
    
    if not is_image and not is_video:
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END MEDIA UPLOAD (REJECTED) ===")
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
        
        # Save to main uploads directory
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        result_url = f"/uploads/{filename}"
        
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
        
        # Save to video uploads directory
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(VIDEO_DIR, filename)
        result_url = f"/uploads/videos/{filename}"
    
    print(f"Saving media to: {filepath}")
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # Compress video if it's a video file
    if is_video:
        try:
            # Use FFmpeg to compress the video
            compressed_filepath = filepath + "_temp"
            # Command to compress video: reduce bitrate to 1Mbps, scale to 720p max
            cmd = [
                "ffmpeg",
                "-i", filepath,  # input file
                "-b:v", "1M",   # video bitrate
                "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",  # scale down to max 720p
                "-c:a", "aac",  # audio codec
                "-b:a", "128k", # audio bitrate
                "-y",  # overwrite output file
                compressed_filepath  # output file
            ]
            
            # Run FFmpeg command
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # Replace original file with compressed version
            os.replace(compressed_filepath, filepath)
            
            # Update file size after compression
            file_size = os.path.getsize(filepath)
            print(f"Video compressed successfully, new size: {file_size} bytes")
        except subprocess.CalledProcessError:
            print("FFmpeg compression failed, keeping original file")
            # If compression fails, save original file
            with open(filepath, "wb") as f:
                f.write(file_content)
        except FileNotFoundError:
            print("FFmpeg not found, keeping original file")
            # If FFmpeg is not installed, save original file
            with open(filepath, "wb") as f:
                f.write(file_content)
    else:
        # For images, save the file directly
        with open(filepath, "wb") as f:
            f.write(file_content)
            print(f"Image saved successfully, size: {file_size} bytes")

    # Return relative URL
    result = {"url": result_url}
    print(f"Media upload successful: {result}")
    print("=== END MEDIA UPLOAD ===")
    return result


@router.post("/organization-logo")
async def upload_organization_logo(file: UploadFile = File(...)):
    print(f"=== ORGANIZATION LOGO UPLOAD REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    print(f"Headers: {dict(file.headers) if hasattr(file, 'headers') else 'No headers'}")

    if not file.content_type or not file.content_type.startswith("image/"):
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END ORGANIZATION LOGO UPLOAD (REJECTED) ===")
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

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(ORG_LOGO_DIR, filename)

    print(f"Saving organization logo to: {filepath}")
    print(f"Upload dir exists: {os.path.exists(ORG_LOGO_DIR)}")

    # Создаем директорию, если не существует
    os.makedirs(ORG_LOGO_DIR, exist_ok=True)

    # Сохраняем файл (используем уже прочитанный контент)
    with open(filepath, "wb") as f:
        f.write(file_content)
        print(f"Organization logo saved successfully, size: {file_size} bytes")

    # Возвращаем относительный URL
    result = {"url": f"/uploads/logo_organizations/{filename}"}
    print(f"Organization logo upload successful: {result}")
    print("=== END ORGANIZATION LOGO UPLOAD ===")
    return result


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(404, "Файл не найден")
    return FileResponse(filepath)


@router.get("/uploads/logo_organizations/{filename}")
async def get_organization_logo(filename: str):
    filepath = os.path.join(ORG_LOGO_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(404, "Файл не найден")
    return FileResponse(filepath)


@router.get("/uploads/videos/{filename}")
async def get_uploaded_video(filename: str):
    filepath = os.path.join(VIDEO_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(404, "Видео не найдено")
    return FileResponse(filepath)