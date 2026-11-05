from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # stub: implement JWT verification
    if token == "test-token":
        return {"id":1, "name":"Test Teacher", "email":"test@example.com"}
    raise HTTPException(status_code=401, detail="Invalid token")
