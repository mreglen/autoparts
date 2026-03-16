from celery import Task
from app.celery_app import celery_app
from app.core.config import settings
from app.utils.video_utils import compress_video, get_video_duration
import os
import shutil


@celery_app.task(bind=True, max_retries=3)
def process_and_upload_video(self, temp_file_path: str, original_filename: str, organization_id: str, add_watermark: bool, logo_path: str = None):
    """
    Файл обновлён
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
        
        # Try to open and read first few bytes to verify accessibility
        try:
            with open(temp_file_path, 'rb') as f:
                f.read(1024)  # Read first KB
            print(f"✓ File is accessible and readable")
        except Exception as access_error:
            print(f"ERROR: Cannot access file: {access_error}")
            raise Exception(f"Cannot read temp file: {access_error}")
        
        # Get video duration before processing
        try:
            duration = get_video_duration(temp_file_path)
            print(f"Video duration: {duration:.2f} seconds")
            
            # Validate duration (max 60 seconds)
            if duration > 60:
                raise ValueError(
                    f"Видео слишком длинное. Длительность: {duration:.1f} сек. "
                    f"Максимальная длительность: 60 сек."
                )
        except ValueError as ve:
            print(f"Validation error: {str(ve)}")
            # Delete temp file
            try:
                os.remove(temp_file_path)
                print(f"Deleted temp file: {temp_file_path}")
            except:
                pass
            return {
                'url': None,
                'status': 'failed',
                'error': str(ve)
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
        
        # Compress video with optimized settings for speed (same as your working command)
        try:
            print(f"Compressing video...")
            compressed_path = compress_video(
                temp_file_path,
                output_path=final_path,
                max_duration_seconds=60,
                video_bitrate="1500k",
                audio_bitrate="128k",
                preset="medium",
                crf=28
            )
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
        
        # Delete original temp file
        try:
            os.remove(temp_file_path)
            print(f"Deleted temp file: {temp_file_path}")
        except Exception as delete_error:
            print(f"Warning: Could not delete temp file {temp_file_path}: {str(delete_error)}")
        
        # Construct relative path (without domain) - frontend will add backend base URL
        media_path = f"/videos/{organization_id}/{final_filename}"
        
        print(f"✓ Video saved successfully!")
        print(f"  Final path: {final_path}")
        print(f"  Media URL path: {media_path}")
        
        # Remove trailing slash from BASE_URL if present to avoid double slashes
        base_url = settings.BASE_URL.rstrip('/')
        
        return {
            'path': media_path,  # Relative path for database storage
            'url': f"{base_url}{media_path}",  # Full URL for immediate use
            'status': 'success',
            'filename': final_filename,
            'organization_id': organization_id,
            'duration': duration
        }
        
    except Exception as exc:
        print(f"Error processing video: {str(exc)}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        # Final failure after retries
        if self.request.retries >= self.max_retries:
            print(f"Task failed permanently after {self.max_retries} retries")
            return {
                'url': None,
                'status': 'failed',
                'error': str(exc)
            }
        print(f"Retrying task (attempt {self.request.retries + 1}/{self.max_retries})...")
        raise self.retry(exc=exc, countdown=60)
