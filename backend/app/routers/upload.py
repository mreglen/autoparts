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
from celery.result import AsyncResult

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
    
    # Check organization's watermark setting to determine if watermark should be added
    from ..models.organization import Organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    
    # Determine watermark settings based on organization.watermark value:
    # 0 = no watermark
    # 1 = admin's organization logo (current behavior for backward compatibility)
    # 2 = this organization's own logo
    add_watermark_flag = False
    logo_file_path = None
    
    if org and org.watermark is not None:
        if org.watermark == 1:
            # Use admin's organization logo as watermark
            # Find admin user and get their organization logo
            admin_user = db.query(User).filter(User.is_admin == True).first()
            if admin_user and admin_user.organization_id:
                admin_org = db.query(Organization).filter(Organization.id == admin_user.organization_id).first()
                if admin_org and admin_org.logo_organization:
                    add_watermark_flag = True
                    logo_path_value = admin_org.logo_organization.lstrip("/").lstrip("\\")
                    if not logo_path_value.lower().startswith("uploads"):
                        logo_file_path = os.path.join("uploads", logo_path_value)
                    else:
                        logo_file_path = logo_path_value
                    print(f"✓ Watermark will be applied (admin's org logo)")
                    print(f"  Admin org logo path: {logo_file_path}")
                    print(f"  Logo exists: {os.path.exists(logo_file_path)}")
        elif org.watermark == 2:
            # Use this organization's own logo
            if org.logo_organization:
                add_watermark_flag = True
                logo_path_value = org.logo_organization.lstrip("/").lstrip("\\")
                if not logo_path_value.lower().startswith("uploads"):
                    logo_file_path = os.path.join("uploads", logo_path_value)
                else:
                    logo_file_path = logo_path_value
                print(f"✓ Watermark will be applied (this org's logo)")
                print(f"  Org logo path: {logo_file_path}")
                print(f"  Logo exists: {os.path.exists(logo_file_path)}")
        else:
            # watermark == 0: No watermark
            print(f"ℹ️ No watermark will be applied (watermark=0)")

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
    
    # Check organization's watermark setting to determine if watermark should be added
    from ..models.organization import Organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    
    # Determine watermark settings based on organization.watermark value:
    # 0 = no watermark
    # 1 = admin's organization logo
    # 2 = this organization's own logo
    add_watermark_flag = False
    logo_file_path = None
    
    if org and org.watermark is not None:
        if org.watermark == 1:
            # Use admin's organization logo as watermark
            admin_user = db.query(User).filter(User.is_admin == True).first()
            if admin_user and admin_user.organization_id:
                admin_org = db.query(Organization).filter(Organization.id == admin_user.organization_id).first()
                if admin_org and admin_org.logo_organization:
                    add_watermark_flag = True
                    logo_path_value = admin_org.logo_organization.lstrip("/").lstrip("\\")
                    if not logo_path_value.lower().startswith("uploads"):
                        logo_file_path = os.path.join("uploads", logo_path_value)
                    else:
                        logo_file_path = logo_path_value
                    print(f"✓ Watermark will be applied (admin's org logo)")
                    print(f"  Admin org logo path: {logo_file_path}")
                    print(f"  Logo exists: {os.path.exists(logo_file_path)}")
        elif org.watermark == 2:
            # Use this organization's own logo
            if org.logo_organization:
                add_watermark_flag = True
                logo_path_value = org.logo_organization.lstrip("/").lstrip("\\")
                if not logo_path_value.lower().startswith("uploads"):
                    logo_file_path = os.path.join("uploads", logo_path_value)
                else:
                    logo_file_path = logo_path_value
                print(f"✓ Watermark will be applied (this org's logo)")
                print(f"  Org logo path: {logo_file_path}")
                print(f"  Logo exists: {os.path.exists(logo_file_path)}")
        else:
            # watermark == 0: No watermark
            print(f"ℹ️ No watermark will be applied (watermark=0)")

    # Check if file is a video
    if not file.content_type or not file.content_type.startswith("video/"):
        print(f"Rejected: invalid content type {file.content_type}")
        print("=== END VIDEO UPLOAD (REJECTED) ===")
        raise HTTPException(400, "Разрешены только видео")
        
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
    # ИСПОЛЬЗУЕМ POSIX-совместимые пути (критично для Linux!)
    temp_dir = os.path.abspath(os.path.join("uploads", "temp", organization_id))
    temp_path = os.path.join(temp_dir, unique_filename)
        
    # Create temp directory if it doesn't exist
    os.makedirs(temp_dir, exist_ok=True)
        
    # 🚀 БЫСТРАЯ ЗАГРУЗКА: Потоковая запись напрямую на диск!
    # НЕ читаем файл в память, а сразу пишем на диск
    try:
        # Открываем файл для записи
        with open(temp_path, 'wb') as buffer:
            # Читаем и пишем порциями по 8KB
            while chunk := await file.read(8192):
                buffer.write(chunk)
            
        # Проверяем размер загруженного файла
        file_size = os.path.getsize(temp_path)
            
        # Проверяем размер после загрузки (а не до!)
        if file_size > MAX_VIDEO_SIZE:
            # Файл слишком большой - удаляем
            os.remove(temp_path)
            raise HTTPException(
                413,
                f"Файл слишком большой. Размер: {file_size/1024/1024:.1f}MB. Максимальный размер: {MAX_VIDEO_SIZE/1024/1024}MB"
            )
            
        print(f"✅ Saved original video to temp: {temp_path}")
        print(f"📊 File size: {file_size/1024/1024:.2f} MB")
        print(f"📍 Absolute path: {os.path.abspath(temp_path)}")
            
        # Construct temp video URL that can be used immediately
        temp_video_path = f"/temp/{organization_id}/{unique_filename}"
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error saving temp file: {str(e)}")
        # Удаляем частичный файл если он создался
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass
        raise HTTPException(500, f"Ошибка при сохранении временного файла: {str(e)}")
    
    print(f"Processing video with Celery. Temp path: {temp_path}, Organization: {organization_id}")
    
    # ВАЖНО: НЕ запускаем Celery task сразу!
    # Просто сохраняем информацию о загруженном файле
    # Celery task будет запущен позже, при создании/обновлении запчасти
    
    try:
        # Возвращаем temp_path и другие данные для фронтенда
        # Фронтенд сохранит это и использует для превью
        result = {
            "temp_path": temp_video_path,  # Immediate temp path for playback
            "path": temp_video_path,  # ← Важно! Возвращаем path для совместимости с фронтендом
            "temp_filename": unique_filename,
            "filename": unique_filename,  # ← Важно! Для совместимости
            "organization_id": organization_id,
            "message": "Video uploaded to temp folder. Processing will start when product is created/updated.",
            "is_temp": True  # Флаг что это временный файл
        }
        
        print(f"Video saved to temp: {result}")
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
    
    # Check organization's watermark setting to determine if watermark should be added (only for images)
    from ..models.organization import Organization
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    
    # Determine watermark settings based on organization.watermark value:
    # 0 = no watermark
    # 1 = admin's organization logo
    # 2 = this organization's own logo
    add_watermark_flag = False
    logo_file_path = None
    
    if org and org.watermark is not None:
        if org.watermark == 1:
            # Use admin's organization logo as watermark
            admin_user = db.query(User).filter(User.is_admin == True).first()
            if admin_user and admin_user.organization_id:
                admin_org = db.query(Organization).filter(Organization.id == admin_user.organization_id).first()
                if admin_org and admin_org.logo_organization:
                    add_watermark_flag = True
                    logo_path_value = admin_org.logo_organization.lstrip("/").lstrip("\\")
                    if not logo_path_value.lower().startswith("uploads"):
                        logo_file_path = os.path.join("uploads", logo_path_value)
                    else:
                        logo_file_path = logo_path_value
                    print(f"✓ Watermark will be applied (admin's org logo)")
                    print(f"  Admin org logo path: {logo_file_path}")
                    print(f"  Logo exists: {os.path.exists(logo_file_path)}")
        elif org.watermark == 2:
            # Use this organization's own logo
            if org.logo_organization:
                add_watermark_flag = True
                logo_path_value = org.logo_organization.lstrip("/").lstrip("\\")
                if not logo_path_value.lower().startswith("uploads"):
                    logo_file_path = os.path.join("uploads", logo_path_value)
                else:
                    logo_file_path = logo_path_value
                print(f"✓ Watermark will be applied (this org's logo)")
                print(f"  Org logo path: {logo_file_path}")
                print(f"  Logo exists: {os.path.exists(logo_file_path)}")
        else:
            # watermark == 0: No watermark
            print(f"ℹ️ No watermark will be applied (watermark=0)")

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


