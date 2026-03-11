"""
SuperAdmin Router - 멀티테넌트 플랫폼 관리
SuperAdmin → Admin → Staff 3단계 권한 체계
"""
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func, col
from database import engine
from models import (
    Business, SubscriptionPlan, User, Staff, Revenue, 
    Expense, Payroll, Announcement, MonthlyProfitLoss, Vendor,
    StoreApplication
)
from routers.auth import get_current_user

router = APIRouter()

# --- Auth Helpers ---

def get_superadmin_user(current_user: User = Depends(get_current_user)):
    """SuperAdmin 권한 확인"""
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="SuperAdmin 권한이 필요합니다.")
    return current_user

# --- Pydantic Models ---

class BusinessCreate(BaseModel):
    name: str
    business_number: Optional[str] = None
    business_type: str = "음식점"
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    plan_id: Optional[int] = None

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    business_number: Optional[str] = None
    business_type: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    plan_id: Optional[int] = None
    subscription_status: Optional[str] = None
    is_active: Optional[bool] = None
    settings_json: Optional[str] = None

class PlanCreate(BaseModel):
    name: str
    price_monthly: int = 0
    price_yearly: int = 0
    max_staff: int = 5
    max_revenue_entries: int = 1000
    features_json: Optional[str] = None

class GlobalAnnouncementCreate(BaseModel):
    title: str
    content: str = ""
    pinned: bool = False

# ==========================================
# 1. 매장 (Business) CRUD
# ==========================================

@router.get("/businesses")
def list_businesses(
    status: Optional[str] = None,
    business_type: Optional[str] = None,
    region: Optional[str] = None,
    admin: User = Depends(get_superadmin_user)
):
    """전체 매장 목록 조회 (필터 지원)"""
    with Session(engine) as s:
        stmt = select(Business)
        if status:
            stmt = stmt.where(Business.subscription_status == status)
        if business_type:
            stmt = stmt.where(Business.business_type == business_type)
        if region:
            stmt = stmt.where(Business.region == region)
        businesses = s.exec(stmt.order_by(Business.created_at.desc())).all()
        
        results = []
        for biz in businesses:
            # Count staff and users
            staff_count = s.exec(
                select(func.count(Staff.id)).where(Staff.business_id == biz.id)
            ).one()
            user_count = s.exec(
                select(func.count(User.id)).where(User.business_id == biz.id)
            ).one()
            
            results.append({
                "id": biz.id,
                "name": biz.name,
                "business_number": biz.business_number,
                "business_type": biz.business_type,
                "owner_name": biz.owner_name,
                "phone": biz.phone,
                "address": biz.address,
                "region": biz.region,
                "plan_id": biz.plan_id,
                "subscription_status": biz.subscription_status,
                "is_active": biz.is_active,
                "created_at": str(biz.created_at),
                "staff_count": staff_count,
                "user_count": user_count,
            })
        
        return {"status": "success", "data": results}


@router.post("/businesses")
def create_business(data: BusinessCreate, admin: User = Depends(get_superadmin_user)):
    """새 매장 등록"""
    with Session(engine) as s:
        biz = Business(
            name=data.name,
            business_number=data.business_number,
            business_type=data.business_type,
            owner_name=data.owner_name,
            phone=data.phone,
            address=data.address,
            region=data.region,
            plan_id=data.plan_id,
            subscription_start=date.today(),
        )
        s.add(biz)
        s.commit()
        s.refresh(biz)
        return {"status": "success", "data": {"id": biz.id, "name": biz.name}}


@router.put("/businesses/{business_id}")
def update_business(business_id: int, data: BusinessUpdate, admin: User = Depends(get_superadmin_user)):
    """매장 정보 수정"""
    with Session(engine) as s:
        biz = s.get(Business, business_id)
        if not biz:
            raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
        
        for field, value in data.dict(exclude_unset=True).items():
            setattr(biz, field, value)
        
        s.add(biz)
        s.commit()
        s.refresh(biz)
        return {"status": "success", "data": {"id": biz.id, "name": biz.name}}


