from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.db.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.routers import api_router
from app.models import user, organization, product, pending_product, rejected_product, pending_user, pending_seller, password_reset_token, pending_product_storage_cell, orders
from fastapi.requests import Request
from fastapi.responses import JSONResponse
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.db.database import get_db
from app.core.auth import cleanup_expired_sessions
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables only if they don't exist
from sqlalchemy import inspect
inspector = inspect(engine)
existing_tables = inspector.get_table_names()

# Only create tables that don't already exist to avoid constraint errors
for table_name, table in Base.metadata.tables.items():
    if table_name not in existing_tables:
        table.create(bind=engine)

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

# Removed local uploads directory mount, using S3 for file storage
# app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def read_root():
    return {"API"}