import random
import datetime
import re


class OCRService:
    def process_image(self, image_bytes: bytes):
        """
        Mock OCR processing for general images.
        In real implementation, this would use Google Cloud Vision.
        """
        vendors = ["다이소", "쿠팡", "배달의민족", "식자재마트", "하나로마트"]
        amounts = [5000, 12000, 45000, 125000, 3200]
        
        vendor = random.choice(vendors)
        amount = random.choice(amounts)
        today = datetime.date.today().strftime("%Y-%m-%d")
        
        return {
            "status": "success",
            "data": {
                "date": today,
                "item": vendor,
                "amount": amount,
                "category": "재료비" 
            }
        }

    def process_receipt_image(self, image_bytes: bytes):
        """
        Process a receipt image and extract purchase details.
        Returns structured data: vendor, amount, date, category, items.
        
        Mock implementation — returns realistic sample data.
        TODO: Replace with Google Cloud Vision API.
        """
        # In real implementation:
        # 1. Send image to Google Cloud Vision API
        # 2. Parse OCR text to extract vendor name, date, total amount
        # 3. Match vendor to existing DB records
        # 4. Auto-classify category based on vendor/items
        
        # Mock: generate realistic receipt data
        receipt_templates = [
            {
                "vendor_name": "하나로마트",
                "items": [
                    {"name": "양파 1kg", "amount": 2500},
                    {"name": "감자 2kg", "amount": 4800},
                    {"name": "당근 500g", "amount": 1500},
                ],
                "category": "원재료비",
            },
            {
                "vendor_name": "GS25 스타시티점",
                "items": [
                    {"name": "생수 2L x6", "amount": 5400},
                    {"name": "종이컵 50p", "amount": 3200},
                ],
                "category": "소모품비",
            },
            {
                "vendor_name": "다이소",
                "items": [
                    {"name": "행주 3p", "amount": 3000},
                    {"name": "수세미 5p", "amount": 2000},
                    {"name": "고무장갑", "amount": 1500},
                ],
                "category": "소모품비",
            },
            {
                "vendor_name": "농협하나로마트",
                "items": [
                    {"name": "쌀 10kg", "amount": 32000},
                    {"name": "참기름 500ml", "amount": 8900},
                ],
                "category": "원재료비",
            },
            {
                "vendor_name": "쿠팡 로켓배송",
                "items": [
                    {"name": "비닐장갑 100매", "amount": 4500},
                    {"name": "칫솔 세트", "amount": 6900},
                ],
                "category": "소모품비",
            },
        ]
        
        template = random.choice(receipt_templates)
        today = datetime.date.today().strftime("%Y-%m-%d")
        total_amount = sum(item["amount"] for item in template["items"])
        
        return {
            "status": "success",
            "data": {
                "vendor_name": template["vendor_name"],
                "date": today,
                "total_amount": total_amount,
                "category": template["category"],
                "items": template["items"],
                "payment_method": "Card",
                "confidence": round(random.uniform(0.85, 0.98), 2),
            },
            "message": f"영수증 분석 완료: {template['vendor_name']} - {total_amount:,}원"
        }
