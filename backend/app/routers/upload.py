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
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Разрешены только изображения")

    # Генерируем уникальное имя
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".jfif-tbn"):
        raise HTTPException(400, "Недопустимый формат изображения")

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Сохраняем файл
    with open(filepath, "wb") as f:
        f.write(await file.read())

    # Возвращаем относительный URL
    return {"url": f"/uploads/{filename}"}


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(filepath):
        raise HTTPException(404, "Файл не найден")
    return FileResponse(filepath)