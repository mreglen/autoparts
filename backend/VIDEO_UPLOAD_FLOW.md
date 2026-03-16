# Video Upload Flow - Two-Stage Processing

## Overview
Videos are now uploaded in two stages:
1. **Immediate Upload** - Video is saved to temp folder and available for playback immediately
2. **Background Processing** - Video is compressed, formatted, and watermarked in background
3. **Path Update** - Database is updated to point to the processed video

## File Locations

### Temp Videos (Immediate Playback)
- **Location**: `uploads/temp/{organization_id}/{uuid_filename}.{ext}`
- **URL Pattern**: `/media/temp/{organization_id}/{uuid_filename}.{ext}`
- **Purpose**: Immediate availability for user preview
- **Lifetime**: Kept until processing completes + cleanup job

### Processed Videos (Final)
- **Location**: `uploads/videos/{organization_id}/{org_id}_{timestamp}_{name}.mp4`
- **URL Pattern**: `/media/videos/{organization_id}/{filename}.mp4`
- **Purpose**: Optimized, watermarked final version
- **Lifetime**: Permanent (until deleted)

## API Endpoints

### 1. Upload Video
```
POST /api/upload/video
Content-Type: multipart/form-data

Parameters:
- file: Video file
- organization_id: string (optional, uses current user's org if not provided)

Response (immediate):
{
  "task_id": "abc123...",
  "status": "processing",
  "temp_filename": "uuid123.mp4",
  "organization_id": "org123",
  "temp_path": "/temp/org123/uuid123.mp4",      // ← Use this immediately!
  "final_path": "/videos/org123/final.mp4",     // ← Will be available later
  "message": "Video uploaded successfully and is being processed..."
}
```

### 2. Check Processing Status
```
GET /api/upload/video-status/{task_id}?product_video_id={video_db_id}

Response (during processing):
{
  "task_id": "abc123...",
  "state": "STARTED",
  "status": "processing",
  "temp_path": "/temp/org123/uuid123.mp4",
  "message": "Video is being processed. Temp file available for playback."
}

Response (completed):
{
  "task_id": "abc123...",
  "state": "SUCCESS",
  "status": "success",
  "temp_path": "/temp/org123/uuid123.mp4",
  "final_path": "/videos/org123/org123_20260316_123456_name.mp4",
  "url": "http://backend/temp/org123/uuid123.mp4",
  "filename": "org123_20260316_123456_name.mp4",
  "duration": 15.5,
  "processing_complete": true,
  "database_updated": true  // ← DB was updated automatically!
}
```

### 3. Cancel Upload (Optional)
```
POST /api/upload/cancel/{task_id}

Cancels a running video processing task.
```

## Frontend Implementation Guide

### Step-by-Step Flow

```javascript
// 1. Upload video file
const formData = new FormData();
formData.append('file', videoFile);
formData.append('organization_id', organizationId);

const uploadResult = await apiRequestFormData('/upload/video', formData);
// Result contains: task_id, temp_path, final_path

// 2. Create ProductVideo record with TEMP path immediately
const videoRecord = {
  product_id: productId,
  video_url: uploadResult.temp_path,  // Use temp path initially
  organization_id: organizationId,
  processing_status: 'processing'
};

const createdVideo = await createProductVideo(videoRecord);
// createdVideo.id is now available

// 3. Play video from temp location while processing
const tempVideoUrl = `${BACKEND_URL}/media${uploadResult.temp_path}`;
videoElement.src = tempVideoUrl;
videoElement.play();  // User can watch immediately!

// 4. Poll for completion
const pollInterval = setInterval(async () => {
  const status = await apiRequest(
    `/upload/video-status/${uploadResult.task_id}?product_video_id=${createdVideo.id}`
  );
  
  if (status.status === 'success' && status.processing_complete) {
    // Processing complete!
    clearInterval(pollInterval);
    
    // Update video source to final version
    const finalVideoUrl = `${BACKEND_URL}/media${status.final_path}`;
    videoElement.src = finalVideoUrl;
    
    console.log('✅ Video processing complete!');
    console.log('   Temp path:', status.temp_path);
    console.log('   Final path:', status.final_path);
    console.log('   Database updated:', status.database_updated);
  } else if (status.status === 'failed') {
    // Processing failed
    clearInterval(pollInterval);
    console.error('❌ Video processing failed:', status.error);
  }
}, 2000);  // Check every 2 seconds

// 5. Stop polling after timeout (e.g., 3 minutes)
setTimeout(() => {
  clearInterval(pollInterval);
  console.warn('⚠️ Video processing timeout - using temp version');
}, 180000);
```

## Backend Processing Flow

### Upload Router (`upload.py`)
1. Receives video file
2. Saves to `uploads/temp/{organization_id}/` with UUID filename
3. Returns `temp_path` immediately
4. Starts Celery task for background processing

### Celery Task (`video_tasks.py`)
1. Reads video from temp folder
2. Validates duration (max 30 sec)
3. Compresses video (ultrafast preset, CRF 20)
4. Applies watermark if configured
5. Saves to `uploads/videos/{organization_id}/`
6. Returns both `temp_path` and `final_path`
7. **Keeps temp file available** (doesn't delete it)

### Status Endpoint (`upload.py`)
1. Checks Celery task status
2. Returns current paths (temp and/or final)
3. If `product_video_id` is provided AND processing is complete:
   - Updates `ProductVideo.video_url` from temp to final path
   - Sets `processing_status = 'completed'`

### Media Serving (`main.py`)
- Serves both temp and final videos via `/media/{path:path}`
- Supports formats: mp4, avi, mov, webm
- Sets proper CORS headers for frontend access

## Database Schema

### ProductVideo Model
```python
class ProductVideo(Base):
    __tablename__ = "product_videos"
    
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    video_url = Column(Text, nullable=False)  # Stores temp OR final path
    organization_id = Column(String, ForeignKey("organizations.id"))
    processing_status = Column(String(20))  # pending, processing, completed, failed
```

### Lifecycle
1. **Initial**: `video_url = "/temp/org123/uuid123.mp4"`, `status = "processing"`
2. **After Processing**: `video_url = "/videos/org123/final.mp4"`, `status = "completed"`

## Cleanup Strategy (Future Enhancement)

Temp files should be cleaned up periodically:

```python
# Future cleanup task example
@celery_app.task
def cleanup_old_temp_files():
    """Delete temp files older than 24 hours"""
    from datetime import datetime, timedelta
    
    cutoff = datetime.now() - timedelta(hours=24)
    temp_dir = Path("uploads/temp")
    
    for org_dir in temp_dir.iterdir():
        if org_dir.is_dir():
            for temp_file in org_dir.iterdir():
                if temp_file.stat().st_mtime < cutoff.timestamp():
                    temp_file.unlink()
                    print(f"Deleted old temp file: {temp_file}")
```

## Benefits

1. ✅ **Immediate Feedback** - Users see video instantly
2. ✅ **Better UX** - Can play/verify video while processing happens
3. ✅ **Resilient** - If processing fails, temp video still available
4. ✅ **Non-blocking** - User can continue working during processing
5. ✅ **Transparent** - Status endpoint shows progress

## Migration Notes

- Existing videos are NOT affected
- New uploads use the two-stage flow
- Temp files are organized by organization_id
- Backward compatible with existing code
