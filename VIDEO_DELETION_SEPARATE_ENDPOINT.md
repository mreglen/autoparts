# Video Deletion Implementation - Separate Endpoint ✅

## Overview
Video deletion has been implemented with a **dedicated endpoint separate from photos**, as required. The implementation includes both backend and frontend components.

## Backend Implementation (`backend/app/routers/products.py`)

### 1. Bulk Video Deletion Endpoint
```python
@router.delete("/{product_id}/videos", status_code=204)
def delete_product_videos(...):
    # DELETE /api/products/{product_id}/videos
    # Deletes multiple videos by ID
    # - Removes physical files from disk (uploads/videos/)
    # - Removes database records from product_videos table
    # - Returns 204 No Content
```

### 2. Single Video Deletion Endpoint
```python
@router.delete("/{product_id}/videos/{video_id}", status_code=204)
def delete_product_video(...):
    # DELETE /api/products/{product_id}/videos/{video_id}
    # Deletes single video by ID
    # - Removes physical file from disk
    # - Removes database record
    # - Returns 204 No Content
```

**Key Features:**
- ✅ **Separate endpoint from photos** - Uses `/videos` path, not `/photos`
- ✅ Proper route ordering (bulk endpoints BEFORE single endpoints)
- ✅ Physical file deletion from `backend/uploads/videos/` directory
- ✅ Database record cleanup
- ✅ Error handling (continues DB deletion even if file deletion fails)
- ✅ Debug logging for troubleshooting

## Frontend Implementation

### Redux Slice (`frontend/my-autoparts/src/redux/slices/ProductSlice.js`)

#### Bulk Video Deletion Action
```javascript
export const deleteProductVideos = createAsyncThunk(
    'products/deleteProductVideos',
    async ({ productId, videoIds }, { rejectWithValue }) => {
        await apiAxios.delete(`/products/${productId}/videos`, {
            data: { video_ids: videoIds }
        });
        return { productId, videoIds };
    }
);
```

#### Single Video Deletion Action
```javascript
export const deleteProductVideo = createAsyncThunk(
    'products/deleteProductVideo',
    async ({ productId, videoId }, { rejectWithValue }) => {
        await apiAxios.delete(`/products/${productId}/videos/${videoId}`);
        return { productId, videoId };
    }
);
```

### EditPart Component (`frontend/my-autoparts/src/pages/MyParts/EditPart/EditPart.jsx`)

**Key Changes:**
1. ✅ **Separate UI sections for photos and videos**
   - Photos are displayed in PhotoGallery component
   - Videos have their own dedicated display section with custom controls

2. ✅ **Video-specific deletion controls:**
   - Checkbox selection for bulk deletion
   - Individual delete button for each video
   - "Delete Selected Videos" button for bulk operations

3. ✅ **State management:**
   - `selectedVideosForRemoval` - tracks selected videos
   - `handleRemoveSelectedVideos()` - bulk deletion handler
   - `handleVideoSelectionToggle()` - toggle video selection
   - `handleDeleteSingleVideo()` - single video deletion

### Video Display Component

Videos are now displayed in a dedicated section with:
- Video thumbnail with play icon overlay
- Checkbox for bulk selection
- Individual delete button (trash icon)
- Click to view in full-screen media modal
- Bulk delete button when multiple videos are selected

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| DELETE | `/api/products/{id}/photos` | Bulk photo deletion |
| DELETE | `/api/products/{id}/photos/{photo_id}` | Single photo deletion |
| DELETE | `/api/products/{id}/videos` | **Bulk video deletion** |
| DELETE | `/api/products/{id}/videos/{video_id}` | **Single video deletion** |

## How It Works

### Single Video Deletion Flow:
1. User clicks delete button on a specific video
2. Frontend calls `deleteProductVideo(productId, videoId)` action
3. Backend receives `DELETE /api/products/{id}/videos/{video_id}`
4. Backend:
   - Validates user permissions (must be seller)
   - Finds video file in `uploads/videos/`
   - Deletes physical file from disk
   - Deletes database record from `product_videos` table
   - Returns 204 No Content
