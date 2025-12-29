from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .db.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.routers import api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Автозапчасти")

app.include_router(api_router)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.101:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://192.168.0.101:3001"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"API"}