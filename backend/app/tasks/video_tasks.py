from celery import Task
from app.celery_app import celery_app
from app.core.config import settings
from app.utils.video_utils import compress_video, get_video_duration
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, text
import os
import shutil


@celery_app.task(bind=True, max_retries=3)
def process_and_upload_video(self, temp_file_path: str, original_filename: str, organization_id: str, add_watermark: bool, logo_path: str = None, product_video_id: int = None):
    """
    видео таскс обновлён
    Process video: compress, format, apply watermark, and move to final location.
    Temp file is kept available during processing for immediate playback.
    """
    try:
        # Check if temp file exists
        print(f"=== VIDEO PROCESSING TASK STARTED ===")
        print(f"Task ID: {self.request.id}")
        print(f"Temp file path: {temp_file_path}")
        print(f"Absolute temp path: {os.path.abspath(temp_file_path)}")
        print(f"Original filename: {original_filename}")
        print(f"Organization ID: {organization_id}")
        print(f"Current working directory: {os.getcwd()}")
        
        if not os.path.exists(temp_file_path):
            print(f"ERROR: Temp file not found at: {temp_file_path}")
            print(f"Current working directory: {os.getcwd()}")
            raise Exception(f"Temp file not found: {temp_file_path}")
        
        print(f"✓ Temp file exists, size: {os.path.getsize(temp_file_path):,} bytes")
        
        # Get video duration before processing
        try:
            duration = get_video_duration(temp_file_path)
            print(f"Video duration: {duration:.2f} seconds")
            
            # Validate duration (max 30 seconds)
            if duration > 30:
                raise ValueError(
                    f"Видео слишком длинное. Длительность: {duration:.1f} сек. "
                    f"Максимальная длительность: 30 сек."
                )
        except ValueError as ve:
            print(f"Validation error: {str(ve)}")
            return {
                'url': None,
                'status': 'failed',
                'error': str(ve),
                'temp_path': temp_file_path  # Keep temp path even on failure
            }
        except Exception as e:
            print(f"Error getting video duration: {str(e)}")
            raise self.retry(exc=e, countdown=60)
        
        # Generate final filename
        # Change extension to .mp4 for consistency
        base_name = os.path.splitext(original_filename)[0]
        
        # Generate new filename with org_id + timestamp + original_base_name
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        # Create safe filename by removing special characters from original name
        safe_original_name = "".join(c if c.isalnum() or c in ('-', '_', ' ') else '_' for c in base_name).strip()
        safe_original_name = '_'.join(safe_original_name.split())  # Replace spaces with underscores
        final_filename = f"{organization_id}_{timestamp}_{safe_original_name}.mp4"
        
        upload_dir = os.path.join("uploads", "videos", organization_id)
        final_path = os.path.join(upload_dir, final_filename)
        
        print(f"Generated final filename: {final_filename}")
        print(f"Upload directory: {upload_dir}")
        print(f"Final path: {final_path}")
        
        # Create directory if it doesn't exist
        os.makedirs(upload_dir, exist_ok=True)
        
        # Compress video with MAXIMUM SPEED settings (30 sec max limit)
        try:
            print(f"⚡ Compressing video (MAXIMUM SPEED)...")
            
            # Check if task was cancelled before starting compression
            if self.request.id:
                from celery.result import AsyncResult
                task_result = AsyncResult(self.request.id, app=self.app)
                if task_result.state == 'REVOKED':
                    print(f"⚠️ Task was revoked, skipping compression")
                    # Cleanup temp file
                    try:
                        os.remove(temp_file_path)
                        print(f"Cleaned up temp file after revoke: {temp_file_path}")
                    except:
                        pass
                    return {
                        'url': None,
                        'status': 'cancelled',
                        'error': 'Загрузка отменена пользователем',
                        'temp_path': temp_file_path
                    }
            
            # Определяем количество CPU ядер для оптимизации потоков
            import multiprocessing
            import time
            cpu_count = multiprocessing.cpu_count()
            # Используем половину ядер, но не больше 4 для ultrafast preset
            encoding_threads = min(max(1, cpu_count // 2), 4)
            print(f"CPU cores: {cpu_count}, Using threads: {encoding_threads}")
            
            # Логируем время начала сжатия
            compression_start = time.time()
            
            # ВАЖНО: На Linux/Ubuntu используем совместимый способ указания потоков
            # threads=0 может не работать корректно, поэтому явно указываем число
            compressed_path = compress_video(
                temp_file_path,
                output_path=final_path,
                max_duration_seconds=30,
                video_bitrate="800k",       # Минимальный битрейт для быстрой загрузки
                audio_bitrate="64k",        # Минимальный битрейт аудио
                preset="ultrafast",         # Самый быстрый preset для скорости
                crf=28,                     # Максимальное сжатие
                threads=encoding_threads    # Явно указываем количество потоков (критично для Linux!)
            )
            
            # Логируем время завершения и статистику
            compression_end = time.time()
            compression_time = compression_end - compression_start
            original_size = os.path.getsize(temp_file_path) / 1024 / 1024
            compressed_size = os.path.getsize(compressed_path) / 1024 / 1024
            compression_ratio = (1 - compressed_size / original_size) * 100
            
            print(f"⏱ Compression completed in: {compression_time:.2f} seconds")
            print(f"📊 Original size: {original_size:.2f} MB")
            print(f"📊 Compressed size: {compressed_size:.2f} MB")
            print(f"📊 Compression ratio: {compression_ratio:.1f}%")
            print(f"📈 Speed: {original_size / compression_time:.2f} MB/sec")
            print(f"✓ Video compressed successfully")
            print(f"  Compressed file: {compressed_path}")
            print(f"  Size: {os.path.getsize(compressed_path) / 1024 / 1024:.2f} MB")
        except Exception as compress_error:
            print(f"ERROR during compression: {compress_error}")
            # Retry logic
            raise self.retry(exc=compress_error, countdown=60)
        
        # Apply watermark if requested and logo is available
        final_media_path = compressed_path
        if add_watermark and logo_path and os.path.exists(logo_path):
            try:
                print(f"Applying watermark to video...")
                print(f"  Logo path: {logo_path}")
                print(f"  Logo exists: {os.path.exists(logo_path)}")
                
                from app.utils.video_utils import add_watermark_to_video
                watermarked_path = add_watermark_to_video(
                    compressed_path,
                    logo_path,
                    output_path=None,  # Will generate temp file
                    opacity=0.5,  # 50% opacity (same as photos)
                    padding=20  # 20px padding (same as photos)
                )
                
                # Move watermarked file to final location
                if watermarked_path != final_path:
                    shutil.move(watermarked_path, final_path)
                    print(f"Moved watermarked video to: {final_path}")
                
                final_media_path = final_path
                print(f"✓ Watermark applied successfully")
                
                # Delete the intermediate compressed file if it's different
                if compressed_path != final_path and os.path.exists(compressed_path):
                    try:
                        os.remove(compressed_path)
                        print(f"Deleted intermediate compressed file: {compressed_path}")
                    except:
                        pass
                        
            except Exception as watermark_error:
                print(f"⚠️ Warning: Could not apply watermark to video: {str(watermark_error)}")
                print(f"  Continuing without watermark...")
                # Continue without watermark - don't fail the entire task
                final_media_path = compressed_path
        
        # If compression/watermarking created a different file, move it to final location
        if final_media_path != final_path:
            try:
                shutil.move(final_media_path, final_path)
                print(f"Moved final video to: {final_path}")
            except Exception as move_error:
                print(f"Error moving file: {move_error}")
                raise self.retry(exc=move_error, countdown=60)
        
        # Delete original temp file AFTER successful processing and DB update
        print(f"Keeping temp file available for fallback: {temp_file_path}")
        
        # Construct relative paths
        temp_relative_path = f"/temp/{organization_id}/{os.path.basename(temp_file_path)}"
        media_path = f"/videos/{organization_id}/{final_filename}"
        
        print(f"✓ Video saved successfully!")
        print(f"  Final path: {final_path}")
        print(f"  Media URL path: {media_path}")
        
        # 🚀 ВАЖНО: Обновляем запись в БД с финальным путём!
        print(f"\n🔄 Starting database update for video {product_video_id}...")
        print(f"   Media path: {media_path}")
        print(f"   Status: completed")
        
        try:
            # Импортируем только необходимые объекты, чтобы избежать конфликтов
            from sqlalchemy import create_engine, text
            from app.core.config import settings
            
            print(f"   Creating DB engine...")
            print(f"   DATABASE_URL: {settings.DATABASE_URL[:50]}...")  # Показываем начало URL
            
            # Создаём новый движок и сессию (не используем get_db чтобы избежать конфликтов)
            engine = create_engine(settings.DATABASE_URL)
            SessionLocalDirect = sessionmaker(bind=engine, autocommit=False, autoflush=False)
            db = SessionLocalDirect()
            
            print(f"   DB session created, executing SQL...")
            
            try:
                # Прямой SQL запрос для обновления (чтобы избежать проблем с ORM)
                update_query = text("""
                    UPDATE product_videos
                    SET video_url = :video_url, 
                        processing_status = :status,
                        updated_at = NOW()
                    WHERE id = :video_id
                """)
                
                print(f"   Executing: UPDATE product_videos SET video_url='{media_path}', processing_status='completed' WHERE id={product_video_id}")
                
                result = db.execute(
                    update_query,
                    {
                        "video_url": media_path,
                        "status": "completed",
                        "video_id": product_video_id
                    }
                )
                
                rows_updated = result.rowcount
                print(f"   Rows affected: {rows_updated}")
                
                db.commit()
                print(f"   ✅ Transaction committed!")
                
                # Проверяем что действительно обновилось
                verify_query = text("SELECT video_url, processing_status FROM product_videos WHERE id = :id")
                verify_result = db.execute(verify_query, {"id": product_video_id}).first()
                
                if verify_result:
                    print(f"   ✅ Verification: video_url='{verify_result.video_url}', status='{verify_result.processing_status}'")
                    if verify_result.video_url == media_path and verify_result.processing_status == 'completed':
                        print(f"✅ Database updated successfully via SQL! Video {product_video_id} now points to: {media_path}")
                    else:
                        print(f"⚠️ Warning: Update succeeded but values don't match!")
                        print(f"   Expected: video_url='{media_path}', status='completed'")
                        print(f"   Got: video_url='{verify_result.video_url}', status='{verify_result.processing_status}'")
                else:
                    print(f"⚠️ Warning: Could not verify update - record {product_video_id} not found")
                    
            except Exception as sql_error:
                print(f"   ⚠️ SQL execution failed: {sql_error}")
                print(f"   Rolling back transaction...")
                db.rollback()
                print("   Falling back to ORM method...")
                
                # Пытаемся через ORM если SQL не сработал
                try:
                    from app.models.product import ProductVideo
                    video_record = db.query(ProductVideo).filter(
                        ProductVideo.id == product_video_id
                    ).first()
                    
                    if video_record:
                        old_url = video_record.video_url
                        video_record.video_url = media_path
                        video_record.processing_status = 'completed'
                        db.commit()
                        
                        # Verify ORM update
                        db.refresh(video_record)
                        print(f"   ✅ ORM verification: video_url='{video_record.video_url}', status='{video_record.processing_status}'")
                        
                        if video_record.video_url == media_path:
                            print(f"✅ Database updated via ORM! Video {product_video_id} now points to: {media_path}")
                        else:
                            print(f"⚠️ Warning: ORM update did not persist!")
                    else:
                        print(f"⚠️ Warning: Video record {product_video_id} not found in database")
                except Exception as orm_error:
                    print(f"   ⚠️ ORM method also failed: {orm_error}")
                    db.rollback()
                    raise
                finally:
                    db.close()
                    
        except Exception as db_error:
            print(f"\n❌ FATAL: Error updating database: {db_error}")
            import traceback
            print(f"Full DB error traceback:\n{traceback.format_exc()}")
            print(f"⚠️ Video file saved but database NOT updated - manual fix may be required!")
            # Не прерываем задачу из-за ошибки БД - видео всё равно сохранено
        
        # Теперь можно удалить temp файл
        # Даём небольшую задержку чтобы файл точно перестал использоваться
        import time
        time.sleep(0.5)  # Ждём 0.5 секунды
        
        try:
            if os.path.exists(temp_file_path):
                # Пробуем несколько раз с паузами
                max_attempts = 3
                for attempt in range(max_attempts):
                    try:
                        os.remove(temp_file_path)
                        print(f"✅ Temp file deleted: {temp_file_path}")
                        break
                    except PermissionError as pe:
                        if attempt < max_attempts - 1:
                            print(f"⚠️ Attempt {attempt + 1}/{max_attempts} failed - file busy, retrying in 1s...")
                            time.sleep(1)
                        else:
                            print(f"⚠️ Warning: Could not delete temp file after {max_attempts} attempts: {pe}")
                            print(f"   File will be cleaned up by cleanup task later")
                    except Exception as delete_error:
                        print(f"⚠️ Warning: Could not delete temp file: {delete_error}")
                        break
        except Exception as e:
            print(f"⚠️ Error during temp file cleanup: {e}")
            # Это не критично - cleanup задача удалит позже
        
        # Remove trailing slash from BASE_URL if present to avoid double slashes
        base_url = settings.BASE_URL.rstrip('/')
        
        return {
            'temp_path': temp_relative_path,  # Temp path for immediate playback
            'path': media_path,  # Relative path for database storage (final)
            'url': f"{base_url}{media_path}",  # Full URL for immediate use
            'status': 'success',
            'filename': final_filename,
            'organization_id': organization_id,
            'duration': duration,
            'processing_complete': True  # Flag to indicate processing is done
        }
        
    except Exception as exc:
        print(f"Error processing video: {str(exc)}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        # Final failure after retries
        if self.request.retries >= self.max_retries:
            print(f"Task failed permanently after {self.max_retries} retries")
            temp_relative_path = f"/temp/{organization_id}/{os.path.basename(temp_file_path)}"
            return {
                'temp_path': temp_relative_path,  # Temp path still available
                'url': None,
                'status': 'failed',
                'error': str(exc),
                'processing_complete': False
            }
        print(f"Retrying task (attempt {self.request.retries + 1}/{self.max_retries})...")
        raise self.retry(exc=exc, countdown=60)
