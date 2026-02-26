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

router = APIRouter(prefix="/api/products", tags=["products"])

# Pydantic schemas
class ProductCreate(BaseModel):
    name: str
    vendor_id: int
    category: Optional[str] = None
    spec: Optional[str] = None
    unit_price: int = 0
    tax_type: str = "taxable"  # taxable, tax_free, zero_rated
    manufacturer: Optional[str] = None
    note: Optional[str] = None
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    spec: Optional[str] = None
    unit_price: Optional[int] = None
    tax_type: Optional[str] = None
    manufacturer: Optional[str] = None
    note: Optional[str] = None
    image_url: Optional[str] = None

# Get all products for a vendor
@router.get("")
def get_products(vendor_id: Optional[int] = None, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user)):
    try:
        if vendor_id:
            stmt = select(Product).where(Product.vendor_id == vendor_id)
        else:
            stmt = select(Product)
        
        products = session.exec(stmt).all()
        return {
            "status": "success",
            "data": [{
                "id": p.id,
                "product_code": p.product_code,
                "name": p.name,
                "category": p.category,
                "spec": p.spec,
                "unit_price": p.unit_price,
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
def create_product(data: ProductCreate, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user)):
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
            select(Product).where(Product.vendor_id == data.vendor_id)
        ).all())
        sequence = str(existing_count + 1).zfill(2)
        product_code = f"{initials}{sequence}"
        
        product = Product(
            product_code=product_code,
            name=data.name,
            vendor_id=data.vendor_id,
            category=data.category or "",  # Default to empty string for NOT NULL constraint
            spec=data.spec,
            unit_price=data.unit_price,
            tax_type=data.tax_type,
            manufacturer=data.manufacturer,
            note=data.note,
            image_url=data.image_url
        )
        session.add(product)
        session.commit()
        session.refresh(product)
        
        return {"status": "success", "data": {"id": product.id, "product_code": product_code}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Update a product
@router.put("/{product_id}")
def update_product(product_id: int, data: ProductUpdate, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user)):
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
        if data.unit_price is not None:
            product.unit_price = data.unit_price
        if data.tax_type is not None:
            product.tax_type = data.tax_type
        if data.manufacturer is not None:
            product.manufacturer = data.manufacturer
        if data.note is not None:
            product.note = data.note
        if data.image_url is not None:
            product.image_url = data.image_url
        
        session.add(product)
        session.commit()
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Delete a product
@router.delete("/{product_id}")
def delete_product(product_id: int, session: Session = Depends(get_session), _admin: AuthUser = Depends(get_admin_user)):
    try:
        product = session.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
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
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="허용되지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP만 가능)")

        # Create directory
        base_dir = "uploads/product_images"
        os.makedirs(base_dir, exist_ok=True)

        # Generate unique filename
        timestamp = int(datetime.now().timestamp() * 1000)
        ext = os.path.splitext(file.filename or "image.jpg")[1]
        filename = f"product_{timestamp}{ext}"
        file_path = os.path.join(base_dir, filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Return the URL path (served by FastAPI StaticFiles mount)
        url_path = f"/uploads/product_images/{filename}"
        return {"status": "success", "url": url_path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