@router.delete("/businesses/{business_id}")
def deactivate_business(business_id: int, admin: User = Depends(get_superadmin_user)):
    """매장 해지 (소프트 삭제)"""
    with Session(engine) as s:
        biz = s.get(Business, business_id)
        if not biz:
            raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
        
        biz.is_active = False
        biz.subscription_status = "cancelled"
        biz.subscription_end = date.today()
        s.add(biz)
        s.commit()
        return {"status": "success", "message": f"'{biz.name}' 매장이 해지되었습니다."}


# ==========================================
# 2. 전체 매장 매출/인건비 실시간 모니터링
# ==========================================

@router.get("/monitoring")
def get_monitoring_overview(
    year: int = Query(default=None),
    month: int = Query(default=None),
    admin: User = Depends(get_superadmin_user)
):
    """전체 매장 매출/인건비 모니터링 대시보드"""
    if not year:
        year = date.today().year
    if not month:
        month = date.today().month
    
    with Session(engine) as s:
        businesses = s.exec(select(Business).where(Business.is_active == True)).all()
        
        overview = []
        total_revenue = 0
        total_labor = 0
        total_profit = 0
        
        for biz in businesses:
            # Monthly P/L
            pl = s.exec(
                select(MonthlyProfitLoss).where(
                    MonthlyProfitLoss.year == year,
                    MonthlyProfitLoss.month == month
                )
            ).first()
            
            # Staff count  
            staff_count = s.exec(
                select(func.count(Staff.id)).where(
                    Staff.business_id == biz.id,
                    Staff.status == "재직"
                )
            ).one()
            
            # Revenue for this business (sum from Revenue table)
            biz_revenue = s.exec(
                select(func.coalesce(func.sum(Revenue.amount), 0)).where(
                    Revenue.business_id == biz.id,
                    func.extract('year', Revenue.date) == year,
                    func.extract('month', Revenue.date) == month
                )
            ).one()
            
            # Labor cost (payroll total)
            month_str = f"{year}-{month:02d}"
            biz_labor = s.exec(
                select(func.coalesce(func.sum(Payroll.base_pay + Payroll.bonus_holiday), 0)).where(
                    Payroll.staff_id.in_(
                        select(Staff.id).where(Staff.business_id == biz.id)
                    ),
                    Payroll.month == month_str
                )
            ).one()
            
            biz_profit = biz_revenue - biz_labor
            total_revenue += biz_revenue
            total_labor += biz_labor
            total_profit += biz_profit
            
            overview.append({
                "business_id": biz.id,
                "name": biz.name,
                "business_type": biz.business_type,
                "region": biz.region,
                "staff_count": staff_count,
                "revenue": biz_revenue,
                "labor_cost": biz_labor,
                "profit": biz_profit,
                "subscription_status": biz.subscription_status,
            })
        
        return {
            "status": "success",
            "data": {
                "year": year,
                "month": month,
                "summary": {
                    "total_businesses": len(businesses),
                    "total_revenue": total_revenue,
                    "total_labor_cost": total_labor,
                    "total_profit": total_profit,
                },
                "businesses": overview,
            }
        }


# ==========================================
# 3. 요금제 관리 및 이용료 정산
# ==========================================

@router.get("/plans")
def list_plans(admin: User = Depends(get_superadmin_user)):
    """요금제 목록 조회"""
    with Session(engine) as s:
        plans = s.exec(select(SubscriptionPlan)).all()
        return {"status": "success", "data": [p.dict() for p in plans]}


@router.post("/plans")
def create_plan(data: PlanCreate, admin: User = Depends(get_superadmin_user)):
    """요금제 생성"""
    with Session(engine) as s:
        plan = SubscriptionPlan(**data.dict())
        s.add(plan)
        s.commit()
        s.refresh(plan)
        return {"status": "success", "data": plan.dict()}


@router.get("/billing")
def get_billing_summary(
    year: int = Query(default=None),
    month: int = Query(default=None),
    admin: User = Depends(get_superadmin_user)
):
    """매장별 이용료 정산 현황"""
    if not year:
        year = date.today().year
    if not month:
        month = date.today().month
    
    with Session(engine) as s:
        businesses = s.exec(
            select(Business).where(Business.is_active == True)
        ).all()
        
        billing = []
        total_billing = 0
        
        for biz in businesses:
            plan = s.get(SubscriptionPlan, biz.plan_id) if biz.plan_id else None
            monthly_fee = plan.price_monthly if plan else 0
            total_billing += monthly_fee
            
            billing.append({
                "business_id": biz.id,
                "name": biz.name,
                "plan_name": plan.name if plan else "무료",
                "monthly_fee": monthly_fee,
                "subscription_status": biz.subscription_status,
                "subscription_start": str(biz.subscription_start) if biz.subscription_start else None,
            })
        
        return {
            "status": "success",
            "data": {
                "year": year,
                "month": month,
                "total_billing": total_billing,
                "businesses": billing,
            }
        }


