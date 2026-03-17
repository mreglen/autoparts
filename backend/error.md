[2026-03-17 19:29:10,883: INFO/MainProcess] Task app.tasks.video_tasks.process_and_upload_video[cabdb5c4-94d4-47dc-ae75-fe643c1d9262] received
[2026-03-17 19:29:10,917: WARNING/MainProcess] === VIDEO PROCESSING TASK STARTED ===
[2026-03-17 19:29:10,918: WARNING/MainProcess] Task ID: cabdb5c4-94d4-47dc-ae75-fe643c1d9262
[2026-03-17 19:29:10,918: WARNING/MainProcess] Temp file path: C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\uploads\temp\qMHbBIoD51\5e1a776e129a430aa8362c7af5fd8290.mp4
[2026-03-17 19:29:10,919: WARNING/MainProcess] Absolute temp path: C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\uploads\temp\qMHbBIoD51\5e1a776e129a430aa8362c7af5fd8290.mp4
[2026-03-17 19:29:10,919: WARNING/MainProcess] Original filename: qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:10,920: WARNING/MainProcess] Organization ID: qMHbBIoD51
[2026-03-17 19:29:10,920: WARNING/MainProcess] Current working directory: C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend
[2026-03-17 19:29:10,921: WARNING/MainProcess] ✓ Temp file exists, size: 51,293,790 bytes
[2026-03-17 19:29:10,990: WARNING/MainProcess] Video duration: 28.78 seconds
[2026-03-17 19:29:10,990: WARNING/MainProcess] Generated final filename: qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:10,990: WARNING/MainProcess] Upload directory: uploads\videos\qMHbBIoD51
[2026-03-17 19:29:10,991: WARNING/MainProcess] Final path: uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:10,991: WARNING/MainProcess] ⚡ Compressing video (MAXIMUM SPEED)...
[2026-03-17 19:29:10,992: WARNING/MainProcess] CPU cores: 16, Using threads: 4        
[2026-03-17 19:29:11,051: WARNING/MainProcess] Running FFmpeg command: C:\ffmpeg\bin\ffmpeg.exe -i C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\uploads\temp\qMHbBIoD51\5e1a776e129a430aa8362c7af5fd8290.mp4 -vcodec libx264 -acodec aac -b:v 800k -b:a 64k -preset ultrafast -crf 28 -movflags +faststart -pix_fmt yuv420p -threads 4 -tune zerolatency -y uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:15,970: WARNING/MainProcess] ✓ Video compressed successfully: uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:15,972: WARNING/MainProcess]   Original size: 48.92 MB
[2026-03-17 19:29:15,973: WARNING/MainProcess]   Compressed size: 26.52 MB
[2026-03-17 19:29:15,974: WARNING/MainProcess] ⏱ Compression completed in: 4.98 seconds
[2026-03-17 19:29:15,976: WARNING/MainProcess] 📊 Original size: 48.92 MB
[2026-03-17 19:29:15,976: WARNING/MainProcess] 📊 Compressed size: 26.52 MB
[2026-03-17 19:29:15,977: WARNING/MainProcess] 📊 Compression ratio: 45.8%
[2026-03-17 19:29:15,978: WARNING/MainProcess] 📈 Speed: 9.82 MB/sec
[2026-03-17 19:29:15,980: WARNING/MainProcess] ✓ Video compressed successfully        
[2026-03-17 19:29:15,981: WARNING/MainProcess]   Compressed file: uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:15,983: WARNING/MainProcess]   Size: 26.52 MB
[2026-03-17 19:29:15,984: WARNING/MainProcess] Applying watermark to video...
[2026-03-17 19:29:15,985: WARNING/MainProcess]   Logo path: uploads/logo_organizations/qMHbBIoD51/qMHbBIoD51_20260316_205701_qMHbBIoD51_20260316_205655_2f975863.webp       
[2026-03-17 19:29:15,986: WARNING/MainProcess]   Logo exists: True
[2026-03-17 19:29:15,991: WARNING/MainProcess] Running FFmpeg watermark command: C:\ffmpeg\bin\ffmpeg.exe -i uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4 -i uploads/logo_organizations/qMHbBIoD51/qMHbBIoD51_20260316_205701_qMHbBIoD51_20260316_205655_2f975863.webp -filter_complex [1:v]scale=iw*0.5:-1[wm];[0:v][wm]overlay=W-w-20:H-h-20:format=auto -c:v libx264 -c:a aac -preset medium -crf 28 -y C:\Users\khram\AppData\Local\Temp\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0_watermarked.mp4
[2026-03-17 19:29:28,356: WARNING/MainProcess] ✓ Watermark applied to video successfully: C:\Users\khram\AppData\Local\Temp\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0_watermarked.mp4
[2026-03-17 19:29:28,357: WARNING/MainProcess]   Input video: uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:28,357: WARNING/MainProcess]   Logo: uploads/logo_organizations/qMHbBIoD51/qMHbBIoD51_20260316_205701_qMHbBIoD51_20260316_205655_2f975863.webp
[2026-03-17 19:29:28,357: WARNING/MainProcess]   Output: C:\Users\khram\AppData\Local\Temp\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0_watermarked.mp4
[2026-03-17 19:29:28,357: WARNING/MainProcess]   Opacity: 50.0%
[2026-03-17 19:29:28,357: WARNING/MainProcess]   Position: Bottom-right with 20px padding
[2026-03-17 19:29:28,382: WARNING/MainProcess] Moved watermarked video to: uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:28,383: WARNING/MainProcess] ✓ Watermark applied successfully
[2026-03-17 19:29:28,383: WARNING/MainProcess] Keeping temp file available for fallback: C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\uploads\temp\qMHbBIoD51\5e1a776e129a430aa8362c7af5fd8290.mp4
[2026-03-17 19:29:28,383: WARNING/MainProcess] ✓ Video saved successfully!
[2026-03-17 19:29:28,383: WARNING/MainProcess]   Final path: uploads\videos\qMHbBIoD51\qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:28,383: WARNING/MainProcess]   Media URL path: /videos/qMHbBIoD51/qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:28,383: WARNING/MainProcess]
🔄 Starting database update for video 37...
[2026-03-17 19:29:28,384: WARNING/MainProcess]    Media path: /videos/qMHbBIoD51/qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4
[2026-03-17 19:29:28,384: WARNING/MainProcess]    Status: completed
[2026-03-17 19:29:28,533: WARNING/MainProcess]    Creating DB engine...
[2026-03-17 19:29:28,533: WARNING/MainProcess]    DATABASE_URL: postgresql://postgres:root@localhost/autoparts...
[2026-03-17 19:29:28,584: WARNING/MainProcess] 
❌ FATAL: Error updating database: name 'sessionmaker' is not defined
[2026-03-17 19:29:28,586: WARNING/MainProcess] Full DB error traceback:
Traceback (most recent call last):
  File "C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\app\tasks\video_tasks.py", line 219, in process_and_upload_video
    SessionLocalDirect = sessionmaker(bind=engine, autocommit=False, autoflush=False) 
                         ^^^^^^^^^^^^
