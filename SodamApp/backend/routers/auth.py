from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import httpx
from sqlmodel import select
from models import User
from services.database_service import DatabaseService
import config

import os

# Configuration - Load from environment variables for security
_DEFAULT_SECRET = "sodam_fn_dev_only_change_in_production"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", _DEFAULT_SECRET)
if SECRET_KEY == _DEFAULT_SECRET:
    import warnings
    warnings.warn(
        "⚠️  JWT_SECRET_KEY 환경변수가 설정되지 않아 기본값을 사용합니다. "
        "운영 환경에서는 반드시 안전한 키를 설정하세요!",
        stacklevel=2,
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

router = APIRouter()

# --- Auth Classes ---

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    real_name: Optional[str] = None

# --- Helper Functions ---

def verify_password(plain_password, hashed_password):
    if not hashed_password: return False
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    service = DatabaseService()
    try:
        stmt = select(User).where(User.username == token_data.username)
        user = service.session.exec(stmt).first()
        if user is None:
            raise credentials_exception
        return user
    finally:
        service.close()

def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_or_create_social_user(provider: str, provider_id: str, email: str, real_name: str, profile_image: str):
    service = DatabaseService()
    try:
        # Check if user exists by provider_id
        stmt = select(User).where(User.provider == provider, User.provider_id == provider_id)
        user = service.session.exec(stmt).first()
        
        if not user and email:
            # Check by email (link to existing local account if possible)
            stmt = select(User).where(User.email == email)
            user = service.session.exec(stmt).first()
            if user:
                # Link social account to existing user
                user.provider = provider
                user.provider_id = provider_id
                user.profile_image = profile_image
                service.session.add(user)
                service.session.commit()
                service.session.refresh(user)

        if not user:
            # Create new user
            username = f"{provider}_{provider_id}"
            user = User(
                username=username,
                email=email,
                real_name=real_name,
                profile_image=profile_image,
                provider=provider,
                provider_id=provider_id,
                role="staff",
                grade="normal"
            )
            service.session.add(user)
            service.session.commit()
            service.session.refresh(user)
            
        return user
    finally:
        service.close()

# --- Registration Endpoint ---

@router.post("/signup")
async def signup(user_data: UserCreate):
    service = DatabaseService()
    try:
        # Check if user already exists
        stmt = select(User).where(User.username == user_data.username)
        existing_user = service.session.exec(stmt).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
        
        # Create new user
        new_user = User(
            username=user_data.username,
            hashed_password=get_password_hash(user_data.password),
            email=user_data.email,
            real_name=user_data.real_name,
            role="staff",
            grade="normal"
        )
        service.session.add(new_user)
        service.session.commit()
        service.session.refresh(new_user)
        return {"message": "회원가입이 완료되었습니다.", "user_id": new_user.id}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()  # Log internally for debugging
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.")
    finally:
        service.close()

# --- Standard Login Endpoint ---

@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    service = DatabaseService()
    try:
        stmt = select(User).where(User.username == form_data.username)
        user = service.session.exec(stmt).first()
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user.username, 
                "role": user.role, 
                "grade": user.grade,
                "real_name": user.real_name,
                "profile_image": user.profile_image,
                "staff_id": user.staff_id, 
                "user_id": user.id
            }, 
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    finally:
        service.close()

# --- Social Login Endpoints ---

@router.get("/google")
async def google_login():
    url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={config.GOOGLE_CLIENT_ID}&redirect_uri={config.BACKEND_URL}/api/auth/google/callback&response_type=code&scope=openid%20email%20profile"
    return RedirectResponse(url)

@router.get("/google/callback")
async def google_callback(code: str):
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": f"{config.BACKEND_URL}/api/auth/google/callback"
        })
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        
        user_res = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={
            "Authorization": f"Bearer {access_token}"
        })
        user_info = user_res.json()
        
        user = await get_or_create_social_user(
            provider="google",
            provider_id=user_info.get("sub"),
            email=user_info.get("email"),
            real_name=user_info.get("name"),
            profile_image=user_info.get("picture")
        )
        
        app_token = create_access_token(data={
            "sub": user.username, 
            "role": user.role, 
            "grade": user.grade,
            "real_name": user.real_name,
            "profile_image": user.profile_image,
            "staff_id": user.staff_id, 
            "user_id": user.id
        })
        return RedirectResponse(url=f"{config.FRONTEND_URL}/login?token={app_token}")

@router.get("/naver")
async def naver_login():
    url = f"https://nid.naver.com/oauth2.0/authorize?client_id={config.NAVER_CLIENT_ID}&redirect_uri={config.BACKEND_URL}/api/auth/naver/callback&response_type=code&state=sodam"
    return RedirectResponse(url)

@router.get("/naver/callback")
async def naver_callback(code: str, state: str):
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://nid.naver.com/oauth2.0/token", data={
            "client_id": config.NAVER_CLIENT_ID,
            "client_secret": config.NAVER_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "state": state
        })
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        
        user_res = await client.get("https://openapi.naver.com/v1/nid/me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        user_info = user_res.json().get("response")
        
        user = await get_or_create_social_user(
            provider="naver",
            provider_id=user_info.get("id"),
            email=user_info.get("email"),
            real_name=user_info.get("name"),
            profile_image=user_info.get("profile_image")
        )
        
        app_token = create_access_token(data={
            "sub": user.username, 
            "role": user.role, 
            "grade": user.grade,
            "real_name": user.real_name,
            "profile_image": user.profile_image,
            "staff_id": user.staff_id, 
            "user_id": user.id
        })
        return RedirectResponse(url=f"{config.FRONTEND_URL}/login?token={app_token}")

@router.get("/kakao")
async def kakao_login():
    url = f"https://kauth.kakao.com/oauth/authorize?client_id={config.KAKAO_CLIENT_ID}&redirect_uri={config.BACKEND_URL}/api/auth/kakao/callback&response_type=code"
    return RedirectResponse(url)

@router.get("/kakao/callback")
async def kakao_callback(code: str):
    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://kauth.kakao.com/oauth/token", data={
            "client_id": config.KAKAO_CLIENT_ID,
            "client_secret": config.KAKAO_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": f"{config.BACKEND_URL}/api/auth/kakao/callback"
        })
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        
        user_res = await client.get("https://kapi.kakao.com/v2/user/me", headers={
            "Authorization": f"Bearer {access_token}"
        })
        user_info = user_res.json()
        kakao_account = user_info.get("kakao_account", {})
        properties = user_info.get("properties", {})
        
        user = await get_or_create_social_user(
            provider="kakao",
            provider_id=str(user_info.get("id")),
            email=kakao_account.get("email"),
            real_name=properties.get("nickname"),
            profile_image=properties.get("profile_image")
        )
        
        app_token = create_access_token(data={
            "sub": user.username, 
            "role": user.role, 
            "grade": user.grade,
            "real_name": user.real_name,
            "profile_image": user.profile_image,
            "staff_id": user.staff_id, 
            "user_id": user.id
        })
        return RedirectResponse(url=f"{config.FRONTEND_URL}/login?token={app_token}")

# --- User Info & Dependency ---

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username, 
        "role": current_user.role, 
        "grade": current_user.grade,
        "real_name": current_user.real_name,
        "profile_image": current_user.profile_image
    }


