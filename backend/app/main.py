from fastapi import FastAPI
from . import api

app = FastAPI(title="THRIVE Backend - THRIVE")
app.include_router(api.router)

@app.get('/')
def root():
    return {"message": "THRIVE backend is running"}