# ==========================================
# 4. 3단계 권한 체계 (SuperAdmin → Admin → Staff)
# ==========================================

@router.get("/users")
def list_all_users(
    business_id: Optional[int] = None,
    admin: User = Depends(get_superadmin_user)
):
    """전체 사용자 목록 (매장별 그룹화)"""
    with Session(engine) as s:
        businesses = s.exec(select(Business).where(Business.is_active == True)).all()
        stmt = select(User)
        if business_id:
            stmt = stmt.where(User.business_id == business_id)
        users = s.exec(stmt).all()
        
        def user_dict(u):
            return {
                "id": u.id, "username": u.username, "role": u.role,
                "grade": u.grade, "email": u.email, "real_name": u.real_name,
                "business_id": u.business_id, "subscription_type": u.subscription_type,
            }
        
        user_map = {}
        unassigned = []
        for u in users:
            if u.business_id and u.role != "guest":
                user_map.setdefault(u.business_id, []).append(user_dict(u))
            else:
                unassigned.append(user_dict(u))
        
        groups = []
        for biz in businesses:
            groups.append({
                "business_id": biz.id, "business_name": biz.name,
                "owner_name": biz.owner_name, "business_type": biz.business_type,
                "is_active": biz.is_active,
                "users": user_map.get(biz.id, []),
                "user_count": len(user_map.get(biz.id, [])),
            })
        groups.sort(key=lambda g: (-g["user_count"], g["business_name"]))
        
        if unassigned and not business_id:
            groups.append({
                "business_id": None, "business_name": "미배정",
                "owner_name": None, "business_type": None, "is_active": True,
                "users": unassigned, "user_count": len(unassigned),
            })
        
        all_users = [user_dict(u) for u in users]
        return {
            "status": "success", "data": all_users,
            "groups": groups, "total_users": len(all_users),
            "total_businesses": len(businesses),
        }



@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    role: str = Body(..., embed=True),
    admin: User = Depends(get_superadmin_user)
):
    """사용자 권한 변경"""
    if role not in ("superadmin", "admin", "staff", "guest"):
        raise HTTPException(status_code=400, detail="유효하지 않은 권한입니다.")
    
    with Session(engine) as s:
        user = s.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        user.role = role
        s.add(user)
        s.commit()
        return {"status": "success", "message": f"'{user.username}' 권한이 '{role}'로 변경되었습니다."}


@router.put("/users/{user_id}/business")
def assign_user_business(
    user_id: int,
    business_id: int = Body(..., embed=True),
    admin: User = Depends(get_superadmin_user)
):
    """사용자를 매장에 배정"""
    with Session(engine) as s:
        user = s.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        biz = s.get(Business, business_id)
        if not biz:
            raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
        
        user.business_id = business_id
        s.add(user)
        s.commit()
        return {"status": "success", "message": f"'{user.username}'이 '{biz.name}'에 배정되었습니다."}


class UserUpdate(BaseModel):
    username: Optional[str] = None
    real_name: Optional[str] = None
    email: Optional[str] = None


@router.put("/users/{user_id}")
def update_user_info(
    user_id: int,
    data: UserUpdate,
    admin: User = Depends(get_superadmin_user)
):
    """사용자 정보 수정 (아이디, 이름, 이메일)"""
    with Session(engine) as s:
        user = s.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
        # Check username uniqueness
        if data.username and data.username != user.username:
            existing = s.exec(select(User).where(User.username == data.username)).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"'{data.username}' 아이디가 이미 존재합니다.")
            user.username = data.username
        
        if data.real_name is not None:
            user.real_name = data.real_name
        if data.email is not None:
            user.email = data.email
        
        s.add(user)
        s.commit()
        return {"status": "success", "message": f"사용자 정보가 수정되었습니다."}


