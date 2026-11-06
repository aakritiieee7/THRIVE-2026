from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import api
from .db import init_db

app = FastAPI(
    title='THRIVE Backend',
    description='Teacher Hub for Resources, Instruction, Verified Information & Empowerment',
    version='0.2.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # dev convenience; tighten to the deployed frontend origin in production
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.on_event('startup')
def _startup():
    init_db()


app.include_router(api.router)


@app.get('/')
def root():
    return {'message': 'THRIVE backend is running', 'docs': '/docs'}
