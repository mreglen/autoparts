from celery.result import AsyncResult
from app.tasks.photo_tasks import process_and_upload_photo
import time


def get_photo_url_from_task(task_id: str, timeout: int = 60) -> str:
    """
    Wait for a Celery photo processing task to complete and return the URL.
    
    Args:
        task_id: Celery task ID
        timeout: Maximum seconds to wait (default: 60)
    
    Returns:
        str: Photo URL if successful, None if failed or timeout
    
    Note: This is a synchronous wait. For async operations, use task status endpoint.
    """
    task_result = AsyncResult(task_id, app=process_and_upload_photo.app)
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        if task_result.state == 'SUCCESS':
            result = task_result.result
            if isinstance(result, dict) and result.get('status') == 'success':
                return result.get('url')
            return None
        elif task_result.state in ['FAILURE', 'REVOKED']:
            return None
        elif task_result.state in ['PENDING', 'STARTED', 'RETRY']:
            time.sleep(0.5)  # Wait before checking again
        else:
            time.sleep(0.5)
    
    # Timeout reached
    return None


def construct_temp_photo_url(filename: str, organization_id: str) -> str:
    """
    Construct a temporary photo URL that can be used before processing completes.
    
    Args:
        filename: Generated filename
        organization_id: Organization ID
    
    Returns:
        str: Temporary URL structure
    """
    from app.core.config import settings
    return f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET_NAME}/uploads/pictures/{organization_id}/{filename}"