@router.put("/users/{user_id}/password")
def update_user_password(
    user_id: int,
    new_password: str = Body(..., embed=True),
    admin: User = Depends(get_superadmin_user)
):
    """사용자 비밀번호 변경"""
    from routers.auth import get_password_hash
    
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="비밀번호는 최소 4자 이상이어야 합니다.")
    
    with Session(engine) as s:
        user = s.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
        user.hashed_password = get_password_hash(new_password)
        s.add(user)
        s.commit()
        return {"status": "success", "message": f"'{user.username}' 비밀번호가 변경되었습니다."}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(get_superadmin_user)
):
    """사용자 계정 삭제"""
    with Session(engine) as s:
        user = s.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
        # Prevent self-deletion
        if user.id == admin.id:
            raise HTTPException(status_code=400, detail="자기 자신의 계정은 삭제할 수 없습니다.")
        
        username = user.username
        s.delete(user)
        s.commit()
        return {"status": "success", "message": f"'{username}' 계정이 삭제되었습니다."}


# ==========================================
# 5. 매장별 이슈 관리 및 공지사항 일괄 배포
# ==========================================

@router.post("/announcements/global")
def create_global_announcement(
    data: GlobalAnnouncementCreate,
    admin: User = Depends(get_superadmin_user)
):
    """전체 매장 공지사항 일괄 배포"""
    with Session(engine) as s:
        announcement = Announcement(
            title=data.title,
            content=data.content,
            pinned=data.pinned,
            is_global=True,
            business_id=None,  # 전체 공지
        )
        s.add(announcement)
        s.commit()
        s.refresh(announcement)
        return {
            "status": "success",
            "data": {"id": announcement.id, "title": announcement.title},
            "message": "전체 매장에 공지가 배포되었습니다."
        }


@router.get("/announcements")
def list_global_announcements(admin: User = Depends(get_superadmin_user)):
    """전체 공지사항 목록"""
    with Session(engine) as s:
        announcements = s.exec(
            select(Announcement).where(Announcement.is_global == True)
            .order_by(Announcement.created_at.desc())
        ).all()
        return {
            "status": "success",
            "data": [{
                "id": a.id,
                "title": a.title,
                "content": a.content,
                "pinned": a.pinned,
                "created_at": str(a.created_at),
            } for a in announcements]
        }


# ==========================================
# 6. 업종별/지역별 통계 및 벤치마크 리포트
# ==========================================

@router.get("/analytics")
def get_analytics(
    year: int = Query(default=None),
    month: int = Query(default=None),
    admin: User = Depends(get_superadmin_user)
):
    """업종별/지역별 통계 및 벤치마크"""
    if not year:
        year = date.today().year
    if not month:
        month = date.today().month
    
    with Session(engine) as s:
        businesses = s.exec(select(Business).where(Business.is_active == True)).all()
        
        # Group by business_type
        type_stats = {}
        region_stats = {}
        
        for biz in businesses:
            # Revenue
            biz_revenue = s.exec(
                select(func.coalesce(func.sum(Revenue.amount), 0)).where(
                    Revenue.business_id == biz.id,
                    func.extract('year', Revenue.date) == year,
                    func.extract('month', Revenue.date) == month
                )
            ).one()
            
            # Staff count
            staff_count = s.exec(
                select(func.count(Staff.id)).where(
                    Staff.business_id == biz.id, Staff.status == "재직"
                )
            ).one()
            
            # Group by type
            btype = biz.business_type or "기타"
            if btype not in type_stats:
                type_stats[btype] = {"count": 0, "total_revenue": 0, "total_staff": 0}
            type_stats[btype]["count"] += 1
            type_stats[btype]["total_revenue"] += biz_revenue
            type_stats[btype]["total_staff"] += staff_count
            
            # Group by region
            region = biz.region or "미설정"
            if region not in region_stats:
                region_stats[region] = {"count": 0, "total_revenue": 0}
            region_stats[region]["count"] += 1
            region_stats[region]["total_revenue"] += biz_revenue
        
        # Compute averages
        for key in type_stats:
            cnt = type_stats[key]["count"]
            if cnt > 0:
                type_stats[key]["avg_revenue"] = type_stats[key]["total_revenue"] // cnt
                type_stats[key]["avg_staff"] = round(type_stats[key]["total_staff"] / cnt, 1)
        
        for key in region_stats:
            cnt = region_stats[key]["count"]
            if cnt > 0:
                region_stats[key]["avg_revenue"] = region_stats[key]["total_revenue"] // cnt
        
        return {
            "status": "success",
            "data": {
                "year": year,
                "month": month,
                "by_business_type": type_stats,
                "by_region": region_stats,
                "total_businesses": len(businesses),
            }
        }



