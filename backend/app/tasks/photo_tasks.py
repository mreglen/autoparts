from celery import Task
from app.celery_app import celery_app
from app.core.config import settings
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import os
import exifread
from pillow_heif import register_heif_opener


# Register HEIF opener for .heic/.heif support
register_heif_opener()


def remove_exif_data(image: Image.Image) -> Image.Image:
    """
    Remove all EXIF/metadata from image including geotags.
    
    Args:
        image: PIL Image object
    
    Returns:
        PIL Image object without metadata
    """
    # Create a new image without any metadata
    data = image.tobytes()
    mode = image.mode
    size = image.size
    
    # Recreate image from raw data (this strips all metadata)
    clean_image = Image.frombytes(mode, size, data)
    return clean_image


def add_watermark(image: Image.Image, logo_path: str) -> Image.Image:
    """
    фото таск обновлён
    """
    try:
        # Open the logo
        logo = Image.open(logo_path)
        
        # Convert both images to RGBA for transparency support
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        if logo.mode != 'RGBA':
            logo = logo.convert('RGBA')
        
      
        max_logo_width = int(image.width * 0.5)  
        max_logo_height = int(image.height * 0.5)
        
        # Resize logo while maintaining aspect ratio
        logo.thumbnail((max_logo_width, max_logo_height), Image.Resampling.LANCZOS)
        
        # Make logo semi-transparent (50% opacity - balanced visibility)
        alpha = logo.split()[3]  # Get the alpha channel
        # Apply 50% opacity for good balance between subtlety and visibility
        alpha = alpha.point(lambda i: i * 0.5)
        logo.putalpha(alpha)
        
        # Create a transparent layer for the watermark
        watermark_layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
        
        # Position: BOTTOM-RIGHT corner with small padding
        padding = 20  # pixels from the edges
        x = image.width - logo.width - padding
        y = image.height - logo.height - padding
        
        print(f"  Image dimensions: {image.width}x{image.height}")
        print(f"  Logo dimensions after resize (3x smaller): {logo.width}x{logo.height}")
        print(f"  Calculated bottom-right position: x={x}, y={y}")
        
        # Paste logo onto watermark layer
        watermark_layer.paste(logo, (x, y), logo)
        
        # Composite the watermark onto the original image
        watermarked_image = Image.alpha_composite(image, watermark_layer)
        
        print(f"✓ Watermark applied successfully")
        print(f"  Logo size (3x smaller): {logo.width}x{logo.height}")
        print(f"  Image size: {image.width}x{image.height}")
        print(f"  Position: ({x}, {y}) - Bottom-right corner with 50% opacity")
        
        return watermarked_image
        
    except Exception as e:
        print(f"⚠️ Warning: Could not apply watermark: {str(e)}")
        # Return original image if watermark fails
        return image


def optimize_image(image_data: bytes, max_size: tuple = (1920, 1920), quality: int = 85, watermark_logo_path: str = None):
    """
    Optimizes an image using Pillow, removes metadata, converts to WebP.
    Preserves original aspect ratio while reducing file size.
    
    Args:
        image_data: Raw image bytes
        max_size: Maximum dimensions (width, height) - image will fit within these bounds while preserving aspect ratio
        quality: WebP quality (1-100) - balanced for good quality and compression
        watermark_logo_path: Optional path to logo file to use as watermark
    
    Returns:
        bytes: Optimized WebP image bytes
    """
    img = Image.open(BytesIO(image_data))
    
    # Remove EXIF and all metadata
    img = remove_exif_data(img)
    
    # Apply watermark if provided (before resizing)
    if watermark_logo_path and os.path.exists(watermark_logo_path):
        img = add_watermark(img, watermark_logo_path)
    
    # Check if image has transparency (RGBA or LA mode) or if it's a PNG/WebP that might have transparency
    original_has_transparency = img.mode in ('RGBA', 'LA', 'P') or (img.mode == 'P' and 'transparency' in img.info)
    
    # Convert to RGB if necessary (WebP doesn't support all modes)
    # BUT preserve transparency if the original image had it
    if img.mode in ('RGBA', 'LA', 'P'):
        if original_has_transparency:
            # Keep transparency - convert to RGBA for WebP
            if img.mode == 'P':
                img = img.convert('RGBA')
            elif img.mode == 'LA':
                img = img.convert('RGBA')
            # Don't add white background - preserve transparency
        else:
            # No transparency - create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Resize if needed
    img.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    # Save to WebP format with stronger compression
    output = BytesIO()
    img.save(output, format='WebP', quality=quality, method=6, lossless=False)
    
    return output.getvalue()


