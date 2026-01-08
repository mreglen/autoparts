from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .db.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.routers import api_router
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
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://vm2512296768.vds.ru",
        "https://vm2512296768.vds.ru",
        "http://195.24.65.251",
        "https://195.24.65.251"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"API"}