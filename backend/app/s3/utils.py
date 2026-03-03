import os
from typing import Optional
from io import BytesIO
from ..core.config import settings
from .minio_client import minio_client


def upload_file(file_data, filename: str, content_type: str = None) -> str:
    """
    Uploads a file to the MinIO bucket.
    
    Args:
        file_data: File data (bytes, file-like object, or path to file)
        filename: Name of the file in the bucket
        content_type: MIME type of the file
    
    Returns:
        str: URL of the uploaded file
    """
    extra_args = {}
    if content_type:
        extra_args['ContentType'] = content_type
    
    if isinstance(file_data, str) and os.path.exists(file_data):
        # If file_data is a file path
        minio_client.upload_file(file_data, settings.MINIO_BUCKET_NAME, filename, ExtraArgs=extra_args)
    else:
        # If file_data is bytes or file-like object
        if hasattr(file_data, 'read'):
            # File-like object
            file_data.seek(0, 2)  # Seek to end to get size
            size = file_data.tell()
            file_data.seek(0)  # Reset to beginning
            minio_client.put_object(settings.MINIO_BUCKET_NAME, filename, file_data, size, **extra_args)
        else:
            # Raw bytes
            minio_client.put_object(settings.MINIO_BUCKET_NAME, filename, BytesIO(file_data), len(file_data), **extra_args)
    
    # Return the file URL
    return f"{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET_NAME}/{filename}"


def download_file(filename: str) -> bytes:
    """
    Downloads a file from the MinIO bucket.
    
    Args:
        filename: Name of the file in the bucket
    
    Returns:
        bytes: Content of the downloaded file
    """
    response = minio_client.get_object(settings.MINIO_BUCKET_NAME, filename)
    try:
        return response['Body'].read()
    finally:
        response['Body'].close()


def delete_file(filename: str) -> bool:
    """
    Deletes a file from the MinIO bucket.
    
    Args:
        filename: Name of the file in the bucket
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        minio_client.delete_object(settings.MINIO_BUCKET_NAME, filename)
        return True
    except Exception:
        return False


def file_exists(filename: str) -> bool:
    """
    Checks if a file exists in the MinIO bucket.
    
    Args:
        filename: Name of the file in the bucket
    
    Returns:
        bool: True if file exists, False otherwise
    """
    try:
        minio_client.head_object(settings.MINIO_BUCKET_NAME, filename)
        return True
    except Exception:
        return False