@router.post("/businesses/{business_id}/create-admin")
def create_business_admin(
    business_id: int,
    username: str = Body(..., embed=True),
    password: str = Body(..., embed=True),
    real_name: str = Body(None, embed=True),
    admin: User = Depends(get_superadmin_user)
):
    """기존 매장에 관리자(Admin) 계정 생성"""
    from routers.auth import get_password_hash
    
    with Session(engine) as s:
        biz = s.get(Business, business_id)
        if not biz:
            raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
        
        existing = s.exec(select(User).where(User.username == username)).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"'{username}' 아이디가 이미 존재합니다.")
        
        new_user = User(
            username=username,
            hashed_password=get_password_hash(password),
            role="admin",
            grade="admin",
            business_id=business_id,
            real_name=real_name or biz.owner_name,
            subscription_type=None,
        )
        s.add(new_user)
        s.commit()
        s.refresh(new_user)
        
        return {
            "status": "success",
            "data": {
                "user_id": new_user.id,
                "username": new_user.username,
                "business_id": business_id,
                "business_name": biz.name,
            },
            "message": f"'{biz.name}' 매장 관리자 '{username}'이(가) 생성되었습니다."
        }


# ==========================================
# 7. 온보딩 API (가입 → 설정 → 사용)
# ==========================================

@router.post("/onboarding")
def onboard_new_business(
    data: BusinessCreate,
    admin_username: str = Body(...),
    admin_password: str = Body(...),
    admin: User = Depends(get_superadmin_user)
):
    """
    새 사업장 온보딩: 사업장 생성 + 관리자 계정 자동 생성
    """
    from routers.auth import get_password_hash
    
    with Session(engine) as s:
        # 1. Create business
        biz = Business(
            name=data.name,
            business_number=data.business_number,
            business_type=data.business_type,
            owner_name=data.owner_name,
            phone=data.phone,
            address=data.address,
            region=data.region,
            plan_id=data.plan_id,
            subscription_start=date.today(),
        )
        s.add(biz)
        s.flush()  # Get biz.id
        
        # 2. Create admin user for this business
        existing = s.exec(select(User).where(User.username == admin_username)).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"'{admin_username}' 계정이 이미 존재합니다.")
        
        admin_user = User(
            username=admin_username,
            hashed_password=get_password_hash(admin_password),
            role="admin",
            grade="admin",
            business_id=biz.id,
            real_name=data.owner_name,
            email=None,
        )
        s.add(admin_user)
        s.commit()
        s.refresh(biz)
        
        return {
            "status": "success",
            "data": {
                "business_id": biz.id,
                "business_name": biz.name,
                "admin_username": admin_username,
            },
            "message": f"'{biz.name}' 매장이 성공적으로 등록되었습니다."
        }


# ==========================================
# 8. 매장 사용신청 관리 (Guest → Admin 승인 워크플로우)
# ==========================================

class ApplicationApproval(BaseModel):
    admin_username: str  # 할당할 Admin 아이디
    admin_password: str  # 할당할 Admin 비밀번호
    admin_note: Optional[str] = None
    plan_id: Optional[int] = None  # 요금제 ID

class ApplicationRejection(BaseModel):
    admin_note: str = ""  # 거절 사유


