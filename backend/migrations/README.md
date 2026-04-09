# Chat System Migrations

This directory contains SQL migrations for the chat system.

## Migration Files

### 1. `fix_chat_media_is_processing_null.sql` (CRITICAL)
**Purpose:** Fixes Pydantic validation errors when loading chat messages

**Run this if:**
- Getting 500 Internal Server Error when loading messages
- Error: `is_processing - Input should be a valid boolean`
- Chat media stuck in "processing" state

**What it does:**
- Sets all NULL `is_processing` values to FALSE
- Adds DEFAULT FALSE constraint to prevent future NULL values

**How to run:**
```bash
# Using psql
psql -U your_username -d your_database -f backend/migrations/fix_chat_media_is_processing_null.sql

# Or copy-paste into your database management tool
```

---

### 2. `chat_system_complete.sql` (RECOMMENDED)
**Purpose:** Complete chat system setup with performance optimizations

**Includes:**
- All fixes from `fix_chat_media_is_processing_null.sql`
- Performance indexes for faster queries
- Verification queries to check data integrity

**Run this if:**
- Setting up chat system for the first time
- Want to optimize chat performance
- Want to ensure data integrity

**How to run:**
```bash
psql -U your_username -d your_database -f backend/migrations/chat_system_complete.sql
```

---

## Related Backend Code Changes

### Files Modified:
1. `backend/app/routers/chats.py`
   - Fixed `chat_media_tasks` import error (line 384)
   - Added NULL-safe `is_processing` handling (lines 193, 423)
   - Added error handling for Celery task dispatch (lines 386-403)
   - Added `db.commit()` for documents (line 401)

2. `backend/app/tasks/chat_media_tasks.py`
   - No changes needed (already handles is_processing correctly)

---

## Verification

After running migrations, verify everything works:

1. **Check for NULL values:**
```sql
SELECT COUNT(*) FROM chat_media WHERE is_processing IS NULL;
-- Should return 0
```

2. **Check indexes:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('chat_media', 'messages')
ORDER BY tablename;
```

3. **Test chat loading:**
- Open browser to `/chats`
- Check no 500 errors in browser console
- Check backend logs for successful message loading

---

## Troubleshooting

### Error: "is_processing - Input should be a valid boolean"
**Solution:** Run `fix_chat_media_is_processing_null.sql`

### Error: "NameError: name 'chat_media_tasks' is not defined"
**Solution:** Already fixed in code - restart backend server

### Media stuck in "processing" state
**Solutions:**
1. Ensure Celery worker is running: `celery -A app.celery_app worker --loglevel=info`
2. Run `fix_chat_media_is_processing_null.sql` to reset stuck items
3. Check Celery logs for task errors

---

## Database Schema Reference

### chat_media table
```sql
CREATE TABLE chat_media (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id),
    media_type VARCHAR(50),
    file_path TEXT,
    thumbnail_path TEXT,
    original_filename TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    duration FLOAT,
    is_processing BOOLEAN DEFAULT FALSE,  -- <-- Fixed to have DEFAULT
    created_at TIMESTAMP DEFAULT NOW()
);
```

### messages table
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER REFERENCES chats(id),
    sender_id INTEGER REFERENCES users(id),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```