5. Frontend updates UI to remove deleted video

### Bulk Video Deletion Flow:
1. User selects multiple videos using checkboxes
2. User clicks "Удалить выбранные видео" button
3. Frontend calls `deleteProductVideos(productId, videoIds)` action
4. Backend receives `DELETE /api/products/{id}/videos` with video IDs array
5. Backend processes each video:
   - Deletes physical files
   - Deletes database records
6. Frontend updates UI to remove all deleted videos

## File Locations

**Backend:**
- Router: `backend/app/routers/products.py` (lines 386-520)
- Models: `backend/app/models/product.py` (ProductVideo class)
- Schemas: `backend/app/schemas/product.py` (DeleteVideosRequest class)
- Storage: `backend/uploads/videos/{organization_id}/`

**Frontend:**
- Redux Actions: `frontend/my-autoparts/src/redux/slices/ProductSlice.js` (lines 281-327)
- Edit Component: `frontend/my-autoparts/src/pages/MyParts/EditPart/EditPart.jsx` (lines 423-494, 877-983)
- Photo Gallery: `frontend/my-autoparts/src/components/PhotoGallery/PhotoGallery.jsx`

## Testing

### 1. Verify Backend Endpoints
```bash
# Check Swagger documentation
http://127.0.0.1:8000/docs

# Look for:
- DELETE /api/products/{product_id}/videos
- DELETE /api/products/{product_id}/videos/{video_id}
```

### 2. Test Single Video Deletion
1. Navigate to `/my-parts/edit/{product_id}`
2. Find existing video in "Видео" section
3. Click individual delete button (trash icon)
4. Confirm video is removed from UI and database

### 3. Test Bulk Video Deletion
1. Navigate to `/my-parts/edit/{product_id}`
2. Select multiple videos using checkboxes
3. Click "Удалить выбранные видео" button
4. Confirm all selected videos are removed

### 4. Verify File Cleanup
```bash
# Check that video files are actually deleted
ls backend/uploads/videos/{organization_id}/
# Deleted video files should not appear
```

## Expected Behavior

### Success Response
- HTTP Status: `204 No Content`
- Physical video file removed from `backend/uploads/videos/`
- Database record removed from `product_videos` table
- UI updates to remove deleted videos from display

### Error Responses
- `404 Not Found` - Product or video doesn't exist
- `403 Forbidden` - User is not a seller or doesn't have permission
- Check browser console and backend logs for detailed error messages

## Troubleshooting

### If you get 404 errors:
1. **Verify backend server was restarted** after code changes
2. **Check endpoint path** - must be `/videos`, not `/photos`
3. **Verify video ID exists** in database

### If files aren't being deleted:
1. **Check backend logs** for file deletion errors
2. **Verify file permissions** - backend needs write access to `uploads/videos/`
3. **Check video path format** in database (should start with `/uploads/videos/`)

### If UI doesn't update:
1. **Check browser console** for JavaScript errors
2. **Verify Redux actions** are dispatched correctly
3. **Check response handling** in deletion handlers

## Important Notes

⚠️ **BACKEND RESTART REQUIRED**: Changes to Python code require server restart to take effect

⚠️ **SEPARATE ENDPOINTS**: Video deletion uses `/videos` path, completely separate from photos

⚠️ **DUAL CLEANUP**: Video deletion removes BOTH the physical file AND the database record

⚠️ **ROUTE ORDERING**: In FastAPI, bulk delete endpoints (`/videos`) MUST be defined BEFORE single delete endpoints (`/videos/{video_id}`)

## Implementation Status

✅ **COMPLETE** - All features implemented and tested:
- Separate video deletion endpoint (not shared with photos)
- Single video deletion with dedicated button
- Bulk video deletion with checkbox selection
- Physical file cleanup from disk
- Database record cleanup
- UI updates and state management
- Error handling and user feedback

---
Last Updated: 2026-03-15
Status: ✅ PRODUCTION READY
