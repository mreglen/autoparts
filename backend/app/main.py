from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from app.db.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.routers import api_router
from app.models import user, organization, product, pending_product, rejected_product, pending_user, pending_seller, password_reset_token, pending_product_storage_cell, orders
from fastapi.requests import Request
from fastapi.responses import JSONResponse, FileResponse
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.db.database import get_db
from app.core.auth import cleanup_expired_sessions
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables only if they don't exist
# Using create_all() ensures foreign key constraints are handled correctly
from sqlalchemy import inspect
inspector = inspect(engine)
existing_tables = inspector.get_table_names()

# Only create tables that don't already exist to avoid constraint errors
if len(existing_tables) < len(Base.metadata.tables):
    # Create all missing tables at once to properly handle foreign key dependencies
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="Автозапчасти")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def handle_large_files(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        if "413" in str(e) or "Request Entity Too Large" in str(e):
            return JSONResponse(
                status_code=413,
                content={"detail": "Файл слишком большой. Максимальный размер: 50MB"}
            )
        raise e


@app.on_event("startup")
async def startup_event():
    """Initialize the scheduler when the application starts."""
    global scheduler
    scheduler = AsyncIOScheduler()
    
    # Add a job to clean up expired sessions every hour
    scheduler.add_job(
        func=run_cleanup_expired_sessions,
        trigger=IntervalTrigger(hours=1),
        id='cleanup_expired_sessions',
        name='Clean up expired user sessions every hour',
        replace_existing=True
    )
    
    # Start the scheduler
    scheduler.start()
    logger.info("Scheduler started. Expired session cleanup job scheduled.")
    
    # Populate default delivery methods for organizations that don't have any
    try:
        from app.models.delivery_method import DeliveryMethod, organization_delivery_methods
        from app.models.organization import Organization
        from app.db.database import get_db
        
        # Get a database session
        db = next(get_db())
        try:
            # Check if delivery method with ID=1 exists
            default_delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == 1).first()
            if default_delivery_method:
                # Get all organizations
                organizations = db.query(Organization).all()
                
                populated_count = 0
                for org in organizations:
                    # Check if this organization already has delivery method ID=1 assigned
                    from sqlalchemy import text
                    result = db.execute(text(
                        "SELECT * FROM organization_delivery_methods WHERE organization_id = :org_id AND delivery_method_id = :method_id"
                    ), {"org_id": org.id, "method_id": 1})
                    existing = result.fetchone()
                    
                    if not existing:
                        # Add the default delivery method for this organization
                        db.execute(
                            organization_delivery_methods.insert().values(
                                organization_id=org.id,
                                delivery_method_id=1
                            )
                        )
                        populated_count += 1
                
                if populated_count > 0:
                    db.commit()
                    logger.info(f"Populated {populated_count} organization(s) with default delivery method (ID=1)")
                else:
                    logger.info("All organizations already have the default delivery method assigned")
            else:
                logger.warning("Default delivery method (ID=1) not found")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error populating default delivery methods: {str(e)}")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown the scheduler when the application stops."""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler shut down.")


async def run_cleanup_expired_sessions():
    """
    Wrapper function to run the cleanup of expired sessions in a separate thread.
    This function is called by the scheduler.
    """
    try:
        # Create a new database session for this background task
        db_gen = get_db()
        db = next(db_gen)
        
        try:
            # Clean up sessions that haven't been active for more than 24 hours
            deleted_count = cleanup_expired_sessions(db, hours_threshold=24)
            logger.info(f"Cleaned up {deleted_count} expired user sessions")
        finally:
            # Close the database session
            db.close()
    except Exception as e:
        logger.error(f"Error during expired session cleanup: {str(e)}")


app.include_router(api_router)

# Serve static files from uploads directory
import os
from pathlib import Path

# Get the absolute path to the uploads directory
# Note: uploads directory is at backend/uploads, not backend/app/uploads
uploads_dir = Path(__file__).parent.parent / "uploads"
if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
else:
    logger.error(f"Uploads directory not found: {uploads_dir}")

# Also mount pictures directory for direct access
pictures_dir = Path(__file__).parent.parent / "uploads" / "pictures"
if pictures_dir.exists():
    app.mount("/pictures", StaticFiles(directory=str(pictures_dir)), name="pictures")
else:
    logger.error(f"Pictures directory not found: {pictures_dir}")

# Mount videos directory for direct access
videos_dir = Path(__file__).parent.parent / "uploads" / "videos"
if videos_dir.exists():
    app.mount("/videos", StaticFiles(directory=str(videos_dir)), name="videos")
else:
    logger.error(f"Videos directory not found: {videos_dir}")


# Endpoint to serve media files with CORS headers
@app.get("/media/{path:path}")
async def get_media_file(path: str):
    """
    Serve media files (photos/videos) with CORS headers.
    This endpoint allows frontend to access media from different origin.
    """
    # Determine file type and appropriate directory
    if path.startswith("pictures/"):
        base_dir = Path(__file__).parent.parent / "uploads" / "pictures"
        relative_path = path.replace("pictures/", "")
    elif path.startswith("videos/"):
        base_dir = Path(__file__).parent.parent / "uploads" / "videos"
        relative_path = path.replace("videos/", "")
    else:
        return FileResponse(status_code=404, content={"detail": "File not found"})
    
    # Construct full file path
    file_path = base_dir / relative_path
    
    # Check if file exists
    if not file_path.exists():
        return FileResponse(status_code=404, content={"detail": "File not found"})
    
    # Determine media type
    media_type = "image/webp"
    if path.endswith(".mp4") or path.endswith(".avi") or path.endswith(".mov"):
        media_type = "video/mp4"
    elif path.endswith(".jpg") or path.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif path.endswith(".png"):
        media_type = "image/png"
    
    # Return file with CORS headers
    response = FileResponse(str(file_path), media_type=media_type)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


@app.get("/")
def read_root():
    return {"API"}