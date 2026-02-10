"""
AI 자동 학습 매입 분류 서비스

사용자의 수정 행동(카테고리 변경, 업체 병합, 개인/사업 전환)을
규칙으로 학습하고, 다음 업로드 시 자동 적용합니다.
"""

import datetime
from typing import List, Dict, Optional
from sqlmodel import Session, select
from database import engine
from models import VendorRule


def learn_rule(
    original_name: str,
    category: Optional[str] = None,
    mapped_vendor_name: Optional[str] = None,
    source: str = "manual",
    session: Optional[Session] = None,
):
    """
    사용자 행동으로부터 규칙을 학습합니다.
    
    - 동일 original_name 규칙이 있으면 업데이트 (confidence +1)
    - 없으면 새 규칙 생성
    """
    if not original_name or not original_name.strip():
        return
    
    original_name = original_name.strip()
    
    own_session = session is None
    if own_session:
        session = Session(engine)
    
    try:
        # 기존 규칙 검색
        existing = session.exec(
            select(VendorRule).where(VendorRule.original_name == original_name)
        ).first()
        
        if existing:
            # 기존 규칙 업데이트
            if category is not None:
                existing.category = category
            if mapped_vendor_name is not None:
                existing.mapped_vendor_name = mapped_vendor_name
            existing.confidence += 1
            existing.source = source
            existing.updated_at = datetime.datetime.now()
            session.add(existing)
        else:
            # 새 규칙 생성
            rule = VendorRule(
                original_name=original_name,
                category=category,
                mapped_vendor_name=mapped_vendor_name,
                source=source,
                confidence=1,
            )
            session.add(rule)
        
        if own_session:
            session.commit()
        
        print(f"[LEARN] '{original_name}' → category={category}, vendor={mapped_vendor_name}, source={source}")
    except Exception as e:
        print(f"[LEARN ERROR] {e}")
        if own_session:
            session.rollback()
    finally:
        if own_session:
            session.close()


def apply_rules(records: List[Dict], session: Optional[Session] = None) -> int:
    """
    파싱된 레코드 목록에 학습된 규칙을 일괄 적용합니다.
    
    Returns: 자동 분류된 건수
    """
    own_session = session is None
    if own_session:
        session = Session(engine)
    
    try:
        # 모든 규칙 로드 (confidence 높은 순)
        rules = session.exec(
            select(VendorRule).order_by(VendorRule.confidence.desc())
        ).all()
        
        if not rules:
            return 0
        
        # 정확 매칭 사전 구축
        exact_map = {}
        for rule in rules:
            key = rule.original_name.strip().lower()
            if key not in exact_map:
                exact_map[key] = rule
        
        auto_classified = 0
        
        for record in records:
            vendor_name = record.get("vendor_name", "").strip()
            if not vendor_name:
                continue
            
            key = vendor_name.lower()
            rule = exact_map.get(key)
            
            # 부분 매칭 시도 (정확 매칭 없을 때)
            if not rule:
                for r in rules:
                    if r.original_name.strip().lower() in key or key in r.original_name.strip().lower():
                        rule = r
                        break
            
            if rule:
                changed = False
                if rule.category:
                    record["category"] = rule.category
                    changed = True
                if rule.mapped_vendor_name:
                    record["vendor_name"] = rule.mapped_vendor_name
                    changed = True
                if changed:
                    record["auto_classified"] = True
                    auto_classified += 1
        
        return auto_classified
    finally:
        if own_session:
            session.close()


def get_rules(session: Optional[Session] = None) -> List[Dict]:
    """학습된 규칙 목록을 반환합니다."""
    own_session = session is None
    if own_session:
        session = Session(engine)
    
    try:
        rules = session.exec(
            select(VendorRule).order_by(VendorRule.confidence.desc())
        ).all()
        
        return [
            {
                "id": r.id,
                "original_name": r.original_name,
                "mapped_vendor_name": r.mapped_vendor_name,
                "category": r.category,
                "confidence": r.confidence,
                "source": r.source,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rules
        ]
    finally:
        if own_session:
            session.close()


def delete_rule(rule_id: int, session: Optional[Session] = None) -> bool:
    """규칙을 삭제합니다."""
    own_session = session is None
    if own_session:
        session = Session(engine)
    
    try:
        rule = session.get(VendorRule, rule_id)
        if rule:
            session.delete(rule)
            if own_session:
                session.commit()
            return True
        return False
    finally:
        if own_session:
            session.close()
