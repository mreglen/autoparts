"""
Test script to verify MinIO setup in the backend
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.s3.minio_client import get_minio_client, minio_client
from app.core.config import settings

def test_minio_connection():
    """
    Test the MinIO connection with the provided configuration
    """
    try:
        print("Testing MinIO connection...")
        print(f"Endpoint: {settings.MINIO_ENDPOINT}")
        print(f"Access Key: {settings.MINIO_ACCESS_KEY}")
        print(f"Bucket: {settings.MINIO_BUCKET_NAME}")
        
        # Test the client
        s3_client = get_minio_client()
        
        print("✓ Successfully created MinIO client!")
        
        # Check if our bucket exists by trying to access it
        try:
            s3_client.head_bucket(Bucket=settings.MINIO_BUCKET_NAME)
            print(f"✓ Bucket '{settings.MINIO_BUCKET_NAME}' exists")
        except:
            print(f"⚠ Bucket '{settings.MINIO_BUCKET_NAME}' does not exist, it will be created on first upload")
        
        # Test uploading a small test file
        test_content = b"Test file for MinIO connectivity"
        s3_client.put_object(
            Bucket=settings.MINIO_BUCKET_NAME,
            Key="test_connectivity.txt",
            Body=test_content
        )
        print("✓ Successfully uploaded test file to MinIO")
        
        # Download the test file back
        response = s3_client.get_object(
            Bucket=settings.MINIO_BUCKET_NAME,
            Key="test_connectivity.txt"
        )
        downloaded_content = response['Body'].read()
        
        if downloaded_content == test_content:
            print("✓ Successfully verified file download from MinIO")
        else:
            print("✗ File content mismatch when downloading from MinIO")
        
        # Clean up test file
        s3_client.delete_object(
            Bucket=settings.MINIO_BUCKET_NAME,
            Key="test_connectivity.txt"
        )
        print("✓ Cleaned up test file")
        
        print("\n✓ MinIO setup is working correctly!")
        return True
        
    except Exception as e:
        print(f"✗ Error connecting to MinIO: {str(e)}")
        return False

if __name__ == "__main__":
    test_minio_connection()