# -*- coding: utf-8 -*-
"""기존 매장에 기본 메뉴(MenuItem) 1회 시드. 이미 있으면 skip. 테이블도 보강 생성.
실행: python -X utf8 scripts/maintenance/seed_menu_items.py
"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from sqlmodel import Session, select, SQLModel
from database import engine
import models  # noqa: F401 — MenuItem 등록
from models import MenuItem, Business
from services.default_menu import default_menu_rows

SQLModel.metadata.create_all(engine)
with Session(engine) as s:
    for b in s.exec(select(Business)).all():
        if s.exec(select(MenuItem).where(MenuItem.business_id == b.id)).first():
            print(f"bid={b.id} ({b.name}): 이미 존재 → skip")
            continue
        n = 0
        for item_type, order, d in default_menu_rows():
            s.add(MenuItem(
                business_id=b.id, item_type=item_type, name=d["name"], category=d.get("category"),
                price=d.get("price", 0), emoji=d.get("emoji"), spec=d.get("spec"),
                ingredients=json.dumps(d.get("ingredients", []), ensure_ascii=False),
                steps=json.dumps(d.get("steps", []), ensure_ascii=False), sort_order=order))
            n += 1
        s.commit()
        print(f"bid={b.id} ({b.name}): {n}건 시드")
print("완료")