@celery_app.task(bind=True, max_retries=3)
def process_and_upload_photo(
    self,
    temp_file_path: str,
    original_filename: str,
    organization_id: str,
    subfolder: str,
    add_watermark: bool = False,
    logo_path: str = None,
    vehicle_photo_id: int | None = None,
):
    """
    Celery task to process photo: remove metadata, convert to WebP, compress, and move to final location.
    
    Steps:
    1. Read image from temp folder
    2. Remove all EXIF/metadata (including geotags)
    3. Apply watermark if requested and logo provided
    4. Optimize and convert to WebP
    5. Save to uploads/{subfolder}/{organization_id}/
    6. Delete original from temp folder
    7. Update database with new URL
    8. Return URL
    
    Args:
        self: Task instance
        temp_file_path: Path to temporary file
        original_filename: Original filename (for reference)
        organization_id: ID of the organization owning the media
        subfolder: Subfolder name ("pictures", "logo_organizations" etc.)
        add_watermark: Whether to add watermark (default: False)
        logo_path: Path to logo file for watermark (required if add_watermark=True)
    
    Returns:
        dict: {'url': str, 'status': str, 'filename': str}
    """
    try:
        # Check if temp file exists
        print(f"=== PHOTO PROCESSING TASK STARTED ===")
        print(f"Temp file path: {temp_file_path}")
        print(f"Original filename: {original_filename}")
        print(f"Organization ID: {organization_id}")
        
        if not os.path.exists(temp_file_path):
            print(f"ERROR: Temp file not found at: {temp_file_path}")
            raise Exception(f"Temp file not found: {temp_file_path}")
        
        print(f"✓ Temp file exists, size: {os.path.getsize(temp_file_path)} bytes")
        
        # Read the image from temp location
        with open(temp_file_path, 'rb') as f:
            image_data = f.read()
        
        # Process and optimize image (removes metadata, converts to WebP)
        # Apply watermark if requested
        watermark_path = logo_path if add_watermark else None
        processed_bytes = optimize_image(image_data, watermark_logo_path=watermark_path)
        
        # Generate final path with organization ID
        # Change extension to .webp
        base_name = os.path.splitext(original_filename)[0]
        
        # Generate new filename with org_id + timestamp + original_base_name
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        # Create safe filename by removing special characters from original name
        safe_original_name = "".join(c if c.isalnum() or c in ('-', '_', ' ') else '_' for c in base_name).strip()
        safe_original_name = '_'.join(safe_original_name.split())  # Replace spaces with underscores
        final_filename = f"{organization_id}_{timestamp}_{safe_original_name}.webp"
        
        upload_dir = os.path.join("uploads", subfolder, organization_id)
        final_path = os.path.join(upload_dir, final_filename)
        
        print(f"Generated final filename: {final_filename}")
        print(f"Upload directory: {upload_dir}")
        print(f"Final path: {final_path}")
        
        # Create directory if it doesn't exist
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save optimized image to final location
        try:
            print(f"Saving optimized image to: {final_path}")
            with open(final_path, 'wb') as f:
                f.write(processed_bytes)
            print(f"✓ Successfully saved file: {final_path}")
        except Exception as save_error:
            print(f"ERROR saving file: {save_error}")
            # Retry logic
            raise self.retry(exc=save_error, countdown=60)

        # Убедиться, что файл на диске виден и не пустой — до обновления БД temp не трогаем
        if not os.path.isfile(final_path) or os.path.getsize(final_path) == 0:
            raise Exception(f"Final file missing or empty after write: {final_path}")

        # Construct relative path (without domain) - frontend will add backend base URL
        # Add /uploads prefix only for logo_organizations subfolder
        if subfolder == "logo_organizations":
            media_path = f"/uploads/{subfolder}/{organization_id}/{final_filename}"
        else:
            media_path = f"/{subfolder}/{organization_id}/{final_filename}"
        
        print(f"✓ Photo saved successfully!")
        print(f"  Final path: {final_path}")
        print(f"  Media URL path: {media_path}")
        
        # 🚀 ВАЖНО: Обновляем запись в БД с финальным путём!
        print(f"\n🔄 Starting database update for photo...")
        
        db_updated = False
        try:
            # Импортируем только необходимые объекты, чтобы избежать конфликтов
            from sqlalchemy import create_engine, text
            from app.core.config import settings
            from sqlalchemy.orm import sessionmaker
            
            print(f"   Creating DB engine...")
            
            # Создаём новый движок и сессию (не используем get_db чтобы избежать конфликтов)
            engine = create_engine(settings.DATABASE_URL)
            SessionLocalDirect = sessionmaker(bind=engine, autocommit=False, autoflush=False)
            db = SessionLocalDirect()
            
            print(f"   DB session created, executing SQL...")
            
            try:
                if vehicle_photo_id is not None:
                    from app.models.vehicle_photo import VehiclePhoto

                    # Повторная проверка перед записью в БД: финальный файл уже на месте
                    if not os.path.isfile(final_path) or os.path.getsize(final_path) == 0:
                        raise Exception(f"Refuse DB update: final file not ready: {final_path}")

                    vp = db.query(VehiclePhoto).filter(VehiclePhoto.id == vehicle_photo_id).first()
                    if vp:
                        vp.photo_path = media_path
                        vp.processing_status = "completed"
                        db.commit()
                        db.refresh(vp)
                        if vp.photo_path == media_path and vp.processing_status == "completed":
                            print(f"✅ vehicle_photos id={vehicle_photo_id} updated to {media_path}")
                            db_updated = True
                    else:
                        print(f"⚠️ VehiclePhoto id={vehicle_photo_id} not found")
                else:
                    # Извлекаем basename из temp_file_path для поиска
                    temp_basename = os.path.basename(temp_file_path)
                    print(f"   Searching for photo with basename: {temp_basename}")

                    # Сначала пытаемся найти через ORM по basename
                    from app.models.product import ProductPhoto
                    photo_record = db.query(ProductPhoto).filter(
                        ProductPhoto.photo_url.like(f"%{temp_basename}%")
                    ).first()

                    if photo_record:
                        print(f"   ✅ Found photo record: ID={photo_record.id}")
                        print(f"   Old URL: {photo_record.photo_url}")
                        print(f"   Processing status: {photo_record.processing_status}")

                        # Прямой SQL запрос для обновления (чтобы избежать проблем с ORM)
                        update_query = text("""
                            UPDATE product_photos
                            SET photo_url = :photo_url,
                                processing_status = :status,
                                updated_at = NOW()
                            WHERE id = :photo_id
                        """)

                        print(f"   Executing SQL UPDATE...")
                        result = db.execute(
                            update_query,
                            {
                                "photo_url": media_path,
                                "status": "completed",
                                "photo_id": photo_record.id
                            }
                        )

                        rows_updated = result.rowcount
                        print(f"   Rows affected: {rows_updated}")

                        db.commit()
                        print(f"   ✅ Transaction committed!")

                        # Проверяем что действительно обновилось
                        verify_query = text("SELECT photo_url, processing_status FROM product_photos WHERE id = :id")
                        verify_result = db.execute(verify_query, {"id": photo_record.id}).first()

                        if verify_result:
                            print(f"   ✅ Verification: photo_url='{verify_result.photo_url}', status='{verify_result.processing_status}'")
                            if verify_result.photo_url == media_path and verify_result.processing_status == 'completed':
                                print(f"✅ Database updated successfully via SQL! Photo {photo_record.id} now points to: {media_path}")
                                db_updated = True
                            else:
                                print(f"⚠️ Warning: Update succeeded but values don't match!")
                                print(f"   Expected: photo_url='{media_path}', status='completed'")
                                print(f"   Got: photo_url='{verify_result.photo_url}', status='{verify_result.processing_status}'")
                        else:
                            print(f"⚠️ Warning: Could not verify update - record {photo_record.id} not found")
                    else:
                        print(f"⚠️ Warning: Photo record not found for basename: {temp_basename}")
                        print(f"   This might mean the photo was already updated or deleted")

            except Exception as sql_error:
                print(f"   ⚠️ SQL execution failed: {sql_error}")
                print(f"   Rolling back transaction...")
                db.rollback()
                if vehicle_photo_id is not None:
                    raise sql_error

                print("   Falling back to ORM method...")

                # Пытаемся через ORM если SQL не сработал (только для product photos)
                try:
                    from app.models.product import ProductPhoto
                    # Try to find by basename
                    photo_records = db.query(ProductPhoto).filter(
                        ProductPhoto.photo_url.like(f"%{temp_basename}%")
                    ).all()

                    if photo_records and len(photo_records) > 0:
                        photo_record = photo_records[0]
                        photo_record.photo_url = media_path
                        photo_record.processing_status = 'completed'
                        db.commit()

                        # Verify ORM update
                        db.refresh(photo_record)
                        print(f"   ✅ ORM verification: photo_url='{photo_record.photo_url}', status='{photo_record.processing_status}'")

                        if photo_record.photo_url == media_path:
                            print(f"✅ Database updated via ORM! Photo {photo_record.id} now points to: {media_path}")
                            db_updated = True
                        else:
                            print(f"⚠️ Warning: ORM update did not persist!")
                    else:
                        print(f"⚠️ Warning: No photo records found matching temp file")
                except Exception as orm_error:
                    print(f"   ⚠️ ORM method also failed: {orm_error}")
                    db.rollback()
                    raise
            finally:
                try:
                    db.close()
                except Exception:
                    pass

        except Exception as db_error:
            print(f"\n❌ FATAL: Error updating database: {db_error}")
            import traceback
            print(f"Full DB error traceback:\n{traceback.format_exc()}")
            print(f"⚠️ Photo file saved but database NOT updated - manual fix may be required!")
            # Не прерываем задачу из-за ошибки БД - фото всё равно сохранено
        
        # 🚀 ВАЖНО: Удаляем temp файл ТОЛЬКО после успешного обновления БД
        if db_updated:
            print(f"\n🗑️ Database updated successfully, now deleting temp file...")
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                    print(f"✅ Deleted temp file: {temp_file_path}")
                else:
                    print(f"⚠️ Temp file already deleted or doesn't exist: {temp_file_path}")
            except Exception as delete_error:
                print(f"⚠️ Warning: Could not delete temp file {temp_file_path}: {str(delete_error)}")
                print(f"   File will be cleaned up by cleanup task later")
        else:
            print(f"\n⚠️ Database update FAILED - keeping temp file for debugging: {temp_file_path}")
            print(f"   Manual cleanup may be required after fixing the database")
        
        # Remove trailing slash from BASE_URL if present to avoid double slashes
        base_url = settings.BASE_URL.rstrip('/')
        
        return {
            'path': media_path,  # Relative path for database storage
            'url': f"{base_url}{media_path}",  # Full URL for immediate use
            'status': 'success',
            'filename': final_filename,
            'organization_id': organization_id,
            'processing_complete': True  # Flag to indicate processing is done
        }
        
    except Exception as exc:
        print(f"Error processing photo: {str(exc)}")
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
