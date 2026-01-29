import os
from dotenv import load_dotenv

load_dotenv()

# Social Login Credentials (Retrieved from TwinVerse)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")

KAKAO_CLIENT_ID = os.getenv("KAKAO_CLIENT_ID")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET")
# Solapi (Kakao AlimTalk) Credentials
SOLAPI_API_KEY = os.getenv("SOLAPI_API_KEY", "ENTER_YOUR_API_KEY")
SOLAPI_API_SECRET = os.getenv("SOLAPI_API_SECRET", "ENTER_YOUR_API_SECRET")
SOLAPI_PFID = os.getenv("SOLAPI_PFID", "ENTER_YOUR_PFID") # Kakao Channel PFID

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173") # Can be 5174 in some cases
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
