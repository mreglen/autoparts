from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.db.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.routers import api_router
# Import models to register them with SQLAlchemy
from app.models import user, organization, product, pending_user, pending_seller, password_reset_token
from fastapi.requests import Request
from fastapi.responses import JSONResponse
import uvicorn

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Автозапчасти")

# Middleware для обработки больших файлов
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

app.include_router(api_router)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"API"}