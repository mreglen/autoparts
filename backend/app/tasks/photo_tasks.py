from celery import Task
from app.celery_app import celery_app
from app.s3.minio_client import get_minio_client
from app.core.config import settings
from PIL import Image
from io import BytesIO
import os


def optimize_image(image_data: bytes, max_size: tuple = (1920, 1920), quality: int = 85):
    """
    Optimizes an image using Pillow.
    
    Args:
        image_data: Raw image bytes
        max_size: Maximum dimensions (width, height)
        quality: JPEG quality (1-100)
    
    Returns:
        bytes: Optimized image bytes
    """
    img = Image.open(BytesIO(image_data))
    
    # Convert to RGB if necessary (for PNG with transparency, etc.)
    if img.mode in ('RGBA', 'LA', 'P'):
        # Create white background for transparent images
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Resize if needed
    img.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    # Save to bytes
    output = BytesIO()
    img.save(output, format='JPEG', quality=quality, optimize=True, progressive=True)
    
    return output.getvalue()


@celery_app.task(bind=True, max_retries=3)
def process_and_upload_photo(self, file_data: str, filename: str, content_type: str, organization_id: str):
    """
    Celery task to process and upload photo/video to MinIO.
    
    Steps:
    1. For images: optimize using Pillow
    2. For videos: pass through as-is
    3. Upload to MinIO in uploads/pictures/{organization_id}/ or uploads/videos/{organization_id}/
    4. Return URL
    
    Args:
        self: Task instance
        file_data: Base64 encoded image/video data
        filename: Original filename
        content_type: MIME type
        organization_id: ID of the organization owning the media
    
    Returns:
        dict: {'url': str, 'status': str}
    """
    try:
        from base64 import b64decode
        
        # Decode base64 data
        if ',' in file_data:
            # Data URL format: data:image/jpeg;base64,...
            file_data = file_data.split(',')[1]
        
        media_bytes = b64decode(file_data)
        
        # Determine if it's a video or image based on content type
        is_video = content_type.startswith('video/')
        
        if is_video:
            # For videos, just use the original bytes without optimization
            processed_bytes = media_bytes
            final_content_type = content_type
        else:
            # For images, optimize with Pillow
            processed_bytes = optimize_image(media_bytes)
            final_content_type = 'image/jpeg'  # Always convert to JPEG after optimization
        
        # Generate final path with organization ID
        # Determine folder based on media type
        folder = "uploads/videos" if is_video else "uploads/pictures"
        final_filename = f"{folder}/{organization_id}/{filename}"
        
        # Upload to MinIO
        minio_client = get_minio_client()
        
        try:
            minio_client.put_object(
                Bucket=settings.MINIO_BUCKET_NAME,
                Key=final_filename,
                Body=BytesIO(processed_bytes),
                ContentLength=len(processed_bytes),
                ContentType=final_content_type
            )
        except Exception as upload_error:
            # Retry logic
            raise self.retry(exc=upload_error, countdown=60)
        
        # Construct URL
        media_url = f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET_NAME}/{final_filename}"
        
        return {
            'url': media_url,
            'status': 'success',
            'filename': final_filename,
            'is_video': is_video
        }
        
    except Exception as exc:
        print(f"Error processing media: {str(exc)}")
        # Final failure after retries
        if self.request.retries >= self.max_retries:
            return {
                'url': None,
                'status': 'failed',
                'error': str(exc)
            }
        raise self.retry(exc=exc, countdown=60)
