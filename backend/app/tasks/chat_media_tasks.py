"""
Celery задачи для обработки медиа файлов в чатах
"""
import os
import tempfile
from PIL import Image
from pathlib import Path
from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.chat import ChatMedia, Message, Chat
from app.utils.video_utils import compress_video
import subprocess
import logging
import asyncio
import json

logger = logging.getLogger(__name__)

# Константы
MAX_IMAGE_SIZE = 1920  # Максимальная ширина/высота изображения
IMAGE_QUALITY = 85  # Качество JPEG
THUMBNAIL_SIZE = 400  # Размер превью


@celery_app.task(bind=True)
def log_error(self, exc, *args, **kwargs):
    """Логирование ошибок Celery задач"""
    logger.error(f"❌ Celery task failed: {self.request.id}, error: {exc}")
    return {"error": str(exc)}


@celery_app.task(bind=True, max_retries=3)
def compress_chat_image(self, media_id: int):
    """
    Сжатие изображения для чата
    - Уменьшение размера до MAX_IMAGE_SIZE
    - Создание thumbnail
    - Конвертация в JPEG
    """
    print(f"\n🎨 [TASK START] compress_chat_image: media_id={media_id}, task_id={self.request.id}")
    
    db = SessionLocal()
    try:
        media = db.query(ChatMedia).filter(ChatMedia.id == media_id).first()
        if not media:
            logger.error(f"Media {media_id} not found")
            print(f"❌ [ERROR] Media {media_id} not found")
            return {"success": False, "error": "Media not found"}

        print(f"📄 [INFO] Media found: {media.original_filename}, type={media.media_type}")
        print(f"📍 [INFO] File path: {media.file_path}")

        # Проверяем существует ли файл
        if not os.path.exists(media.file_path):
            logger.error(f"File not found: {media.file_path}")
            print(f"❌ [ERROR] File not found: {media.file_path}")
            media.is_processing = False
            db.commit()
            return {"success": False, "error": "File not found"}

        print(f"✅ [INFO] File exists, size: {os.path.getsize(media.file_path) / 1024:.1f} KB")

        # Открываем изображение
        img = Image.open(media.file_path)
        
        # Конвертируем в RGB если нужно (для PNG с прозрачностью)
        if img.mode in ('RGBA', 'P', 'LA'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Получаем оригинальные размеры
        original_width, original_height = img.size
        
        # Сохраняем размеры в БД
        media.width = original_width
        media.height = original_height
        
        # Создаем директорию для сжатых изображений
        upload_dir = Path("uploads/chat_media/compressed")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем путь для сжатого изображения
        original_filename = Path(media.file_path).stem
        compressed_path = upload_dir / f"{original_filename}_compressed.jpg"
        
        # Масштабируем если изображение слишком большое
        if original_width > MAX_IMAGE_SIZE or original_height > MAX_IMAGE_SIZE:
            img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS)
        
        # Сохраняем сжатое изображение
        img.save(str(compressed_path), 'JPEG', quality=IMAGE_QUALITY, optimize=True)
        
        # Обновляем путь к файлу
        old_path = media.file_path
        media.file_path = str(compressed_path)
        media.file_size = os.path.getsize(compressed_path)
        media.mime_type = 'image/jpeg'
        
        # Создаем thumbnail
        thumbnail_dir = Path("uploads/chat_media/thumbnails")
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        thumbnail_path = thumbnail_dir / f"{original_filename}_thumb.jpg"
        
        # Создаем thumbnail
        thumb_img = Image.open(old_path)
        if thumb_img.mode != 'RGB':
            thumb_img = thumb_img.convert('RGB')
        thumb_img.thumbnail((THUMBNAIL_SIZE, THUMBNAIL_SIZE), Image.Resampling.LANCZOS)
        thumb_img.save(str(thumbnail_path), 'JPEG', quality=IMAGE_QUALITY, optimize=True)
        
        media.thumbnail_path = str(thumbnail_path)
        media.is_processing = False
        
        db.commit()
        
        # Удаляем оригинальный файл
        if os.path.exists(old_path):
            os.remove(old_path)
        
        print(f"✅ [SUCCESS] Image compressed successfully!")
        print(f"📍 [INFO] Compressed: {compressed_path}")
        print(f"📍 [INFO] Thumbnail: {thumbnail_path}")
        print(f"📏 [INFO] Size: {os.path.getsize(compressed_path) / 1024:.1f} KB")
        
        # Отправляем WebSocket уведомление о готовности сообщения
        try:
            _send_media_ready_notification(media.message_id, db)
        except Exception as e:
            print(f"⚠️ [WARNING] Could not send WebSocket notification: {e}")
        
        return {
            "success": True,
            "media_id": media_id,
            "file_path": str(compressed_path),
            "thumbnail_path": str(thumbnail_path)
        }
        
    except Exception as e:
        logger.error(f"Error compressing image: {str(e)}")
        # Отмечаем как обработанный даже при ошибке
        try:
            media = db.query(ChatMedia).filter(ChatMedia.id == media_id).first()
            if media:
                media.is_processing = False
                db.commit()
        except:
            pass
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def compress_chat_video(self, media_id: int):
    """
    Сжатие видео для чата
    - Использование compress_video из video_utils
    - Создание thumbnail из первого кадра
    - Без водяного знака
    """
    print(f"\n🎬 [TASK START] compress_chat_video: media_id={media_id}, task_id={self.request.id}")
    
    db = SessionLocal()
    try:
        media = db.query(ChatMedia).filter(ChatMedia.id == media_id).first()
        if not media:
            logger.error(f"Media {media_id} not found")
            print(f"❌ [ERROR] Media {media_id} not found")
            return {"success": False, "error": "Media not found"}

        print(f"📄 [INFO] Media found: {media.original_filename}, type={media.media_type}")
        print(f"📍 [INFO] File path: {media.file_path}")

        # Проверяем существует ли файл
        if not os.path.exists(media.file_path):
            logger.error(f"File not found: {media.file_path}")
            print(f"❌ [ERROR] File not found: {media.file_path}")
            media.is_processing = False
            db.commit()
            return {"success": False, "error": "File not found"}

        print(f"✅ [INFO] File exists, size: {os.path.getsize(media.file_path) / 1024 / 1024:.1f} MB")

        # Создаем директорию для сжатых видео
        upload_dir = Path("uploads/chat_media/compressed")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем путь для сжатого видео
        original_filename = Path(media.file_path).stem
        compressed_path = upload_dir / f"{original_filename}_compressed.mp4"
        
        # Сжимаем видео (без водяного знака)
        try:
            compressed_video_path = compress_video(
                input_path=media.file_path,
                output_path=str(compressed_path),
                max_duration_seconds=60,
                video_bitrate="1500k",
                audio_bitrate="128k",
                preset="medium",
                crf=28
            )
        except Exception as e:
            logger.error(f"Video compression failed: {str(e)}")
            media.is_processing = False
            db.commit()
            return {"success": False, "error": str(e)}
        
        # Получаем размеры видео
        try:
            width, height = get_video_dimensions(compressed_video_path)
            media.width = width
            media.height = height
        except Exception as e:
            logger.warning(f"Could not get video dimensions: {str(e)}")
        
        # Получаем длительность видео
        try:
            duration = get_video_duration(compressed_video_path)
            media.duration = duration
        except Exception as e:
            logger.warning(f"Could not get video duration: {str(e)}")
        
        # Обновляем путь к файлу
        old_path = media.file_path
        media.file_path = compressed_video_path
        media.file_size = os.path.getsize(compressed_video_path)
        media.mime_type = 'video/mp4'
        
        # Создаем thumbnail из первого кадра
        thumbnail_dir = Path("uploads/chat_media/thumbnails")
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        thumbnail_path = thumbnail_dir / f"{original_filename}_thumb.jpg"
        
        try:
            extract_video_thumbnail(compressed_video_path, str(thumbnail_path))
            media.thumbnail_path = str(thumbnail_path)
        except Exception as e:
            logger.warning(f"Could not extract thumbnail: {str(e)}")
        
        media.is_processing = False
        db.commit()
        
        # Удаляем оригинальный файл
        if os.path.exists(old_path):
            os.remove(old_path)
        
        logger.info(f"Video compressed successfully: {compressed_video_path}")
        print(f"✅ [SUCCESS] Video compressed successfully!")
        print(f"📍 [INFO] Compressed: {compressed_video_path}")
        print(f"📍 [INFO] Thumbnail: {thumbnail_path if media.thumbnail_path else 'None'}")
        print(f"📏 [INFO] Size: {os.path.getsize(compressed_video_path) / 1024 / 1024:.2f} MB")
        print(f"⏱️ [INFO] Duration: {media.duration:.1f}s" if media.duration else "⏱️ [INFO] Duration: unknown")
        
        # Отправляем WebSocket уведомление о готовности сообщения
        try:
            _send_media_ready_notification(media.message_id, db)
        except Exception as e:
            print(f"⚠️ [WARNING] Could not send WebSocket notification: {e}")
        
        return {
            "success": True,
            "media_id": media_id,
            "file_path": compressed_video_path,
            "thumbnail_path": str(thumbnail_path) if media.thumbnail_path else None
        }
        
    except Exception as e:
        logger.error(f"Error compressing video: {str(e)}")
        # Отмечаем как обработанный даже при ошибке
        try:
            media = db.query(ChatMedia).filter(ChatMedia.id == media_id).first()
            if media:
                media.is_processing = False
                db.commit()
        except:
            pass
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


