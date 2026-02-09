"""
Geofence Service — GPS 기반 매장 영역 검증
Haversine 공식으로 두 좌표 간 거리를 계산하여 출퇴근 위치를 검증합니다.
"""
import math
from sqlmodel import Session, select
from models import WorkLocation
from database import engine


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    두 GPS 좌표 간의 거리를 미터 단위로 반환합니다.
    (Haversine Formula)
    """
    R = 6371000  # 지구 반지름 (미터)
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c  # 거리 (미터)


def get_active_location(session: Session) -> WorkLocation | None:
    """활성 매장 위치를 조회합니다."""
    return session.exec(
        select(WorkLocation).where(WorkLocation.is_active == True)
    ).first()


def verify_location(lat: float, lng: float, session: Session = None) -> dict:
    """
    직원의 GPS 좌표가 매장 반경 내에 있는지 확인합니다.
    
    Returns:
        {
            "verified": bool,
            "distance": float (미터),
            "radius": int (허용 반경),
            "location_name": str
        }
    """
    close_session = False
    if session is None:
        session = Session(engine)
        close_session = True

    try:
        location = get_active_location(session)
        
        if not location:
            # 매장 위치가 설정되지 않은 경우 → GPS 검증 건너뜀 (허용)
            return {
                "verified": True,
                "distance": 0,
                "radius": 0,
                "location_name": "미설정",
                "message": "매장 위치가 설정되지 않아 GPS 검증을 건너뜁니다."
            }
        
        if location.latitude == 0 and location.longitude == 0:
            # 좌표가 초기값(0,0)인 경우 → 아직 미설정
            return {
                "verified": True,
                "distance": 0,
                "radius": location.radius_meters,
                "location_name": location.name,
                "message": "매장 좌표가 아직 설정되지 않았습니다."
            }
        
        distance = haversine_distance(lat, lng, location.latitude, location.longitude)
        distance_rounded = round(distance, 1)
        verified = distance <= location.radius_meters
        
        return {
            "verified": verified,
            "distance": distance_rounded,
            "radius": location.radius_meters,
            "location_name": location.name,
            "message": (
                f"✅ 매장 반경 내 확인 (거리: {distance_rounded}m)"
                if verified
                else f"❌ 매장 반경 밖입니다 (거리: {distance_rounded}m, 허용: {location.radius_meters}m)"
            )
        }
    finally:
        if close_session:
            session.close()