NameError: name 'sessionmaker' is not defined
[2026-03-17 19:29:28,586: WARNING/MainProcess] ⚠️ Video file saved but database NOT uppdated - manual fix may be required!
[2026-03-17 19:29:29,101: WARNING/MainProcess] ⚠️ Attempt 1/3 failed - file busy, retrrying in 1s...
[2026-03-17 19:29:30,113: WARNING/MainProcess] ⚠️ Attempt 2/3 failed - file busy, retrrying in 1s...
[2026-03-17 19:29:31,115: WARNING/MainProcess] ⚠️ Warning: Could not delete temp file  after 3 attempts: [WinError 32] Процесс не может получить доступ к файлу, так как этот файл занят другим процессом: 'C:\\Users\\khram\\OneDrive\\Рабочий стол\\autoparts\\backend\\uploads\\temp\\qMHbBIoD51\\5e1a776e129a430aa8362c7af5fd8290.mp4'
[2026-03-17 19:29:31,116: WARNING/MainProcess]    File will be cleaned up by cleanup task later
[2026-03-17 19:29:31,118: INFO/MainProcess] Task app.tasks.video_tasks.process_and_upload_video[cabdb5c4-94d4-47dc-ae75-fe643c1d9262] succeeded in 20.229257299972232s: {'temp_path': '/temp/qMHbBIoD51/5e1a776e129a430aa8362c7af5fd8290.mp4', 'path': '/videos/qMHbBIoD51/qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4', 'url': 'http://127.0.0.1:8000/videos/qMHbBIoD51/qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4', 'status': 'success', 'filename': 'qMHbBIoD51_20260317_192910_qMHbBIoD51_20260317_192908_2e349dc0.mp4', 'organization_id': 'qMHbBIoD51', 'duration': 28.784224, 'processing_complete': True}
