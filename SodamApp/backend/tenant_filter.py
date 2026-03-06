# -*- coding: utf-8 -*-
"""
Tenant Filter Utility
Provides business_id scoping for multi-tenant data isolation.
"""
from sqlmodel import select
from fastapi import Depends, Header
from typing import Optional
from jose import jwt
import os

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sodam_fn_dev_only_change_in_production")
ALGORITHM = "HS256"


def get_bid_from_token(authorization: Optional[str] = Header(None)) -> Optional[int]:
    """
    Extract business_id from JWT token in Authorization header.
    Returns None for superadmin (no filtering) or if no token present.
    Returns business_id for admin/staff users.
    """
    if not authorization:
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role = payload.get("role", "")
        if role == "superadmin":
            return None  # SuperAdmin sees everything
        return payload.get("business_id")
    except Exception:
        return None


def apply_bid_filter(stmt, model_class, bid: Optional[int]):
    """
    Apply business_id filter to a select statement.
    If bid is None (superadmin or no auth), returns unfiltered statement.
    """
    if bid is not None and hasattr(model_class, 'business_id'):
        stmt = stmt.where(model_class.business_id == bid)
    return stmt
