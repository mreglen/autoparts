# SignatureDoesNotMatch Error - FIXED

## Problem
The error occurred when uploading media files:
```
An error occurred (SignatureDoesNotMatch) when calling the PutObject operation: 
The request signature we calculated does not match the signature you provided.
```

## Root Cause
The `/media-s3` endpoint was using direct S3 upload instead of going through Celery, which caused authentication issues with MinIO.

## Solution Applied

### 1. Updated `/upload/media-s3` endpoint
- Changed from direct upload to Celery-based async processing
- Added `organization_id` parameter (defaults to user's organization)
- Added authentication requirement
- Now uses the same Celery task as photo uploads

### 2. Enhanced Celery Task
Updated `process_and_upload_photo()` to handle both images and videos:
- **Images**: Optimized with Pillow (resize, convert to JPEG)
- **Videos**: Uploaded as-is without modification
- Stores in appropriate folders:
  - Images: `uploads/pictures/{organization_id}/`
  - Videos: `uploads/videos/{organization_id}/`

### 3. Filename Generation
Now uses organization ID in filenames for both photos and videos:
- Format: `{org_id}_{timestamp}_{uuid}.{ext}`
- Prevents conflicts between organizations
- Better organization in storage

## Files Modified

1. **`backend/app/routers/upload.py`**
   - Updated `/media-s3` endpoint to use Celery
   - Added organization_id support
   - Added authentication

2. **`backend/app/tasks/photo_tasks.py`**
   - Enhanced task to handle videos
   - Added content-type detection
   - Separate storage paths for images/videos

## Testing

After these changes:
1. ✅ Images upload successfully via Celery
2. ✅ Videos upload successfully via Celery
3. ✅ No more SignatureDoesNotMatch errors
4. ✅ Files are properly organized by organization
5. ✅ Images are optimized, videos pass through unchanged

## Usage

### Frontend Upload Example
```javascript
const formData = new FormData();
formData.append('file', mediaFile);

// Upload will now return a task_id
const response = await apiRequestFormData('/upload/media-s3', formData);
const taskId = response.task_id;

// Poll for completion
let mediaUrl;
while (!mediaUrl) {
  const statusResponse = await apiAxios.get(`/upload/photo-status/${taskId}`);
  const status = statusResponse.data;
  
  if (status.status === 'completed') {
    mediaUrl = status.result.url;
  } else {
    await new Promise(r => setTimeout(r, 1000));
  }
}
```

## Notes

- The old direct upload method (`s3_upload_file`) is no longer used by these endpoints
- All uploads now go through Celery for better reliability and scalability
- Videos are NOT processed/optimized, only uploaded
- Images are still optimized with Pillow as before
