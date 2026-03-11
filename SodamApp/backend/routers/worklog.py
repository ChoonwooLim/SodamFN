"""
작업일지 (Dev Work Log) Router - SuperAdmin 전용
매일 작업한 내용을 기록하고 AI가 참고할 수 있는 이력 관리
"""
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func, col
from database import engine
from models import DevWorkLog
from routers.auth import get_current_user
from models import User

router = APIRouter()


def get_superadmin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="SuperAdmin 권한이 필요합니다.")
    return current_user


class WorkLogCreate(BaseModel):
    date: date
    title: str
    content: str = ""
    category: str = "feature"
    files_changed: Optional[str] = None
    ai_summary: Optional[str] = None
    status: str = "completed"


class WorkLogUpdate(BaseModel):
    date: Optional[date] = None
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    files_changed: Optional[str] = None
    ai_summary: Optional[str] = None
    status: Optional[str] = None


@router.get("/worklog")
def list_worklogs(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: User = Depends(get_superadmin_user)
):
    """작업일지 목록 조회 (날짜/카테고리 필터, [HEAD] 항목은 항상 최상단)"""
    with Session(engine) as s:
        # [HEAD] 고정 항목 (항상 포함)
        pinned = s.exec(
            select(DevWorkLog).where(DevWorkLog.title.startswith("[HEAD]"))
            .order_by(DevWorkLog.updated_at.desc())
        ).all()
        pinned_ids = {p.id for p in pinned}

        # 일반 항목
        stmt = select(DevWorkLog).where(~DevWorkLog.title.startswith("[HEAD]"))

        if start_date:
            stmt = stmt.where(DevWorkLog.date >= date.fromisoformat(start_date))
        if end_date:
            stmt = stmt.where(DevWorkLog.date <= date.fromisoformat(end_date))
        if category:
            stmt = stmt.where(DevWorkLog.category == category)
        if search:
            stmt = stmt.where(
                (DevWorkLog.title.contains(search)) |
                (DevWorkLog.content.contains(search)) |
                (DevWorkLog.files_changed.contains(search))
            )

        regular = s.exec(stmt.order_by(DevWorkLog.date.desc(), DevWorkLog.created_at.desc()).limit(limit)).all()

        def to_dict(log, pinned=False):
            return {
                "id": log.id,
                "date": str(log.date),
                "title": log.title,
                "content": log.content,
                "category": log.category,
                "files_changed": log.files_changed,
                "ai_summary": log.ai_summary,
                "status": log.status,
                "is_pinned": pinned,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "updated_at": log.updated_at.isoformat() if log.updated_at else None,
            }

        data = [to_dict(p, pinned=True) for p in pinned] + [to_dict(r) for r in regular]

        return {
            "status": "success",
            "data": data,
            "total": len(data),
        }


@router.get("/worklog/summary")
def get_worklog_summary(
    days: int = Query(default=7, le=90),
    admin: User = Depends(get_superadmin_user)
):
    """AI 참고용 최근 작업 요약 (최근 N일)"""
    from datetime import timedelta
    cutoff = date.today() - timedelta(days=days)

    with Session(engine) as s:
        logs = s.exec(
            select(DevWorkLog)
            .where(DevWorkLog.date >= cutoff)
            .order_by(DevWorkLog.date.desc(), DevWorkLog.created_at.desc())
        ).all()

        # 날짜별 그룹화
        by_date = {}
        for log in logs:
            d = str(log.date)
            if d not in by_date:
                by_date[d] = []
            by_date[d].append({
                "title": log.title,
                "category": log.category,
                "content": log.content[:200] if log.content else "",
                "files_changed": log.files_changed,
                "ai_summary": log.ai_summary,
            })

        # 카테고리별 통계
        cat_counts = {}
        for log in logs:
            cat_counts[log.category] = cat_counts.get(log.category, 0) + 1

        return {
            "status": "success",
            "data": {
                "period_days": days,
                "total_entries": len(logs),
                "category_stats": cat_counts,
                "by_date": by_date,
            }
        }


@router.get("/worklog/{log_id}")
def get_worklog(log_id: int, admin: User = Depends(get_superadmin_user)):
    """작업일지 단건 조회"""
    with Session(engine) as s:
        log = s.get(DevWorkLog, log_id)
        if not log:
            raise HTTPException(status_code=404, detail="작업일지를 찾을 수 없습니다.")
        return {
            "status": "success",
            "data": {
                "id": log.id,
                "date": str(log.date),
                "title": log.title,
                "content": log.content,
                "category": log.category,
                "files_changed": log.files_changed,
                "ai_summary": log.ai_summary,
                "status": log.status,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "updated_at": log.updated_at.isoformat() if log.updated_at else None,
            }
        }


@router.post("/worklog")
def create_worklog(data: WorkLogCreate, admin: User = Depends(get_superadmin_user)):
    """새 작업일지 생성"""
    with Session(engine) as s:
        log = DevWorkLog(
            date=data.date,
            title=data.title,
            content=data.content,
            category=data.category,
            files_changed=data.files_changed,
            ai_summary=data.ai_summary,
            status=data.status,
        )
        s.add(log)
        s.commit()
        s.refresh(log)
        return {
            "status": "success",
            "data": {"id": log.id, "title": log.title},
            "message": "작업일지가 생성되었습니다."
        }


@router.put("/worklog/{log_id}")
def update_worklog(log_id: int, data: WorkLogUpdate, admin: User = Depends(get_superadmin_user)):
    """작업일지 수정"""
    with Session(engine) as s:
        log = s.get(DevWorkLog, log_id)
        if not log:
            raise HTTPException(status_code=404, detail="작업일지를 찾을 수 없습니다.")

        for field, value in data.dict(exclude_unset=True).items():
            setattr(log, field, value)
        log.updated_at = datetime.now()

        s.add(log)
        s.commit()
        s.refresh(log)
        return {
            "status": "success",
            "data": {"id": log.id, "title": log.title},
            "message": "작업일지가 수정되었습니다."
        }


@router.delete("/worklog/{log_id}")
def delete_worklog(log_id: int, admin: User = Depends(get_superadmin_user)):
    """작업일지 삭제"""
    with Session(engine) as s:
        log = s.get(DevWorkLog, log_id)
        if not log:
            raise HTTPException(status_code=404, detail="작업일지를 찾을 수 없습니다.")

        title = log.title
        s.delete(log)
        s.commit()
        return {"status": "success", "message": f"'{title}' 작업일지가 삭제되었습니다."}
