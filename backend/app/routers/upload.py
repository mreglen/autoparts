# app/routers/upload.py
import os
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException, Response
from fastapi.responses import FileResponse

# Максимальный размер файла в байтах (50MB)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

UPLOAD_DIR = "uploads"

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

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            413,
            f"Файл слишком большой. Размер: {file_size/1024/1024:.1f}MB. Максимальный размер: {MAX_FILE_SIZE/1024/1024}MB"
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


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(404, "Файл не найден")
    return FileResponse(filepath)