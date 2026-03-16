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
from ..tasks.video_tasks import process_and_upload_video
from ..utils.photo_naming import generate_photo_filename
from ..core.config import settings

# Максимальный размер файла в байтах (50MB для фото, 50MB для видео)
MAX_PHOTO_SIZE = 50 * 1024 * 1024  # 50MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB (ограничение)
MAX_VIDEO_DURATION_SEC = 30  # 30 секунд (ограничение)

# Limits for media files per product
MAX_PHOTOS_PER_PRODUCT = 5
MAX_VIDEOS_PER_PRODUCT = 1

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
    
    # Check if user is admin to determine if watermark should be added
    from ..models.organization import Organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    add_watermark_flag = current_user.is_admin and org and org.logo_organization
    logo_file_path = None
    
    if add_watermark_flag:
        # Construct the path to the organization logo (handle paths that may or may not start with /uploads/)
        logo_path_value = org.logo_organization.lstrip("/").lstrip("\\")
        
        # If the path already starts with 'uploads', don't add it again
        if not logo_path_value.lower().startswith("uploads"):
            logo_file_path = os.path.join("uploads", logo_path_value)
        else:
            logo_file_path = logo_path_value
        
        print(f"✓ Watermark will be applied (user is admin)")
        print(f"  Logo path from DB: {org.logo_organization}")
        print(f"  Logo relative path: {logo_path_value}")
        print(f"  Logo file path: {logo_file_path}")
        print(f"  Logo exists: {os.path.exists(logo_file_path)}")

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
    temp_dir = os.path.abspath("uploads/temp")
    temp_path = os.path.join(temp_dir, unique_filename)
    
    # Create temp directory if it doesn't exist
    os.makedirs(temp_dir, exist_ok=True)
    
    # Save original file to temp folder
    try:
        with open(temp_path, 'wb') as f:
            f.write(file_content)
        print(f"Saved original photo to temp: {temp_path}")
        print(f"Absolute temp path: {os.path.abspath(temp_path)}")
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
            organization_id,
            "pictures",  # subfolder
            add_watermark_flag,  # add_watermark
            logo_file_path  # logo_path
        )
        
        print(f"Celery task queued: {task.id}")
        
        # Return immediately with task ID - frontend will poll for status
        # This prevents timeout issues with long-running processing
        result = {
            "task_id": task.id,
            "status": "processing",
            "temp_filename": unique_filename,
            "organization_id": organization_id,
            "path": f"/pictures/{organization_id}/{filename.replace(os.path.splitext(filename)[1], '.webp')}",
            "message": "Photo is being processed. Poll /api/upload/photo-status/{task_id} for updates."
        }
        
        print(f"Photo upload queued for processing: {result}")
        print("=== END PHOTO UPLOAD ===")
        return result
        
    except Exception as e:
        print(f"Error queuing photo upload: {str(e)}")
        # Clean up temp file on error
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass
        raise HTTPException(500, f"Ошибка при постановке фото в очередь: {str(e)}")


