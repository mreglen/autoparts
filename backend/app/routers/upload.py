# app/routers/upload.py
import os
import uuid
import base64
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..core.auth import get_current_user
from ..models.user import User
from ..tasks.photo_tasks import process_and_upload_photo
from ..utils.photo_naming import generate_photo_filename
from ..core.config import settings

# Максимальный размер файла в байтах (50MB для фото, 70MB для видео)
MAX_PHOTO_SIZE = 50 * 1024 * 1024  # 50MB
MAX_VIDEO_SIZE = 70 * 1024 * 1024  # 70MB

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("/photo")
async def upload_photo(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    print(f"=== PHOTO UPLOAD REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    
    # Use user's organization_id if not provided
    if not organization_id:
        organization_id = current_user.organization_id
    
    if not organization_id:
        raise HTTPException(400, "organization_id обязателен")

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

    # Generate filename with organization ID and timestamp
    filename = generate_photo_filename(organization_id, file.filename)
    
    print(f"Generated filename: {filename}")
    
    # Generate UUID filename for temp storage
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    temp_dir = "uploads/temp"
    temp_path = os.path.join(temp_dir, unique_filename)
    
    # Create temp directory if it doesn't exist
    os.makedirs(temp_dir, exist_ok=True)
    
    # Save original file to temp folder
    try:
        with open(temp_path, 'wb') as f:
            f.write(file_content)
        print(f"Saved original photo to temp: {temp_path}")
    except Exception as e:
        print(f"Error saving temp file: {str(e)}")
        raise HTTPException(500, f"Ошибка при сохранении временного файла: {str(e)}")
    
    print(f"Processing photo with Celery. Temp path: {temp_path}, Organization: {organization_id}")
    print(f"Final filename will be: {filename}")
    
    try:
        # Queue Celery task for async processing
        task = process_and_upload_photo.delay(
            temp_path,
            filename,  # Use generated filename with org ID and timestamp
            organization_id
        )
        
        print(f"Celery task queued: {task.id}")
        
        # Return task info and predicted path (frontend will construct full URL)
        # The Celery task will save the file with this naming pattern
        predicted_path = f"/pictures/{organization_id}/{filename.replace(os.path.splitext(filename)[1], '.webp')}"
        result = {
            "task_id": task.id,
            "status": "processing",
            "temp_filename": unique_filename,
            "organization_id": organization_id,
            "path": predicted_path
        }
        
        print(f"Predicted path: {predicted_path}")
        print(f"Upload queued for processing: {result}")
        print("=== END PHOTO UPLOAD ===")
        return result
        
    except Exception as e:
        print(f"Error queuing upload task: {str(e)}")
        raise HTTPException(500, f"Ошибка при постановке задачи в очередь: {str(e)}")


@router.post("/photo-s3")
async def upload_photo_s3(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for upload_photo - kept for backwards compatibility"""
    return await upload_photo(file=file, organization_id=organization_id, db=db, current_user=current_user)


@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    print(f"=== MEDIA UPLOAD REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    
    # Use user's organization_id if not provided
    if not organization_id:
        organization_id = current_user.organization_id
    
    if not organization_id:
        raise HTTPException(400, "organization_id обязателен")

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
        
        # Prepare filename with organization ID
        filename = generate_photo_filename(organization_id, file.filename)
        
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
        
        # Prepare filename with organization ID
        filename = generate_photo_filename(organization_id, file.filename)

    print(f"Processing media with Celery. Filename: {filename}, Organization: {organization_id}")
    
    # Generate UUID filename for temp storage
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    temp_dir = "uploads/temp"
    temp_path = os.path.join(temp_dir, unique_filename)
    
    # Create temp directory if it doesn't exist
    os.makedirs(temp_dir, exist_ok=True)
    
    # Save original file to temp folder
    try:
        with open(temp_path, 'wb') as f:
            f.write(file_content)
        print(f"Saved original media to temp: {temp_path}")
    except Exception as e:
        print(f"Error saving temp file: {str(e)}")
        raise HTTPException(500, f"Ошибка при сохранении временного файла: {str(e)}")
    
    try:
        # Queue Celery task for async processing
        task = process_and_upload_photo.delay(
            temp_path,
            filename,  # Use generated filename
            organization_id
        )
        
        print(f"Celery task queued: {task.id}")
        
        # Return task info and relative path (frontend will construct full URL)
        # The Celery task will save the file with this naming pattern
        predicted_path = f"/pictures/{organization_id}/{filename.replace(os.path.splitext(filename)[1], '.webp')}"
        result = {
            "task_id": task.id,
            "status": "processing",
            "temp_filename": unique_filename,
            "organization_id": organization_id,
            "path": predicted_path
        }
        
        print(f"Predicted path: {predicted_path}")
        print(f"Media upload queued for processing: {result}")
        print("=== END MEDIA UPLOAD ===")
        return result
        
    except Exception as e:
        print(f"Error queuing upload task: {str(e)}")
        raise HTTPException(500, f"Ошибка при постановке задачи в очередь: {str(e)}")


@router.post("/media-s3")
async def upload_media_s3(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for upload_media - kept for backwards compatibility"""
    return await upload_media(file=file, organization_id=organization_id, db=db, current_user=current_user)


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

    filename = f"logos/{uuid.uuid4().hex}{ext}"
    
    # Save to local storage
    upload_path = os.path.join("uploads", filename)
    os.makedirs(os.path.dirname(upload_path), exist_ok=True)
    
    try:
        with open(upload_path, 'wb') as f:
            f.write(file_content)
        print(f"File uploaded successfully: {upload_path}")
        
        # Construct URL using BASE_URL
        file_url = f"{settings.BASE_URL}{upload_path}"
        result = {"url": file_url}
        print(f"Upload successful: {result}")
        print("=== END ORGANIZATION LOGO UPLOAD ===")
        return result
    except Exception as e:
        print(f"Error uploading file: {str(e)}")
        raise HTTPException(500, f"Ошибка при загрузке файла в хранилище: {str(e)}")


@router.get("/photo-status/{task_id}")
async def get_photo_upload_status(task_id: str):
    """
    Get the status of a photo processing task.
    
    Returns:
        dict: Task status and result
    """
    from celery.result import AsyncResult
    
    task_result = AsyncResult(task_id, app=process_and_upload_photo.app)
    
    if task_result.state == 'PENDING':
        return {
            "task_id": task_id,
            "status": "pending",
            "message": "Task is waiting to be processed"
        }
    elif task_result.state == 'STARTED':
        return {
            "task_id": task_id,
            "status": "processing",
            "message": "Task is being processed"
        }
    elif task_result.state == 'SUCCESS':
        result = task_result.result
        return {
            "task_id": task_id,
            "status": "completed",
            "result": result
        }
    elif task_result.state == 'FAILURE':
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(task_result.result)
        }
    else:
        return {
            "task_id": task_id,
            "status": task_result.state.lower()
        }