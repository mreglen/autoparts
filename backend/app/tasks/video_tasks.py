from celery import Task
from app.celery_app import celery_app
from app.core.config import settings
from app.utils.video_utils import compress_video, get_video_duration
import os
import shutil


@celery_app.task(bind=True, max_retries=3)
def process_and_upload_video(self, temp_file_path: str, original_filename: str, organization_id: str):
    """
    Celery task to process video: validate, compress, and move to final location.
    
    Steps:
    1. Read video from temp folder
    2. Validate duration (max 60 seconds)
    3. Compress video with H.264 codec
    4. Save to uploads/videos/{organization_id}/
    5. Delete original from temp folder
    6. Return URL
    
    Args:
        self: Task instance
        temp_file_path: Path to temporary file
        original_filename: Original filename (for reference)
        organization_id: ID of the organization owning the media
    
    Returns:
        dict: {'url': str, 'status': str, 'filename': str, 'path': str}
    """
    try:
        # Check if temp file exists
        print(f"=== VIDEO PROCESSING TASK STARTED ===")
        print(f"Temp file path: {temp_file_path}")
        print(f"Absolute temp path: {os.path.abspath(temp_file_path)}")
        print(f"Original filename: {original_filename}")
        print(f"Organization ID: {organization_id}")
        
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
        final_filename = f"{base_name}.mp4"
        
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
        
        # If compression created a different file, move it to final location
        if compressed_path != final_path:
            try:
                shutil.move(compressed_path, final_path)
                print(f"Moved compressed file to: {final_path}")
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
        
        return {
            'path': media_path,  # Relative path for database storage
            'url': f"{settings.BASE_URL}{media_path}",  # Full URL for immediate use
            'status': 'success',
            'filename': final_filename,
            'organization_id': organization_id,
            'duration': duration
        }
        
    except Exception as exc:
        print(f"Error processing video: {str(exc)}")
        # Final failure after retries
        if self.request.retries >= self.max_retries:
            return {
                'url': None,
                'status': 'failed',
                'error': str(exc)
            }
        raise self.retry(exc=exc, countdown=60)
