import pandas as pd
import os
import datetime

# Hardcoded path for now, can be moved to config
EXCEL_PATH = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(9~12).xlsx"

class ExcelService:
    def __init__(self, file_path=None):
        self.file_path = file_path
        # Only check existence if a real path is provided (not None and not "dummy_path")
        if self.file_path and self.file_path != "dummy_path" and not os.path.exists(self.file_path):
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
        Smart parser that auto-detects card company format and parses accordingly.
        Supports: 롯데카드, 신한카드, 삼성카드, KB국민카드, 현대카드, 은행 송금내역, 일반 형식
        Supports both .xls and .xlsx formats
        """
        import io
        try:
            # Helper function to read excel with fallback engines
            def read_excel_safe(content, **kwargs):
                """Try different engines for .xls/.xlsx compatibility and handle HTML masquerading as Excel"""
                error_list = []
                
                # 1. Try standard Excel engines
                engines = ['openpyxl', 'xlrd', None]
                for engine in engines:
                    try:
                        if engine:
                            return pd.read_excel(io.BytesIO(content), engine=engine, **kwargs)
                        else:
                            return pd.read_excel(io.BytesIO(content), **kwargs)
                    except Exception as e:
                        error_list.append(f"Engine {engine}: {str(e)}")
                        continue
                
                # 2. Try parsing as HTML (common in Korean finance for .xls files)
                try:
                    dfs = pd.read_html(io.BytesIO(content), **kwargs)
                    if dfs:
                        # Return the dataframe with the most rows/columns roughly
                        best_df = max(dfs, key=lambda x: x.size)
                        return best_df
                except Exception as e:
                    error_list.append(f"HTML Parser: {str(e)}")
                
                # If all failed
                raise ValueError(f"Failed to read file. Errors: {'; '.join(error_list)}")
            
            # Try reading with different header options
            df = None
            header_row = 0
            
            # First, try to detect the format by reading raw data
            try:
                df_preview = read_excel_safe(file_contents, header=None, nrows=10)
                
                # Detect card company by looking for keywords in first few rows
                preview_text = df_preview.to_string().lower()
                
                # Check for "카드이용내역" pattern (Lotte/Shinhan style)
                if '카드이용내역' in preview_text or '이용일자' in preview_text:
                    # Find the row with actual headers (이용일자, 이용가맹점, etc.)
                    for i, row in df_preview.iterrows():
                        row_text = ' '.join([str(v) for v in row.values if pd.notna(v)])
                        if '이용일자' in row_text or '승인일자' in row_text:
                            header_row = i
                            break
                            
                # Check for "거래내역조회" pattern (Bank statement style)
                if '거래내역조회' in preview_text or '거래일자' in preview_text:
                    for i, row in df_preview.iterrows():
                        row_text = ' '.join([str(v) for v in row.values if pd.notna(v)])
                        if '거래일자' in row_text:
                            header_row = i
                            break
                            
            except Exception as preview_err:
                print(f"Preview error: {preview_err}")
                pass
            
            # Read with detected header row
            df = read_excel_safe(file_contents, header=header_row)
            cols = [str(c).strip() for c in df.columns.tolist()]
            cols_lower = [c.lower() for c in cols]
            
            # Detect format and map columns
            format_detected = "unknown"
            date_col = None
            item_col = None
            amount_col = None
            category_col = None
            
            # Helper to find column by keywords
            def find_col(keywords):
                for i, c in enumerate(cols):
                    if any(k in c for k in keywords):
                        return cols[i]
                return None
            
            # Pattern 1: 롯데카드/신한카드 형식 (이용일자, 이용가맹점, 이용금액)
            if find_col(['이용일자', '승인일자', '결제일자']):
                format_detected = "card_statement"
                date_col = find_col(['이용일자', '승인일자', '결제일자', '거래일자'])
                item_col = find_col(['이용가맹점', '가맹점명', '가맹점', '사용처', '이용처'])
                amount_col = find_col(['이용금액', '결제금액', '승인금액', '사용금액', '금액'])
                category_col = find_col(['업종', '분류', '카테고리'])
            
            # Pattern 1.5: 신한은행/국민은행 송금내역 형식 (거래일자, 출금(원), 내용)
            elif find_col(['거래일자']) and find_col(['출금']):
                format_detected = "bank_transfer"
                date_col = find_col(['거래일자'])
                item_col = find_col(['내용', '적요', '거래내용', '메모'])
                amount_col = find_col(['출금', '출금(원)', '출금액', '이체금액'])
                category_col = None  # Bank statements usually don't have category
                
            # Pattern 2: 일반 지출 형식 (날짜, 항목, 금액)
            elif find_col(['날짜', 'Date', '일자']):
                format_detected = "standard"
                date_col = find_col(['날짜', 'Date', '일자'])
                item_col = find_col(['항목', 'Item', '내역', '사용처', '적요'])
                amount_col = find_col(['금액', 'Amount', '비용', '지출'])
                category_col = find_col(['분류', 'Category', '카테고리'])
            
            # Pattern 3: Fallback - use first few columns
            else:
                format_detected = "auto"
                # Try to find date-like column
                for c in cols:
                    if any(x in c for x in ['일', 'date', 'Date', '날']):
                        date_col = c
                        break
                if not date_col and len(cols) > 0:
                    date_col = cols[0]
                    
                # Amount column - look for numbers in column name or data
                for c in cols:
                    if any(x in c for x in ['금액', '원', 'amount', 'Amount', '비용']):
                        amount_col = c
                        break
                if not amount_col and len(cols) > 1:
                    # Try to find a numeric column
                    for c in cols[1:]:
                        try:
                            if df[c].dtype in ['int64', 'float64']:
                                amount_col = c
                                break
                        except:
                            pass
                            
                item_col = find_col(['항목', '가맹점', '내역', '사용처', '적요', '상호'])
            
            if not date_col:
                return {"status": "error", "message": "날짜 컬럼을 찾을 수 없습니다. (이용일자/날짜/Date)"}
            if not amount_col:
                return {"status": "error", "message": "금액 컬럼을 찾을 수 없습니다. (이용금액/금액/Amount)"}
            
            results = []
            skipped = 0
            
            for idx, row in df.iterrows():
                try:
                    # Parse date
                    d_val = row[date_col]
                    if pd.isna(d_val):
                        skipped += 1
                        continue
                        
                    if isinstance(d_val, (datetime.datetime, datetime.date)):
                        d_str = d_val.strftime("%Y-%m-%d")
                    elif isinstance(d_val, str):
                        # Handle various date formats: 2026.01.31, 2026-01-31, 2026/01/31
                        d_clean = d_val.strip().replace('.', '-').replace('/', '-')
                        d_str = d_clean[:10]
                    else:
                        d_str = str(d_val)[:10]
                    
                    # Parse amount
                    amt = row[amount_col]
                    if pd.isna(amt):
                        skipped += 1
                        continue
                    
                    # Handle various number formats: 7,900 / 7900 / 7900.0
                    if isinstance(amt, (int, float)):
                        amt = int(abs(amt))
                    else:
                        amt_str = str(amt).replace(',', '').replace('원', '').strip()
                        try:
                            amt = int(abs(float(amt_str)))
                        except:
                            skipped += 1
                            continue
                    
                    if amt == 0:
                        skipped += 1
                        continue
                    
                    # Parse item/vendor
                    item = "미지정"
                    if item_col and pd.notna(row.get(item_col)):
                        item = str(row[item_col]).strip()
                    
                    # Parse category
                    cat = "기타"
                    if category_col and pd.notna(row.get(category_col)):
                        cat = str(row[category_col]).strip()
                    
                    results.append({
                        "date": d_str,
                        "item": item,
                        "amount": amt,
                        "category": cat
                    })
                    
                except Exception as row_e:
                    skipped += 1
                    continue
            
            if not results:
                return {"status": "error", "message": f"파싱된 데이터가 없습니다. (형식: {format_detected}, 스킵: {skipped}행)"}
                    
            return {
                "status": "success", 
                "data": results,
                "format": format_detected,
                "parsed": len(results),
                "skipped": skipped
            }
            
        except Exception as e:
            import traceback
            return {"status": "error", "message": f"Excel 파싱 오류: {str(e)}"}

