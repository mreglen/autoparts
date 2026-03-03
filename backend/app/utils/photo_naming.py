import uuid
from datetime import datetime


def generate_photo_filename(organization_id: str, original_filename: str = None) -> str:
    """
    Generates a unique filename for a photo including organization ID.
    
    Format: {organization_id}_{timestamp}_{uuid}{extension}
    
    Args:
        organization_id: ID of the organization owning the photo
        original_filename: Original filename to extract extension from
    
    Returns:
        str: Generated filename (without path)
    """
    # Get file extension
    ext = ''
    if original_filename and '.' in original_filename:
        ext = '.' + original_filename.rsplit('.', 1)[1].lower()
    
    # Ensure extension is valid
    if ext and not ext.startswith('.'):
        ext = f'.{ext}'
    
    # Generate timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Generate UUID
    unique_id = uuid.uuid4().hex[:8]
    
    # Clean organization ID (remove any special characters)
    clean_org_id = ''.join(c for c in organization_id if c.isalnum() or c in '-_')
    
    return f"{clean_org_id}_{timestamp}_{unique_id}{ext}"
