# Fix Summary: Avito Photo URLs on svoygarage.ru

## Problem
Photos were not displaying in Avito exports after deploying to svoygarage.ru hosting.

## Root Causes Found

### 1. **PUBLIC_BASE_URL had `/server/` suffix**
**File**: `backend/.env` (line 36)

**Before**:
```env
PUBLIC_BASE_URL = 'https://svoygarage.ru/server/'
```

**After**:
```env
PUBLIC_BASE_URL = 'https://svoygarage.ru'
```

**Why**: 
- `/server/` is only for API proxy in nginx
- Photos are served from root domain: `https://svoygarage.ru/uploads/pictures/...`
- PUBLIC_BASE_URL should be the root domain without paths

---

### 2. **Photo paths missing `/uploads/` prefix**
**File**: `backend/app/tasks/photo_tasks.py` (line 247-252)

**Before**:
```python
# Add /uploads prefix only for logo_organizations subfolder
if subfolder == "logo_organizations":
    media_path = f"/uploads/{subfolder}/{organization_id}/{final_filename}"
else:
    media_path = f"/{subfolder}/{organization_id}/{final_filename}"
```

This created paths like:
- `/pictures/qMHbBIoD51/photo.webp` ❌ WRONG
- `/videos/qMHbBIoD51/video.mp4` ❌ WRONG

**After**:
```python
# IMPORTANT: All media paths must start with /uploads/ because nginx serves them from there
# nginx location /uploads/ -> /home/fast/autoparts/backend/uploads/
media_path = f"/uploads/{subfolder}/{organization_id}/{final_filename}"
```

Now creates paths like:
- `/uploads/pictures/qMHbBIoD51/photo.webp` ✅ CORRECT
- `/uploads/videos/qMHbBIoD51/video.mp4` ✅ CORRECT

**Why**:
- nginx serves static files from `/uploads/` location
- nginx config: `location /uploads/ { alias /home/fast/autoparts/backend/uploads/; }`
- All media must be accessed via `/uploads/...` URLs

---

### 3. **Added documentation to normalize_for_xlsx**
**File**: `backend/app/services/avito_media.py` (line 60-81)

Added comprehensive docstring explaining:
- How local media paths are handled
- How external URLs are passed through
- That PUBLIC_BASE_URL should be root domain, not API path

---

## Nginx Configuration (Already Correct)

The nginx config was already properly set up:

```nginx
# Line 163-167 in nginx-config-fixed.conf
location /uploads/ {
    alias /home/fast/autoparts/backend/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

This means:
- URL: `https://svoygarage.ru/uploads/pictures/qMHbBIoD51/photo.webp`
- Serves from: `/home/fast/autoparts/backend/uploads/pictures/qMHbBIoD51/photo.webp`

---

## What Changed in URLs

### Before Fix:
1. Photo stored in DB as: `/pictures/qMHbBIoD51/photo.webp`
2. normalize_for_xlsx creates: `https://svoygarage.ru/server/pictures/qMHbBIoD51/photo.webp`
3. nginx tries to find this path → **404 Not Found** ❌

### After Fix:
1. Photo stored in DB as: `/uploads/pictures/qMHbBIoD51/photo.webp`
2. normalize_for_xlsx creates: `https://svoygarage.ru/uploads/pictures/qMHbBIoD51/photo.webp`
3. nginx serves from: `/home/fast/autoparts/backend/uploads/pictures/qMHbBIoD51/photo.webp` → **Success!** ✅

---

## Deployment Steps

### On your hosting server (svoygarage.ru):

1. **Update .env file**:
   ```bash
   cd /home/fast/autoparts/backend
   nano .env
   ```
   
   Change line 36:
   ```env
   PUBLIC_BASE_URL = 'https://svoygarage.ru'
   ```

2. **Deploy updated code**:
   ```bash
   # Pull latest code (if using git)
   cd /home/fast/autoparts
   git pull
   
   # OR upload files manually via FTP/SCP
   ```

3. **Restart backend service**:
   ```bash
   # If using systemctl
   systemctl restart autoparts-backend
   
   # OR if using supervisor
   supervisorctl restart autoparts-backend
   
   # OR if running manually
   # Kill old process and restart:
   cd /home/fast/autoparts/backend
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
   ```

4. **Restart Celery worker** (important for new photo uploads):
   ```bash
   systemctl restart celery-worker
   # OR
   supervisorctl restart celery
   ```

---

## Testing

### 1. Test photo URL directly:
```bash
# Should return 200 OK with image
curl -I https://svoygarage.ru/uploads/pictures/qMHbBIoD51/test.webp
```

### 2. Check existing photos in database:
```sql
-- Check current photo paths
SELECT id, product_id, photo_url 
FROM product_photos 
WHERE organization_id = 'qMHbBIoD51'
LIMIT 10;
```

**Expected**: Paths should start with `/uploads/pictures/`

**If they start with `/pictures/`** (old format), you need to update them:
```sql
-- Fix old photo paths (add /uploads/ prefix)
UPDATE product_photos 
SET photo_url = CONCAT('/uploads', photo_url)
WHERE organization_id = 'qMHbBIoD51'
  AND photo_url LIKE '/pictures/%'
  AND photo_url NOT LIKE '/uploads/%';

-- Fix old video paths
UPDATE product_videos 
SET video_url = CONCAT('/uploads', video_url)
WHERE organization_id = 'qMHbBIoD51'
  AND video_url LIKE '/videos/%'
  AND video_url NOT LIKE '/uploads/%';
```

### 3. Test Avito export:
1. Go to `/my-parts` on svoygarage.ru
2. Select some products with photos
3. Click "Действия" → "Экспорт в Avito"
4. Wait for export to complete
5. Download the XLSX file
6. Open it and check the `ImageUrls` column
7. URLs should be: `https://svoygarage.ru/uploads/pictures/qMHbBIoD51/...`

### 4. Verify URLs work:
Copy a URL from XLSX and paste in browser:
```
https://svoygarage.ru/uploads/pictures/qMHbBIoD51/your_photo.webp
```

Should display the photo ✅

---

## Important Notes

1. **Existing photos**: Photos uploaded BEFORE this fix have old paths in DB (`/pictures/...`). They need to be updated with the SQL query above.

2. **New photos**: Photos uploaded AFTER this fix will have correct paths (`/uploads/pictures/...`).

3. **Avito cache**: If you already exported to Avito with wrong URLs, you need to:
   - Fix the photo paths in DB
   - Re-export products to Avito
   - Upload new XLSX to Avito

4. **No data loss**: This fix only changes URL paths, not the actual photo files. All files are safe in `/home/fast/autoparts/backend/uploads/`.

---

## Files Modified

1. ✅ `backend/.env` - Fixed PUBLIC_BASE_URL
2. ✅ `backend/app/tasks/photo_tasks.py` - Fixed media_path to include `/uploads/`
3. ✅ `backend/app/services/avito_media.py` - Added documentation

---

## Summary

The issue was that photo URLs were being generated incorrectly:
- Missing `/uploads/` prefix in database paths
- Wrong PUBLIC_BASE_URL with `/server/` suffix

After this fix:
- All photo URLs will be: `https://svoygarage.ru/uploads/pictures/{org_id}/{filename}.webp`
- nginx will correctly serve the files
- Avito exports will have working photo links
