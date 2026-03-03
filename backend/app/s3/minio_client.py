from botocore.config import Config
import boto3
from ..core.config import settings


def get_minio_client():
    """
    Creates and returns a configured MinIO/S3 client using settings from environment variables.
    """
    s3_client = boto3.client(
        's3',
        endpoint_url=settings.MINIO_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        config=Config(
            signature_version='s3v4',
            region_name=settings.MINIO_REGION,
            s3={'addressing_style': 'path'}  # Critical for MinIO compatibility
        )
    )
    return s3_client


def create_bucket_if_not_exists(bucket_name: str):
    """
    Creates a bucket if it doesn't exist.
    """
    s3_client = get_minio_client()
    try:
        s3_client.head_bucket(Bucket=bucket_name)
    except Exception:
        # Bucket doesn't exist, create it
        s3_client.create_bucket(Bucket=bucket_name)


# Global client instance
minio_client = get_minio_client()