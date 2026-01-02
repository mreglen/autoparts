# app/routers/upload.py
import os
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/upload", tags=["Upload"])

@router.post("/photo")
async def upload_photo(file: UploadFile = File(...)):
    print(f"Upload attempt: filename={file.filename}, content_type={file.content_type}")

    if not file.content_type or not file.content_type.startswith("image/"):
        print(f"Rejected: invalid content type {file.content_type}")
        raise HTTPException(400, "Разрешены только изображения")

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

    # Сохраняем файл
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
        print(f"File saved successfully, size: {len(content)} bytes")

    # Возвращаем относительный URL
    return {"url": f"/uploads/{filename}"}


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(404, "Файл не найден")
    return FileResponse(filepath)