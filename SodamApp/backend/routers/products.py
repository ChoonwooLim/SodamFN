"""
Product CRUD API endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from routers.auth import get_admin_user
from models import User as AuthUser
from sqlmodel import Session, select
from database import get_session
from models import Product, Vendor
from pydantic import BaseModel
from typing import Optional, List
import os
import shutil
from datetime import datetime
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter(prefix="/api/products", tags=["products"])

# Pydantic schemas
class ProductCreate(BaseModel):
    name: str
    vendor_id: int
    category: Optional[str] = None
    spec: Optional[str] = None
    weight: Optional[str] = None      # 중량 수치 (예: "20")
    unit: Optional[str] = None        # 규격 단위 (kg, g, L, ml, 개, 봉 등)
    pack_qty: float = 1.0             # 수량 (묶음당)
    unit_price: int = 0
    tax_type: str = "auto"  # auto(자동분류), taxable, tax_free, zero_rated
    manufacturer: Optional[str] = None
    note: Optional[str] = None
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    spec: Optional[str] = None
    weight: Optional[str] = None
    unit: Optional[str] = None
    pack_qty: Optional[float] = None
    unit_price: Optional[int] = None
    tax_type: Optional[str] = None    # "auto" 전달 시 품명 기준 재분류
    manufacturer: Optional[str] = None
    note: Optional[str] = None
    image_url: Optional[str] = None

# Get all products for a vendor
@router.get("")
def get_products(vendor_id: Optional[int] = None, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    try:
        if vendor_id:
            stmt = select(Product).where(Product.vendor_id == vendor_id)
            stmt = apply_bid_filter(stmt, Product, bid)
        else:
            stmt = select(Product)
            stmt = apply_bid_filter(stmt, Product, bid)
        
        products = session.exec(stmt).all()
        return {
            "status": "success",
            "data": [{
                "id": p.id,
                "product_code": p.product_code,
                "name": p.name,
                "category": p.category,
                "spec": p.spec,
                "weight": p.weight,
                "unit": p.unit,
                "pack_qty": p.pack_qty,
                "unit_price": p.unit_price,
                "price_updated": p.price_updated.isoformat() if p.price_updated else None,
                "tax_type": p.tax_type,
                "manufacturer": p.manufacturer,
                "note": p.note,
                "image_url": p.image_url,
                "vendor_id": p.vendor_id
            } for p in products]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Create a new product
@router.post("")
def create_product(data: ProductCreate, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    try:
        # Verify vendor exists
        vendor = session.get(Vendor, data.vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        
        # Generate product code: Vendor initials + sequence number
        # Get vendor name initials (first char of each word, max 3)
        import re
        name_parts = re.sub(r'[^\w\s]', '', vendor.name).split()[:3]
        initials = ''.join([p[0].upper() for p in name_parts if p])
        if not initials:
            initials = vendor.name[:3].upper()
        
        # Count existing products for this vendor to determine sequence
        existing_count = len(session.exec(
            apply_bid_filter(select(Product), Product, bid).where(Product.vendor_id == data.vendor_id)
        ).all())
        sequence = str(existing_count + 1).zfill(2)
        product_code = f"{initials}{sequence}"
        
        # 과세 자동분류 (미가공 농축수산물=면세, 가공식품=과세)
        from services.tax_classifier import classify_tax
        tax_type = data.tax_type
        if not tax_type or tax_type == "auto":
            tax_type = classify_tax(data.name)

        import datetime as _dt
        product = Product(
            product_code=product_code,
            name=data.name,
            vendor_id=data.vendor_id,
            # 테넌트 필수: bid 미설정 시 거래처의 사업장 상속 (누락 시 목록에서 안 보이는 버그 방지)
            business_id=bid if bid is not None else vendor.business_id,
            category=data.category or "",  # Default to empty string for NOT NULL constraint
            spec=data.spec,
            weight=data.weight,
            unit=data.unit,
            pack_qty=data.pack_qty or 1.0,
            unit_price=data.unit_price,
            price_updated=_dt.date.today() if data.unit_price else None,
            tax_type=tax_type,
            manufacturer=data.manufacturer,
            note=data.note,
            image_url=data.image_url
        )
        session.add(product)
        session.flush()
        if data.unit_price:
            from models import ProductPrice
            session.add(ProductPrice(business_id=product.business_id, product_id=product.id,
                                     price=data.unit_price, source="manual"))
        session.commit()
        session.refresh(product)

        return {"status": "success", "data": {"id": product.id, "product_code": product_code, "tax_type": tax_type}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update a product
@router.put("/{product_id}")
def update_product(product_id: int, data: ProductUpdate, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    try:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        if data.name is not None:
            product.name = data.name
        if data.category is not None:
            product.category = data.category
        if data.spec is not None:
            product.spec = data.spec
        if data.weight is not None:
            product.weight = data.weight or None
        if data.unit is not None:
            product.unit = data.unit or None
        if data.pack_qty is not None:
            product.pack_qty = data.pack_qty or 1.0
        if data.unit_price is not None and data.unit_price != product.unit_price:
            import datetime as _dt
            product.unit_price = data.unit_price
            product.price_updated = _dt.date.today()
            if data.unit_price > 0:
                from models import ProductPrice
                session.add(ProductPrice(business_id=product.business_id, product_id=product.id,
                                         price=data.unit_price, source="manual"))
        if data.tax_type is not None:
            if data.tax_type == "auto":
                from services.tax_classifier import classify_tax
                product.tax_type = classify_tax(product.name)
            else:
                product.tax_type = data.tax_type
        if data.manufacturer is not None:
            product.manufacturer = data.manufacturer
        if data.note is not None:
            product.note = data.note
        if data.image_url is not None:
            product.image_url = data.image_url

        session.add(product)
        session.commit()

        return {"status": "success", "data": {"tax_type": product.tax_type}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Delete a product
@router.delete("/{product_id}")
def delete_product(product_id: int, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    try:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # 종속 데이터 정리 (FK: 단가 이력, 재고)
        from models import ProductPrice, Inventory
        for pr in session.exec(select(ProductPrice).where(ProductPrice.product_id == product_id)).all():
            session.delete(pr)
        inv = session.get(Inventory, product_id)
        if inv:
            session.delete(inv)
        session.delete(product)
        session.commit()

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Upload product image
@router.post("/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    _admin: AuthUser = Depends(get_admin_user)
):
    try:
        from services.storage_service import get_storage
        storage = get_storage()
        
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="허용되지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP만 가능)")

        # Generate storage key
        timestamp = int(datetime.now().timestamp() * 1000)
        ext = os.path.splitext(file.filename or "image.jpg")[1]
        filename = f"product_{timestamp}{ext}"
        storage_key = f"product_images/{filename}"

        # Upload to R2 (or local disk fallback)
        file_url = storage.upload_file(file.file, storage_key, file.content_type)

        return {"status": "success", "url": file_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
