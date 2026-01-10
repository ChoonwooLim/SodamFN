import pandas as pd
import os
import datetime

# Hardcoded path for now, can be moved to config
EXCEL_PATH = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(9~12).xlsx"

class ExcelService:
    def __init__(self, file_path=EXCEL_PATH):
        self.file_path = file_path
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"Excel file not found at {self.file_path}")

    def get_monthly_summary(self):
        """
        Reads the '종합' sheet and extracts monthly Revenue, Cost, and Profit.
        Returns a list of dictionaries for the frontend graph.
        """
        try:
            # Read '종합' sheet, no header to rely on index
            df = pd.read_excel(self.file_path, sheet_name='종합', header=None)
            
            # Map columns to months based on our analysis
            # Col 4: Jul, 5: Aug, 6: Sep, 7: Oct, 8: Nov, 9: Dec
            # (0-indexed in pandas)
            month_map = {
                4: "7월", 5: "8월", 6: "9월", 7: "10월", 8: "11월", 9: "12월"
            }
            
            # Row indices (observed from analysis)
            # Revenue: Row 2 (Index 2) -> "수입 매장 매출" + others. 
            # Actually Row 7 (Index 7) is "합 계" of Revenue?
            # Let's look at preview again.
            # Row 7: 합 계 (Revenue Total)
            # Row 17: 합 계 (Expense Total)
            # Row 18: 영업이익 (Profit)
            
            revenue_row_idx = 7
            expense_row_idx = 17
            profit_row_idx = 18
            
            summary_data = []
            
            for col_idx, month_name in month_map.items():
                revenue = df.iloc[revenue_row_idx, col_idx]
                expense = df.iloc[expense_row_idx, col_idx]
                profit = df.iloc[profit_row_idx, col_idx]
                
                # Handle NaNs
                revenue = float(revenue) if pd.notna(revenue) else 0
                expense = float(expense) if pd.notna(expense) else 0
                profit = float(profit) if pd.notna(profit) else 0
                
                summary_data.append({
                    "month": month_name,
                    "revenue": int(revenue),
                    "expense": int(expense),
                    "profit": int(profit),
                    "margin": round((profit / revenue * 100), 1) if revenue > 0 else 0
                })
                
            return summary_data

        except Exception as e:
            print(f"Error reading Excel: {e}")
            return []

    def get_revenue_breakdown(self):
        """
        Extracts revenue sources (Store, Coupang, Baemin, etc.) for the latest month (Dec).
        """
        try:
            df = pd.read_excel(self.file_path, sheet_name='종합', header=None)
            
            # Row indices for channels (0-indexed from inspection)
            # Row 2: 매장 매출
            # Row 3: 쿠팡 정산금
            # Row 4: 배민 정산금
            # Row 5: 요기요 정산금
            # Row 6: 땡겨요 정산금
            channels = {
                "매장": 2,
                "쿠팡": 3,
                "배민": 4,
                "요기요": 5,
                "땡겨요": 6
            }
            
            # Target Month Column: 9 (December)
            target_col = 9 
            
            result = []
            for name, row_idx in channels.items():
                val = df.iloc[row_idx, target_col]
                val = int(val) if pd.notna(val) else 0
                result.append({"name": name, "value": val})
                
            return result
        except Exception as e:
            print(f"Error reading Revenue Breakdown: {e}")
            return []

    def get_top_expenses(self, month: int = 12):
        """
        Extracts top vendors by cost for a specific month.
        Default to December (12).
        
        Also joins with 'Vendor Info' sheet to get Item details.
        """
        try:
            # 1. Get Top Expenses from Cost Sheet
            sheet_name = f"{month}월비용"
            df = pd.read_excel(self.file_path, sheet_name=sheet_name, header=None)
            
            # Vendor Name: Col 0 (A)
            # Total Amount: Col 31 (AF) - Last column based on inspection
            
            # Slice from row 2 (skipping headers)
            vendors = df.iloc[2:, 0] 
            amounts = df.iloc[2:, 31] 
            
            data = pd.DataFrame({"vendor": vendors, "amount": amounts})
            
            # Clean data
            data = data.dropna(subset=['amount'])
            # Ensure amount is numeric
            data['amount'] = pd.to_numeric(data['amount'], errors='coerce').fillna(0)
            data = data.dropna(subset=['vendor']) # Drop if vendor is NaN
            data = data[data['amount'] > 0]
            
            # Group by Vendor
            grouped = data.groupby('vendor')['amount'].sum().reset_index()
            grouped = grouped.sort_values('amount', ascending=False)
            top_list = grouped.head(5).to_dict('records')

            # 2. Get Item Info from 'Vendor Info' Sheet
            vendor_info = self.get_vendors() # Returns dict {name: item}
            
            # 3. Merge Info
            result = []
            for item in top_list:
                v_name = item['vendor']
                v_item = vendor_info.get(v_name, "")
                result.append({
                    "vendor": v_name,
                    "amount": int(item['amount']),
                    "item": v_item
                })
                
            return result
            
        except Exception as e:
            print(f"Error reading Top Expenses: {e}")
            return []

    def get_vendors(self):
        """
        Reads '거래처정보' sheet and returns a dict mapping Vendor -> Item.
        If sheet doesn't exist, returns empty dict.
        """
        try:
            wb = load_workbook(self.file_path)
            if '거래처정보' not in wb.sheetnames:
                return {}
            
            df = pd.read_excel(self.file_path, sheet_name='거래처정보')
            # Expecting columns: ['Vendor', 'Item']
            if df.empty:
                return {}
            
            return pd.Series(df.Item.values, index=df.Vendor).to_dict()
        except Exception as e:
            # print(f"Error reading Vendor Info: {e}")
            return {}

    def sync_vendors(self):
        """
        Scans all monthly sheets, finds unique vendors, and adds missing ones to '거래처정보' sheet.
        """
        try:
            wb = load_workbook(self.file_path)
            
            # 1. Collect all vendors from monthly sheets
            all_vendors = set()
            months = [7, 8, 9, 10, 11, 12]
            
            for m in months:
                sheet_name = f"{m}월비용"
                if sheet_name in wb.sheetnames:
                    ws = wb[sheet_name]
                    # Scan Column A (idx 1), skipping first 2 rows
                    for row in ws.iter_rows(min_row=3, min_col=1, max_col=1, values_only=True):
                        val = row[0]
                        if val and isinstance(val, str):
                            all_vendors.add(val)
            
            # 2. Initialize or Load '거래처정보' sheet
            if '거래처정보' not in wb.sheetnames:
                ws_info = wb.create_sheet('거래처정보')
                ws_info.append(['Vendor', 'Item']) # Header
                existing_vendors = set()
            else:
                ws_info = wb['거래처정보']
                # Read existing
                existing_vendors = set()
                for row in ws_info.iter_rows(min_row=2, min_col=1, max_col=1, values_only=True):
                    if row[0]: existing_vendors.add(row[0])
            
            # 3. Add new vendors
            new_vendors = all_vendors - existing_vendors
            for v in new_vendors:
                ws_info.append([v, '']) # Default empty item
                
            if new_vendors:
                wb.save(self.file_path)
                return len(new_vendors)
            return 0
            
        except Exception as e:
            print(f"Error syncing vendors: {e}")
            return 0

    def update_vendor_item(self, vendor_name, new_item):
        """
        Updates the 'Item' column for a specific vendor in '거래처정보' sheet.
        """
        try:
            wb = load_workbook(self.file_path)
            if '거래처정보' not in wb.sheetnames:
                return False
            
            ws = wb['거래처정보']
            found = False
            
            # Search for vendor
            for row in ws.iter_rows(min_row=2, max_col=2):
                cell_vendor = row[0]
                cell_item = row[1]
                
                if cell_vendor.value == vendor_name:
                    cell_item.value = new_item
                    found = True
                    break
            
            if found:
                wb.save(self.file_path)
                return True
            return False
            
        except Exception as e:
            print(f"Error updating vendor item: {e}")
            return False

    def add_expense(self, date_str: str, item: str, amount: int, category: str = "기타"):
        """
        Adds an expense record to the appropriate monthly sheet.
        date_str: "YYYY-MM-DD"
        """
        try:
            # Parse date to find month
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            month = dt.month
            
            # Map month to sheet name (Need to match Excel sheet names like '9월비용')
            # The file has '7월비용' ... '12월비용'
            sheet_name = f"{month}월비용"
            
            # Helper to check if sheet exists
            xl = pd.ExcelFile(self.file_path)
            if sheet_name not in xl.sheet_names:
                # Fallback or error?
                # Maybe the file only has 9-12?
                # Let's check available sheets
                if sheet_name not in xl.sheet_names:
                    return {"status": "error", "message": f"Sheet {sheet_name} not found"}
            
            # Load the workbook using openpyxl for editing
            from openpyxl import load_workbook
            wb = load_workbook(self.file_path)
            ws = wb[sheet_name]
            
            # Find first empty row (assuming standard list format)
            # We should append to the bottom.
            # Assuming columns: Date | Item | Amount | Category ...
            # Need to know the column structure of cost sheets.
            # For now, let's append to the end.
            ws.append([date_str, item, amount, category])
            
            wb.save(self.file_path)
            return {"status": "success", "message": f"Added to {sheet_name}"}
            
        except Exception as e:
            print(f"Error adding expense: {e}")
            return {"status": "error", "message": str(e)}
    def parse_upload(self, file_contents: bytes):
        """
        Parses an uploaded Excel file.
        Expected columns: '날짜', '항목', '금액', '분류' (or similar).
        Returns a list of dictionaries.
        """
        import io
        try:
            # Read into pandas
            df = pd.read_excel(io.BytesIO(file_contents))
            
            # Simple column mapping logic
            # We look for columns that might match
            cols = df.columns.tolist()
            
            # Helper to find column
            def find_col(keywords):
                for c in cols:
                    if any(k in str(c) for k in keywords):
                        return c
                return None
            
            date_col = find_col(['날짜', 'Date', '일자'])
            item_col = find_col(['항목', 'Item', '내역', '사용처'])
            amount_col = find_col(['금액', 'Amount', '비용'])
            addr_col = find_col(['분류', 'Category']) # Optional
            
            if not (date_col and amount_col):
                return {"status": "error", "message": "필수 컬럼(날짜, 금액)을 찾을 수 없습니다."}
            
            results = []
            for _, row in df.iterrows():
                try:
                    d_val = row[date_col]
                    # Handle date formats
                    if isinstance(d_val, datetime.datetime):
                        d_str = d_val.strftime("%Y-%m-%d")
                    else:
                        d_str = str(d_val)[:10] # Naive string slice
                        
                    amt = row[amount_col]
                    amt = int(amt) if pd.notna(amt) and str(amt).replace(',','').replace('.','').isdigit() else 0
                    
                    item = str(row[item_col]) if item_col and pd.notna(row[item_col]) else "미지정"
                    cat = str(row[addr_col]) if addr_col and pd.notna(row[addr_col]) else "기타"
                    
                    results.append({
                        "date": d_str,
                        "item": item,
                        "amount": amt,
                        "category": cat
                    })
                except Exception as row_e:
                    continue # Skip bad rows
                    
            return {"status": "success", "data": results}
            
        except Exception as e:
            return {"status": "error", "message": f"Excel parsing error: {str(e)}"}