@router.get("/store-applications")
def list_store_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    admin: User = Depends(get_superadmin_user)
):
    """전체 사용신청 목록 (상태별 필터 가능)"""
    with Session(engine) as s:
        stmt = select(StoreApplication)
        if status_filter:
            stmt = stmt.where(StoreApplication.status == status_filter)
        applications = s.exec(stmt.order_by(
            # pending을 먼저 보여주기
            StoreApplication.status.desc(),
            StoreApplication.created_at.desc()
        )).all()
        
        results = []
        for app in applications:
            # 신청자 정보 가져오기
            user = s.get(User, app.user_id)
            results.append({
                "id": app.id,
                "user_id": app.user_id,
                "applicant_username": user.username if user else None,
                "applicant_name": user.real_name if user else None,
                "applicant_email": user.email if user else None,
                "business_name": app.business_name,
                "business_type": app.business_type,
                "owner_name": app.owner_name,
                "phone": app.phone,
                "address": app.address,
                "business_number": app.business_number,
                "region": app.region,
                "plan_type": app.plan_type,
                "staff_count": app.staff_count,
                "message": app.message,
                "status": app.status,
                "admin_note": app.admin_note,
                "assigned_username": app.assigned_username,
                "created_at": app.created_at.isoformat() if app.created_at else None,
                "reviewed_at": app.reviewed_at.isoformat() if app.reviewed_at else None,
            })
        
        return {"status": "success", "data": results}


@router.post("/store-applications/{application_id}/approve")
def approve_store_application(
    application_id: int,
    data: ApplicationApproval,
    admin: User = Depends(get_superadmin_user)
):
    """
    사용신청 승인: Business 생성 + User를 Admin으로 전환 + 비밀번호 설정
    """
    from routers.auth import get_password_hash
    
    with Session(engine) as s:
        application = s.get(StoreApplication, application_id)
        if not application:
            raise HTTPException(status_code=404, detail="신청서를 찾을 수 없습니다.")
        if application.status != "pending":
            raise HTTPException(status_code=400, detail=f"이미 처리된 신청입니다. (상태: {application.status})")
        
        # Admin 아이디 중복 확인
        existing = s.exec(select(User).where(User.username == data.admin_username)).first()
        if existing and existing.id != application.user_id:
            raise HTTPException(status_code=400, detail=f"'{data.admin_username}' 아이디가 이미 존재합니다.")
        
        # 1. Business 생성
        biz = Business(
            name=application.business_name,
            business_number=application.business_number,
            business_type=application.business_type,
            owner_name=application.owner_name,
            phone=application.phone,
            address=application.address,
            region=application.region,
            plan_id=data.plan_id,
            subscription_start=date.today(),
        )
        s.add(biz)
        s.flush()  # Get biz.id
        
        # 2. User를 Guest → Admin으로 전환
        user = s.get(User, application.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="신청자 계정을 찾을 수 없습니다.")
        
        user.username = data.admin_username
        user.hashed_password = get_password_hash(data.admin_password)
        user.role = "admin"
        user.grade = "admin"
        user.business_id = biz.id
        user.subscription_type = application.plan_type
        user.approved_at = datetime.now()
        user.approved_by = admin.id
        s.add(user)
        
        # 3. 신청서 상태 업데이트
        application.status = "approved"
        application.admin_note = data.admin_note
        application.reviewed_by = admin.id
        application.reviewed_at = datetime.now()
        application.assigned_username = data.admin_username
        application.assigned_business_id = biz.id
        s.add(application)
        
        s.commit()
        
        return {
            "status": "success",
            "message": f"'{application.business_name}' 매장이 승인되었습니다.",
            "data": {
                "business_id": biz.id,
                "business_name": biz.name,
                "admin_username": data.admin_username,
                "plan_type": application.plan_type,
            }
        }


@router.post("/store-applications/{application_id}/reject")
def reject_store_application(
    application_id: int,
    data: ApplicationRejection,
    admin: User = Depends(get_superadmin_user)
):
    """사용신청 거절"""
    with Session(engine) as s:
        application = s.get(StoreApplication, application_id)
        if not application:
            raise HTTPException(status_code=404, detail="신청서를 찾을 수 없습니다.")
        if application.status != "pending":
            raise HTTPException(status_code=400, detail=f"이미 처리된 신청입니다. (상태: {application.status})")
        
        application.status = "rejected"
        application.admin_note = data.admin_note
        application.reviewed_by = admin.id
        application.reviewed_at = datetime.now()
        s.add(application)
        s.commit()
        
        return {
            "status": "success",
            "message": f"'{application.business_name}' 사용신청이 거절되었습니다."
        }
