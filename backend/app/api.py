from fastapi import APIRouter
from .api_compiler import router as compiler_router
from pydantic import BaseModel

router = APIRouter()

class HealthResp(BaseModel):
    status: str

@router.get('/health', response_model=HealthResp)
def health():
    return {"status":"ok"}

# include subrouters
router.include_router(compiler_router, prefix='/compiler', tags=['compiler'])
from .api_auth import router as auth_router
router.include_router(auth_router, prefix='/auth', tags=['auth'])

@router.get('/curriculum/sample')
def get_sample_curriculum():
    try:
        with open('curriculum/ncert_sample.json','r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