@router.post("/cancel/{task_id}")
async def cancel_video_upload(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a running video upload task.
    Stops Celery task and cleans up temporary files.
    """
    print(f"=== CANCEL VIDEO UPLOAD REQUEST ===")
    print(f"Task ID: {task_id}")
    
    try:
        # Get task result
        task_result = AsyncResult(task_id, app=process_and_upload_video.app)
        
        # Check task state
        if task_result.state == 'PENDING' or task_result.state == 'STARTED':
            # Try to revoke the task
            from app.celery_app import celery_app
            celery_app.control.revoke(task_id, terminate=True)
            print(f"✅ Task {task_id} revoked successfully")
            
            # Try to cleanup temp file from task result
            try:
                result_data = task_result.result
                if result_data and isinstance(result_data, dict):
                    temp_filename = result_data.get('temp_filename')
                    organization_id = result_data.get('organization_id')
                    if temp_filename and organization_id:
                        temp_dir = os.path.abspath(os.path.join("uploads", "temp", organization_id))
                        temp_path = os.path.join(temp_dir, temp_filename)
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                            print(f"✅ Cleaned up temp file: {temp_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Warning: Could not cleanup temp file: {cleanup_error}")
            
            return {
                "success": True,
                "message": "Загрузка видео отменена",
                "task_id": task_id,
                "state": "CANCELLED"
            }
        elif task_result.state == 'SUCCESS':
            # Task already completed - cleanup the uploaded file
            print(f"⚠️ Task {task_id} already completed, cleaning up uploaded file")
            try:
                result_data = task_result.result
                if result_data and isinstance(result_data, dict):
                    # Delete the uploaded video file
                    path = result_data.get('path')
                    if path:
                        # Convert relative path to absolute
                        base_dir = os.path.abspath("uploads")
                        absolute_path = os.path.join(base_dir, path.lstrip('/'))
                        if os.path.exists(absolute_path):
                            os.remove(absolute_path)
                            print(f"✅ Cleaned up uploaded file: {absolute_path}")
            except Exception as cleanup_error:
                print(f"⚠️ Warning: Could not cleanup uploaded file: {cleanup_error}")
            
            return {
                "success": True,
                "message": "Видео уже загружено, файл удалён",
                "task_id": task_id,
                "state": "CLEANED_UP"
            }
        else:
            # Task in other state (FAILURE, RETRY, etc.)
            print(f"⚠️ Task {task_id} in state {task_result.state}, nothing to cancel")
            return {
                "success": True,
                "message": f"Задача в состоянии {task_result.state}, отмена не требуется",
                "task_id": task_id,
                "state": task_result.state
            }
            
    except Exception as e:
        print(f"❌ Error cancelling task: {str(e)}")
        # Still return success to allow frontend to proceed
        return {
            "success": True,
            "message": "Ошибка при отмене задачи, но загрузка может быть остановлена",
            "task_id": task_id,
            "error": str(e)
        }


@router.get("/video-status/{task_id}")
async def get_video_status(
    task_id: str,
    product_video_id: int = None,  # Optional: DB record ID to update
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get video processing status and optionally update database with final path.
    Returns current status and paths (temp and final).
    If processing is complete and product_video_id is provided, updates the database.
    """
    print(f"=== VIDEO STATUS CHECK REQUEST ===")
    print(f"Task ID: {task_id}")
    print(f"Product Video ID: {product_video_id}")
    
    try:
        # Get task result
        task_result = AsyncResult(task_id, app=process_and_upload_video.app)
        
        response = {
            "task_id": task_id,
            "state": task_result.state,
            "status": "processing" if task_result.state in ['PENDING', 'STARTED', 'RETRY'] else task_result.state.lower()
        }
        
        # If task is complete, get the result data
        if task_result.state == 'SUCCESS':
            result_data = task_result.result
            if result_data and isinstance(result_data, dict):
                response["temp_path"] = result_data.get('temp_path')
                response["final_path"] = result_data.get('path')
                response["url"] = result_data.get('url')
                response["filename"] = result_data.get('filename')
                response["duration"] = result_data.get('duration')
                response["processing_complete"] = result_data.get('processing_complete', True)
                
                # If product_video_id is provided, update the database
                if product_video_id and response.get('processing_complete'):
                    from ..models.product import ProductVideo
                    video_record = db.query(ProductVideo).filter(
                        ProductVideo.id == product_video_id
                    ).first()
                    
                    if video_record:
                        # Update video URL from temp to final path
                        old_url = video_record.video_url
                        video_record.video_url = response['final_path']
                        video_record.processing_status = 'completed'
                        db.commit()
                        
                        print(f"✅ Updated video {product_video_id} from {old_url} to {response['final_path']}")
                        response["database_updated"] = True
                    else:
                        print(f"⚠️ Video record {product_video_id} not found")
                        response["database_updated"] = False
                else:
                    response["database_updated"] = False
                    
        elif task_result.state in ['PENDING', 'STARTED', 'RETRY']:
            # Still processing - temp file should be available
            # Try to get temp path from task info if available
            response["status"] = "processing"
            response["message"] = "Video is being processed. Temp file available for playback."
            
        elif task_result.state == 'FAILURE':
            response["status"] = "failed"
            if task_result.info and isinstance(task_result.info, dict):
                response["error"] = task_result.info.get('error', 'Unknown error')
                response["temp_path"] = task_result.info.get('temp_path')
        
        print(f"Video status: {response}")
        print("=== END VIDEO STATUS CHECK ===")
        return response
        
    except Exception as e:
        print(f"❌ Error checking video status: {str(e)}")
        return {
            "task_id": task_id,
            "state": "FAILURE",
            "status": "failed",
            "error": str(e)
        }


@router.post("/start-video-processing/{product_video_id}")
async def start_video_processing(
    product_video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Start video processing AFTER product creation/update.
    This endpoint triggers the Celery task for background processing.
    """
    print(f"=== START VIDEO PROCESSING REQUEST ===")
    print(f"Product Video ID: {product_video_id}")
    
    try:
        # Get video record from database
        from ..models.product import ProductVideo
        video_record = db.query(ProductVideo).filter(
            ProductVideo.id == product_video_id,
            ProductVideo.organization_id == current_user.organization_id
        ).first()
        
        if not video_record:
            raise HTTPException(404, f"Video record {product_video_id} not found")
        
        # Extract temp filename from video_url
        # video_url format: /temp/{org_id}/{filename}.mp4
        temp_video_path = video_record.video_url
        if not temp_video_path.startswith('/temp/'):
            raise HTTPException(400, f"Invalid temp video path: {temp_video_path}")
        
        # Parse the path to get organization_id and filename
        parts = temp_video_path.strip('/').split('/')
        if len(parts) != 3 or parts[0] != 'temp':
            raise HTTPException(400, f"Cannot parse temp path: {temp_video_path}")
        
        organization_id = parts[1]
        temp_filename = parts[2]
        
        # Build absolute path to temp file
        temp_dir = os.path.abspath(os.path.join("uploads", "temp", organization_id))
        temp_file_path = os.path.join(temp_dir, temp_filename)
        
        print(f"Temp file path: {temp_file_path}")
        print(f"Organization ID: {organization_id}")
        
        # Check if temp file exists
        if not os.path.exists(temp_file_path):
            raise HTTPException(404, f"Temp video file not found at: {temp_file_path}")
        
        # Get watermark settings
        from ..models.organization import Organization
        org = db.query(Organization).filter(Organization.id == organization_id).first()
        
        add_watermark_flag = False
        logo_file_path = None
        
        if org and org.watermark is not None:
            if org.watermark == 1:
                admin_user = db.query(User).filter(User.is_admin == True).first()
                if admin_user and admin_user.organization_id:
                    admin_org = db.query(Organization).filter(Organization.id == admin_user.organization_id).first()
                    if admin_org and admin_org.logo_organization:
                        add_watermark_flag = True
                        logo_path_value = admin_org.logo_organization.lstrip("/").lstrip("\\")
                        if not logo_path_value.lower().startswith("uploads"):
                            logo_file_path = os.path.join("uploads", logo_path_value)
                        else:
                            logo_file_path = logo_path_value
            elif org.watermark == 2:
                if org.logo_organization:
                    add_watermark_flag = True
                    logo_path_value = org.logo_organization.lstrip("/").lstrip("\\")
                    if not logo_path_value.lower().startswith("uploads"):
                        logo_file_path = os.path.join("uploads", logo_path_value)
                    else:
                        logo_file_path = logo_path_value
        
        # Generate final filename
        from ..utils.photo_naming import generate_photo_filename
        final_filename = generate_photo_filename(organization_id, temp_filename)
        
        # Queue Celery task for async processing
        task = process_and_upload_video.delay(
            temp_file_path,
            final_filename,
            organization_id,
            add_watermark_flag,
            logo_file_path
        )
        
        print(f"✅ Celery task queued: {task.id}")
        
        # Update processing status in database
        video_record.processing_status = 'processing'
        db.commit()
        
        return {
            "success": True,
            "task_id": task.id,
            "product_video_id": product_video_id,
            "status": "processing",
            "message": "Video processing started. Poll /api/upload/video-status/{task_id}?product_video_id={product_video_id} for updates."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error starting video processing: {str(e)}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(500, f"Ошибка при запуске обработки видео: {str(e)}")