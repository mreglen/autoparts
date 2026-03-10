# Read the file
with open(r'backend\app\routers\upload.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the filename pattern
for i in range(len(lines)):
    if 'filename = f"logos/{uuid.uuid4().hex}{ext}"' in lines[i]:
        lines[i] = lines[i].replace('logos/', 'logo_organizations/')

# Find where to insert new endpoint (before @router.get("/photo-status/{task_id}"))
insert_index = None
for i in range(len(lines)):
    if '@router.get("/photo-status/{task_id}")' in lines[i]:
        insert_index = i
        break

if insert_index:
    # Insert 2 blank lines + new endpoint
    new_endpoint_lines = [
        '\n',
        '\n',
        '@router.post("/organization-logo-s3")\n',
        'async def upload_organization_logo_s3(file: UploadFile = File(...)):\n',
        '    """Upload organization logo- S3 compatible endpoint (saves to local storage for now)"""\n',
        '    print(f"=== ORGANIZATION LOGO S3 UPLOAD REQUEST ===")\n',
        '    print(f"Filename: {file.filename}")\n',
        '    print(f"Content-Type: {file.content_type}")\n',
        '    print(f"Headers: {dict(file.headers) if hasattr(file, \'headers\') else \'No headers\'}")\n',
        '\n',
        '    if not file.content_type or not file.content_type.startswith("image/"):\n',
        '        print(f"Rejected: invalid content type {file.content_type}")\n',
        '        print("=== END ORGANIZATION LOGO S3 UPLOAD (REJECTED) ===")\n',
        '        raise HTTPException(400, "Разрешены только изображения")\n',
        '\n',
        '    # Check file size before upload\n',
        '    file_content = await file.read()\n',
        '    file_size = len(file_content)\n',
        '\n',
        '    if file_size > MAX_PHOTO_SIZE:\n',
        '        raise HTTPException(\n',
        '           413,\n',
        '            f"Файл слишком большой. Размер: {file_size/1024/1024:.1f}MB. Максимальный размер: {MAX_PHOTO_SIZE/1024/1024}MB"\n',
        '        )\n',
        '\n',
        '    # Return file pointer to the beginning for re-reading\n',
        '   await file.seek(0)\n',
        '\n',
        '    # Get file extension\n',
        '    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""\n',
        '\n',
        '    # Allowed image formats\n',
        '    allowed_extensions = (\n',
        '        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif", ".jfif-tbn",\n',
        '        ".heic", ".heif", ".tiff", ".tif", ".bmp", ".svg", ".ico",\n',
        '        ".raw", ".cr2", ".nef", ".arw", ".dng", ".orf", ".rw2"\n',
        '    )\n',
        '\n',
        '    # Validate file extension\n',
        '    if ext and ext not in allowed_extensions:\n',
        '        raise HTTPException(400, "Недопустимый формат изображения")\n',
        '\n',
        '    # Validate MIME type\n',
        '    allowed_mime_types = (\n',
        '        "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",\n',
        '        "image/bmp", "image/tiff", "image/x-icon", "image/heic", "image/heif"\n',
        '    )\n',
        '\n',
        '    if file.content_type not in allowed_mime_types:\n',
        '        if not ext:\n',
        '            raise HTTPException(400, "Недопустимый тип файла")\n',
        '\n',
        '    filename = f"logo_organizations/{uuid.uuid4().hex}{ext}"\n',
        '    \n',
        '    # Save to local storage\n',
        '    upload_path = os.path.join("uploads", filename)\n',
        '    os.makedirs(os.path.dirname(upload_path), exist_ok=True)\n',
        '    \n',
        '    try:\n',
        '        with open(upload_path, \'wb\') as f:\n',
        '            f.write(file_content)\n',
        '        print(f"File uploaded successfully: {upload_path}")\n',
        '        \n',
        '        # Construct URL using BASE_URL\n',
        '        file_url = f"{settings.BASE_URL}{upload_path}"\n',
        '       result = {"url": file_url}\n',
        '        print(f"S3 Upload successful: {result}")\n',
        '        print("=== END ORGANIZATION LOGO S3 UPLOAD ===")\n',
        '       return result\n',
        '    except Exception as e:\n',
        '        print(f"Error uploading file: {str(e)}")\n',
        '        raise HTTPException(500, f"Ошибка при загрузке файла в хранилище: {str(e)}")\n',
    ]
    
    # Insert the new lines
    for j, line in enumerate(new_endpoint_lines):
        lines.insert(insert_index + j, line)

# Write back
with open(r'backend\app\routers\upload.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully added /organization-logo-s3 endpoint!")