@router.post("/photo-s3")
async def upload_photo_s3(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for upload_photo - kept for backwards compatibility"""
    return await upload_photo(file=file, organization_id=organization_id, db=db, current_user=current_user)


@router.post("/video")
async def upload_video(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    print(f"=== VIDEO UPLOAD REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    
    # Use user's organization_id if not provided
    if not organization_id:
        organization_id = current_user.organization_id
    
    if not organization_id:
        raise HTTPException(400, "organization_id обязателен")
    
    # Check if user is admin to determine if watermark should be added
    from ..models.organization import Organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    add_watermark_flag = current_user.is_admin and org and org.logo_organization
    logo_file_path = None
    
    if add_watermark_flag:
        # Construct the path to the organization logo (handle paths that may or may not start with /uploads/)
        logo_path_value = org.logo_organization.lstrip("/").lstrip("\\")
        
        # If the path already starts with 'uploads', don't add it again
        if not logo_path_value.lower().startswith("uploads"):
            logo_file_path = os.path.join("uploads", logo_path_value)
        else:
            logo_file_path = logo_path_value
        
        print(f"✓ Watermark will be applied (user is admin)")
        print(f"  Logo path from DB: {org.logo_organization}")
        print(f"  Logo relative path: {logo_path_value}")
        print(f"  Logo file path: {logo_file_path}")
        print(f"  Logo exists: {os.path.exists(logo_file_path)}")

    # Check if file is a video
    if not file.content_type or not file.content_type.startswith("video/"):
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END VIDEO UPLOAD (REJECTED) ===")
        raise HTTPException(400, "Разрешены только видео")

    # Check file size before upload
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > MAX_VIDEO_SIZE:
        raise HTTPException(
            413,
            f"Файл слишком большой. Размер: {file_size/1024/1024:.1f}MB. Максимальный размер: {MAX_VIDEO_SIZE/1024/1024}MB"
        )

    # Return file pointer to the beginning for re-reading
    await file.seek(0)

    # Get file extension
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""

    # Allowed video extensions
    allowed_extensions = (
        ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm", ".m4v", ".3gp", ".mpeg", ".mpg"
    )
    
    # Validate extension
    if ext and ext not in allowed_extensions:
        raise HTTPException(400, "Недопустимый формат видео")
    
    # Validate MIME type
    allowed_mime_types = (
        "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-ms-wmv",
        "video/x-flv", "video/x-matroska", "video/webm", "video/3gpp",
        "video/mpeg"
    )
    
    if file.content_type not in allowed_mime_types:
        if not ext:
            raise HTTPException(400, "Недопустимый тип файла")
    
    # Generate filename with organization ID
    filename = generate_photo_filename(organization_id, file.filename)
    
    print(f"Generated filename: {filename}")
    
    # Generate UUID filename for temp storage
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    temp_dir = os.path.abspath("uploads/temp")
    temp_path = os.path.join(temp_dir, unique_filename)
    
    # Create temp directory if it doesn't exist
    os.makedirs(temp_dir, exist_ok=True)
    
    # Save original file to temp folder
    try:
        with open(temp_path, 'wb') as f:
            f.write(file_content)
        print(f"Saved original video to temp: {temp_path}")
        print(f"Absolute temp path: {os.path.abspath(temp_path)}")
    except Exception as e:
        print(f"Error saving temp file: {str(e)}")
        raise HTTPException(500, f"Ошибка при сохранении временного файла: {str(e)}")
    
    print(f"Processing video with Celery. Temp path: {temp_path}, Organization: {organization_id}")
    
    try:
        # Queue Celery task for async processing
        task = process_and_upload_video.delay(
            temp_path,
            filename,  # Use generated filename
            organization_id,
            add_watermark_flag,  # add_watermark
            logo_file_path  # logo_path
        )
        
        print(f"Celery task queued: {task.id}")
        
        # Return immediately with task ID - frontend will poll for status
        # This prevents timeout issues with long-running video processing
        result = {
            "task_id": task.id,
            "status": "processing",
            "temp_filename": unique_filename,
            "organization_id": organization_id,
            "path": f"/videos/{organization_id}/{filename.replace(os.path.splitext(filename)[1], '.mp4')}",
            "message": "Video is being processed. Poll /api/upload/photo-status/{task_id} for updates."
        }
        
        print(f"Video upload queued for processing: {result}")
        print("=== END VIDEO UPLOAD ===")
        return result
        
    except Exception as e:
        print(f"Error queuing video upload: {str(e)}")
        # Clean up temp file on error
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass
        raise HTTPException(500, f"Ошибка при постановке видео в очередь: {str(e)}")


@router.post("/video-s3")
async def upload_video_s3(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for upload_video - kept for backwards compatibility"""
    return await upload_video(file=file, organization_id=organization_id, db=db, current_user=current_user)


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
    
    # Check if user is admin to determine if watermark should be added (only for images)
    from ..models.organization import Organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    add_watermark_flag = current_user.is_admin and org and org.logo_organization
    logo_file_path = None
    
    if add_watermark_flag:
        # Construct the path to the organization logo (handle paths that may or may not start with /uploads/)
        logo_path_value = org.logo_organization.lstrip("/").lstrip("\\")
        
        # If the path already starts with 'uploads', don't add it again
        if not logo_path_value.lower().startswith("uploads"):
            logo_file_path = os.path.join("uploads", logo_path_value)
        else:
            logo_file_path = logo_path_value
        
        print(f"✓ Watermark will be applied (user is admin)")
        print(f"  Logo path from DB: {org.logo_organization}")
        print(f"  Logo relative path: {logo_path_value}")
        print(f"  Logo file path: {logo_file_path}")
        print(f"  Logo exists: {os.path.exists(logo_file_path)}")

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
        # Queue appropriate Celery task based on file type
        if is_image:
            task = process_and_upload_photo.delay(
                temp_path,
                filename,  # Use generated filename
                organization_id,
                "pictures",  # subfolder
                add_watermark_flag,  # add_watermark
                logo_file_path  # logo_path
            )
            # The Celery task will save the file with this naming pattern
            predicted_path = f"/pictures/{organization_id}/{filename.replace(os.path.splitext(filename)[1], '.webp')}"
        elif is_video:
            task = process_and_upload_video.delay(
                temp_path,
                filename,  # Use generated filename
                organization_id,
                add_watermark_flag,  # add_watermark
                logo_file_path  # logo_path
            )
            # The Celery task will save the file with this naming pattern
            predicted_path = f"/videos/{organization_id}/{filename.replace(os.path.splitext(filename)[1], '.mp4')}"
        
        print(f"Celery task queued: {task.id}")
        
        # Return task info and relative path (frontend will construct full URL)
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
async def upload_organization_logo(
    file: UploadFile = File(...),
    organization_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    print(f"=== ORGANIZATION LOGO UPLOAD REQUEST ===")
    print(f"Filename: {file.filename}")
    print(f"Content-Type: {file.content_type}")
    
    # Use user's organization_id if not provided
    if not organization_id:
        organization_id = current_user.organization_id
    
    if not organization_id:
        raise HTTPException(400, "organization_id обязателен")
    
    # Don't add watermark to logo itself
    add_watermark_flag = False
    logo_file_path = None
    
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

    # Delete all existing logos in the organization's folder before uploading new one
    logo_folder = os.path.join("uploads", "logo_organizations", organization_id)
    if os.path.exists(logo_folder):
        try:
            print(f"Cleaning up old logos from: {logo_folder}")
            for filename in os.listdir(logo_folder):
                file_path = os.path.join(logo_folder, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    print(f"✓ Deleted old logo: {file_path}")
        except Exception as e:
            print(f"⚠️ Warning: Could not delete old logos: {e}")
            # Continue with upload even if cleanup fails

    # Generate filename with organization ID and timestamp
    filename = generate_photo_filename(organization_id, file.filename)
    
    print(f"Generated filename: {filename}")
    
    # Generate UUID filename for temp storage
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    temp_dir = os.path.abspath("uploads/temp")
    temp_path = os.path.join(temp_dir, unique_filename)
    
    # Create temp directory if it doesn't exist
    os.makedirs(temp_dir, exist_ok=True)
    
    # Save original file to temp folder
    try:
        with open(temp_path, 'wb') as f:
            f.write(file_content)
        print(f"Saved original logo to temp: {temp_path}")
        print(f"Absolute temp path: {os.path.abspath(temp_path)}")
    except Exception as e:
        print(f"Error saving temp file: {str(e)}")
        raise HTTPException(500, f"Ошибка при сохранении временного файла: {str(e)}")
    
    print(f"Processing logo with Celery. Temp path: {temp_path}, Organization: {organization_id}")
    print(f"Final filename will be: {filename}")
    
    try:
        # Queue Celery task for async processing
        task = process_and_upload_photo.delay(
            temp_path,
            filename,  # Use generated filename with org ID and timestamp
            organization_id,
            "logo_organizations",  # subfolder
            add_watermark_flag,  # add_watermark
            logo_file_path  # logo_path
        )
        
        print(f"Celery task queued: {task.id}")
        
        # Return immediately with task ID - frontend will poll for status
        # This prevents timeout issues with long-running processing
        result = {
            "task_id": task.id,
            "status": "processing",
            "temp_filename": unique_filename,
            "organization_id": organization_id,
            "path": f"/uploads/logo_organizations/{organization_id}/{filename.replace(os.path.splitext(filename)[1], '.webp')}",
            "message": "Logo is being processed. Poll /api/upload/photo-status/{task_id} for updates."
        }
        
        print(f"Logo upload queued for processing: {result}")
        print("=== END ORGANIZATION LOGO UPLOAD ===")
        return result
        
    except Exception as e:
        print(f"Error queuing logo upload: {str(e)}")
        # Clean up temp file on error
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass
        raise HTTPException(500, f"Ошибка при постановке задачи обработки лого: {str(e)}")


@router.get("/photo-status/{task_id}")
async def get_photo_upload_status(task_id: str):
    """
    Get the status of a Celery photo/video processing task.
    Works for both process_and_upload_photo and process_and_upload_video tasks.
    
    Returns:
        dict: Task status and result with full details
    """
    from celery.result import AsyncResult
    
    # Try to get result from photo task first
    task_result = AsyncResult(task_id, app=process_and_upload_photo.app)
    
    if task_result.state == 'PENDING':
        return {
            "task_id": task_id,
            "status": "pending",
            "message": "Task is waiting to be processed by Celery worker"
        }
    elif task_result.state == 'STARTED':
        return {
            "task_id": task_id,
            "status": "processing",
            "message": "Task is being processed by Celery worker"
        }
    elif task_result.state == 'PROGRESS':
        return {
            "task_id": task_id,
            "status": "processing",
            "progress": task_result.info.get('progress', 0) if isinstance(task_result.info, dict) else 0,
            "message": "Task is in progress"
        }
    elif task_result.state == 'SUCCESS':
        result = task_result.result
        print(f"Task {task_id} completed successfully: {result}")
        return {
            "task_id": task_id,
            "status": "completed",
            "result": result,
            "path": result.get('path') if isinstance(result, dict) else None,
            "url": result.get('url') if isinstance(result, dict) else None,
            "filename": result.get('filename') if isinstance(result, dict) else None,
            "organization_id": result.get('organization_id') if isinstance(result, dict) else None,
            "duration": result.get('duration') if isinstance(result, dict) else None  # For videos
        }
    elif task_result.state == 'FAILURE':
        error_msg = str(task_result.result)
        print(f"Task {task_id} failed: {error_msg}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error": error_msg,
            "traceback": str(task_result.traceback) if task_result.traceback else None
        }
    elif task_result.state == 'RETRY':
        return {
            "task_id": task_id,
            "status": "retrying",
            "message": "Task is being retried due to temporary error"
        }
    elif task_result.state == 'REVOKED':
        return {
            "task_id": task_id,
            "status": "cancelled",
            "message": "Task was cancelled"
        }
    else:
        return {
            "task_id": task_id,
            "status": task_result.state.lower(),
            "message": f"Task is in {task_result.state} state"
        }


@router.delete("/temp/{filename}")
async def delete_temp_file(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a temporary file by filename.
    Used to cleanup uploaded media when user cancels form submission.
    """
    print(f"=== DELETE TEMP FILE REQUEST ===")
    print(f"Filename: {filename}")
    
    # Validate filename to prevent directory traversal attacks
    if not filename or '..' in filename or '/' in filename or '\\' in filename:
        raise HTTPException(400, "Недопустимое имя файла")
    
    temp_dir = os.path.abspath("uploads/temp")
    temp_path = os.path.join(temp_dir, filename)
    
    # Check if file exists
    if not os.path.exists(temp_path):
        print(f"File not found: {temp_path}")
        return {"success": True, "message": "File not found or already deleted"}
    
    try:
        os.remove(temp_path)
        print(f"Successfully deleted temp file: {temp_path}")
        return {"success": True, "message": "File deleted successfully"}
    except Exception as e:
        print(f"Error deleting temp file: {str(e)}")
        raise HTTPException(500, f"Ошибка при удалении временного файла: {str(e)}")