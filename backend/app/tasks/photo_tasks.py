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
    Add organization logo as watermark to the bottom-right corner of the image with transparency.
    
    Args:
        image: PIL Image object (the product photo)
        logo_path: Path to the organization logo file
    
    Returns:
        PIL Image object with watermark applied
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
def process_and_upload_photo(self, temp_file_path: str, original_filename: str, organization_id: str, subfolder: str = "pictures", add_watermark: bool = False, logo_path: str = None):
    """
    Celery task to process photo: remove metadata, convert to WebP, compress, and move to final location.
    
    Steps:
    1. Read image from temp folder
    2. Remove all EXIF/metadata (including geotags)
    3. Apply watermark if requested and logo provided
    4. Optimize and convert to WebP
    5. Save to uploads/{subfolder}/{organization_id}/
    6. Delete original from temp folder
    7. Return URL
    
    Args:
        self: Task instance
        temp_file_path: Path to temporary file
        original_filename: Original filename (for reference)
        organization_id: ID of the organization owning the media
        subfolder: Subfolder name (default: "pictures", can be "logo_organizations" etc.)
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
        
        # Delete original temp file
        try:
            os.remove(temp_file_path)
            print(f"Deleted temp file: {temp_file_path}")
        except Exception as delete_error:
            print(f"Warning: Could not delete temp file {temp_file_path}: {str(delete_error)}")
        
        # Construct relative path (without domain) - frontend will add backend base URL
        # Add /uploads prefix only for logo_organizations subfolder
        if subfolder == "logo_organizations":
            media_path = f"/uploads/{subfolder}/{organization_id}/{final_filename}"
        else:
            media_path = f"/{subfolder}/{organization_id}/{final_filename}"
        
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