def get_video_dimensions(video_path: str) -> tuple:
    """Получить размеры видео"""
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-select_streams', 'v:0',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    import json
    probe = json.loads(result.stdout)
    width = int(probe['streams'][0]['width'])
    height = int(probe['streams'][0]['height'])
    return width, height


def get_video_duration(video_path: str) -> float:
    """Получить длительность видео в секундах"""
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    import json
    probe = json.loads(result.stdout)
    return float(probe['format']['duration'])


def extract_video_thumbnail(video_path: str, thumbnail_path: str, timestamp: str = "00:00:01"):
    """
    Извлечь thumbnail из видео
    timestamp: время кадра для извлечения (по умолчанию 1 секунда)
    """
    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-ss', timestamp,
        '-vframes', '1',
        '-vf', 'scale=400:-1',
        '-y',
        thumbnail_path
    ]
    subprocess.run(cmd, capture_output=True, text=True, check=True)


def _send_media_ready_notification(message_id: int, db):
    """
    Отправить WebSocket уведомление о том, что медиа обработано и сообщение готово
    """
    from app.routers.websocket import manager
    
    # Получаем сообщение
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        return
    
    # Получаем все медиа сообщения
    media_list = db.query(ChatMedia).filter(ChatMedia.message_id == message_id).all()
    
    # Проверяем, что все медиа обработано
    if any(m.is_processing for m in media_list):
        return  # Еще не все обработано
    
    # Получаем чат
    chat = db.query(Chat).filter(Chat.id == message.chat_id).first()
    if not chat:
        return
    
    # Формируем полное сообщение с медиа
    message_response = {
        "type": "message",
        "id": message.id,
        "chat_id": message.chat_id,
        "sender_id": message.sender_id,
        "message": message.message,
        "is_read": message.is_read,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "media": [
            {
                "id": m.id,
                "message_id": m.message_id,
                "media_type": m.media_type,
                "file_path": m.file_path,
                "thumbnail_path": m.thumbnail_path,
                "original_filename": m.original_filename,
                "file_size": m.file_size,
                "mime_type": m.mime_type,
                "width": m.width,
                "height": m.height,
                "duration": m.duration,
                "is_processing": m.is_processing if m.is_processing is not None else False,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in media_list
        ]
    }
    
    # Отправляем всем участникам чата кроме отправителя
    print(f"📤 [WS] Sending media ready notification for message {message_id}")
    print(f"   - Chat: {chat.id}, Sender: {message.sender_id}")
    print(f"   - Media count: {len(media_list)}")
    
    # Отправляем покупателю (если это не отправитель)
    if chat.buyer_id != message.sender_id and chat.buyer_id in manager.active_connections:
        print(f"   - Sending to buyer: {chat.buyer_id}")
        asyncio.get_event_loop().run_until_complete(
            manager.send_personal_message(message_response, chat.buyer_id)
        )
    
    # Отправляем продавцу (если это не отправитель)
    if chat.seller_id != message.sender_id and chat.seller_id in manager.active_connections:
        print(f"   - Sending to seller: {chat.seller_id}")
        asyncio.get_event_loop().run_until_complete(
            manager.send_personal_message(message_response, chat.seller_id)
        )
    
    print(f"✅ [WS] Media ready notification sent successfully")
