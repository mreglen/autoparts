  . app.tasks.video_tasks.process_and_upload_video

[2026-03-10 14:25:32,297: INFO/MainProcess] Connected to redis://:**@127.0.0.1:6379/0
[2026-03-10 14:25:32,302: INFO/MainProcess] mingle: searching for neighbors
[2026-03-10 14:25:33,314: INFO/MainProcess] mingle: all alone
[2026-03-10 14:25:33,325: INFO/MainProcess] celery@vm2512296768 ready.
[2026-03-10 14:26:04,031: INFO/MainProcess] Task app.tasks.video_tasks.process_and_upload_video[02f8c753-fcfc-464f-a738-e8d6b3b69b2f] received
[2026-03-10 14:26:09,071: INFO/MainProcess] Task app.tasks.video_tasks.process_and_upload_video[78c4ef24-b69a-47a1-8d7b-061626f70df0] received
[2026-03-10 14:26:12,359: INFO/MainProcess] Task app.tasks.video_tasks.process_and_upload_video[63bdaa40-0b50-454a-a772-bd37bc1cb93e] received
[2026-03-10 14:26:12,366: WARNING/MainProcess] === VIDEO PROCESSING TASK STARTED ===
[2026-03-10 14:26:12,366: WARNING/MainProcess] Temp file path: uploads/temp/c2f2a605e2ea4e2aa9457e5ba9fb536d.mp4
[2026-03-10 14:26:12,366: WARNING/MainProcess] Absolute temp path: /home/fast/autoparts/backend/uploads/temp/c2f2a605e2ea4e2aa9457e5ba9fb536d.mp4
[2026-03-10 14:26:12,367: WARNING/MainProcess] Original filename: TVgpq7hgzd_20260310_142612_f9c9feda.mp4
[2026-03-10 14:26:12,367: WARNING/MainProcess] Organization ID: TVgpq7hgzd
[2026-03-10 14:26:12,367: WARNING/MainProcess] ✓ Temp file exists, size: 51,293,790 bytes
[2026-03-10 14:26:12,368: WARNING/MainProcess] ✓ File is accessible and readable
[2026-03-10 14:26:12,515: WARNING/MainProcess] Video duration: 28.78 seconds
[2026-03-10 14:26:12,516: WARNING/MainProcess] Generated final filename: TVgpq7hgzd_20260310_142612_f9c9feda.mp4
[2026-03-10 14:26:12,516: WARNING/MainProcess] Upload directory: uploads/videos/TVgpq7hgzd
[2026-03-10 14:26:12,516: WARNING/MainProcess] Final path: uploads/videos/TVgpq7hgzd/TVgpq7hgzd_20260310_142612_f9c9feda.mp4
[2026-03-10 14:26:12,516: WARNING/MainProcess] Compressing video...
[2026-03-10 14:26:12,628: WARNING/MainProcess] Running FFmpeg command: /usr/bin/ffmpeg -i uploads/temp/c2f2a605e2ea4e2aa9457e5ba9fb536d.mp4 -vcodec libx264 -acodec aac -b:v 1500k -b:a 128k -preset medium -crf 28 -movflags +faststart -pix_fmt yuv420p -y uploads/videos/TVgpq7hgzd/TVgpq7hgzd_20260310_142612_f9c9feda.mp4
