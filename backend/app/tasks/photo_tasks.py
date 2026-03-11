from celery import Task
from app.celery_app import celery_app
from app.core.config import settings
from PIL import Image
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


def optimize_image(image_data: bytes, max_size: tuple = (1920, 1920), quality: int = 85):
    """
    Optimizes an image using Pillow, removes metadata, converts to WebP.
    Preserves original aspect ratio while reducing file size.
    
    Args:
        image_data: Raw image bytes
        max_size: Maximum dimensions (width, height) - image will fit within these bounds while preserving aspect ratio
        quality: WebP quality (1-100) - balanced for good quality and compression
    
    Returns:
        bytes: Optimized WebP image bytes
    """
    img = Image.open(BytesIO(image_data))
    
    # Remove EXIF and all metadata
    img = remove_exif_data(img)
    
    # Convert to RGB if necessary (WebP doesn't support all modes)
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
    
    # Save to WebP format with stronger compression
    output = BytesIO()
    img.save(output, format='WebP', quality=quality, method=6, lossless=False)
    
    return output.getvalue()


@celery_app.task(bind=True, max_retries=3)
def process_and_upload_photo(self, temp_file_path: str, original_filename: str, organization_id: str):
    """
    Celery task to process photo: remove metadata, convert to WebP, compress, and move to final location.
    
    Steps:
    1. Read image from temp folder
    2. Remove all EXIF/metadata (including geotags)
    3. Optimize and convert to WebP
    4. Save to uploads/pictures/{organization_id}/
    5. Delete original from temp folder
    6. Return URL
    
    Args:
        self: Task instance
        temp_file_path: Path to temporary file
        original_filename: Original filename (for reference)
        organization_id: ID of the organization owning the media
    
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
        processed_bytes = optimize_image(image_data)
        
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
        
        upload_dir = os.path.join("uploads", "pictures", organization_id)
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
        
        # Delete original temp file
        try:
            os.remove(temp_file_path)
            print(f"Deleted temp file: {temp_file_path}")
        except Exception as delete_error:
            print(f"Warning: Could not delete temp file {temp_file_path}: {str(delete_error)}")
        
        # Construct relative path (without domain) - frontend will add backend base URL
        media_path = f"/pictures/{organization_id}/{final_filename}"
        
        print(f"✓ Photo saved successfully!")
        print(f"  Final path: {final_path}")
        print(f"  Media URL path: {media_path}")
        
        return {
            'path': media_path,  # Relative path for database storage
            'url': f"{settings.BASE_URL}{media_path}",  # Full URL for immediate use
            'status': 'success',
            'filename': final_filename,
            'organization_id': organization_id
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
