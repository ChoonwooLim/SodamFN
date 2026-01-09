import random
import datetime

class OCRService:
    def process_image(self, image_bytes: bytes):
        """
        Mock OCR processing.
        In real implementation, this would use Tesseract or Cloud Vision.
        """
        # Simulate processing time
        
        # Return dummy data for demonstration
        # Randomize slightly to show dynamic behavior
        vendors = ["다이소", "쿠팡", "배달의민족", "식자재마트", "하나로마트"]
        amounts = [5000, 12000, 45000, 125000, 3200]
        
        vendor = random.choice(vendors)
        amount = random.choice(amounts)
        today = datetime.date.today().strftime("%Y-%m-%d")
        
        return {
            "status": "success",
            "data": {
                "date": today,
                "item": vendor, # Using vendor as item name for now
                "amount": amount,
                "category": "재료비" 
            }
        }
