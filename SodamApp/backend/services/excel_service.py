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
                    # read_html does not support 'nrows', remove it if present
                    html_kwargs = kwargs.copy()
                    if 'nrows' in html_kwargs:
                        del html_kwargs['nrows']
                        
                    dfs = pd.read_html(io.BytesIO(content), **html_kwargs)
                    if dfs:
                        # Return the dataframe with the most rows/columns roughly
                        best_df = max(dfs, key=lambda x: x.size)
                        return best_df
                except Exception as e:
                    error_list.append(f"HTML Parser: {str(e)}")
                
                # If all failed
                raise ValueError(f"Failed to read file. Errors: {'; '.join(error_list)}")
            
            # Read the file
            # Note: We skip the 'preview' step with nrows because read_html doesn't support it 
            # and it causes issues. We'll read the whole file and find headers in-memory.
            try:
                df = read_excel_safe(file_contents)
            except Exception as e:
                 return {"status": "error", "message": f"파일 읽기 실패: {str(e)}"}

            # Post-load Header Detection
            # If the first row doesn't look like a header, scan specifically for headers
            cols = [str(c).strip() for c in df.columns.tolist()]
            
            # Keywords to identify header row
            header_keywords = ['이용일자', '승인일자', '거래일자', '날짜', 'Date', '일자']
            
            found_header_idx = -1
            
            # Check if current columns are already headers
            if any(k in str(c) for c in cols for k in header_keywords):
                found_header_idx = -2 # Already good
            else:
                # Scan first 20 rows for header
                for i, row in df.head(20).iterrows():
                    row_text = ' '.join([str(v) for v in row.values if pd.notna(v)])
                    if any(k in row_text for k in header_keywords):
                        found_header_idx = i
                        break
            
            # Apply new header if found
            if found_header_idx >= 0:
                # Set row i as header
                new_header = df.iloc[found_header_idx]
                df = df.iloc[found_header_idx + 1:]
                df.columns = new_header
                cols = [str(c).strip() for c in df.columns.tolist()]
                
            # Now proceed with detection
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
                        # Handle various date formats
                        d_clean = d_val.strip()
                        
                        # Korean format: "2026년 01월 31일" or "2026년01월31일"
                        if '년' in d_clean:
                            import re
                            match = re.search(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일?', d_clean)
                            if match:
                                year, month, day = match.groups()
                                d_str = f"{year}-{int(month):02d}-{int(day):02d}"
                            else:
                                # Only year and month: "2026년 01월" - skip this row
                                skipped += 1
                                continue
                        else:
                            # Standard formats: 2026.01.31, 2026-01-31, 2026/01/31
                            d_clean = d_clean.replace('.', '-').replace('/', '-')
                            d_str = d_clean[:10]
                    else:
                        d_str = str(d_val)[:10]
                    
                    # Validate date format (must be YYYY-MM-DD with at least 10 chars)
                    if not d_str or len(d_str) < 8 or d_str in ['-', '--', '---']:
                        skipped += 1
                        continue
                    # Additional check: must contain digits
                    if not any(c.isdigit() for c in d_str):
                        skipped += 1
                        continue
                    
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

    # --- Card company → vendor name mapping for revenue upload ---
    CARD_VENDOR_MAP = {
        '신한카드': '소담김밥 건대본점 신한카드',
        'KB카드': '소담김밥 건대본점 국민카드',
        'KB국민카드': '소담김밥 건대본점 국민카드',
        '비씨카드': '소담김밥 건대본점 BC카드',
        '현대카드': '소담김밥 건대본점 현대카드',
        '하나카드': '소담김밥 건대본점 하나카드',
        '하나구외환': '소담김밥 건대본점 하나카드',
        '삼성카드': '소담김밥 건대본점 삼성카드',
        '롯데카드': '소담김밥 건대본점 롯데카드',
        '신롯데카드': '소담김밥 건대본점 롯데카드',
        '우리카드': '소담김밥 건대본점 우리카드',
        '농협카드': '소담김밥 건대본점 농협카드',
        'NH카드': '소담김밥 건대본점 농협카드',
        'NH농협카드': '소담김밥 건대본점 농협카드',
        '카카오페이': '소담김밥 건대본점 카카오페이',
    }
    CASH_VENDOR_NAME = '소담김밥 건대본점 현금매출'

    def parse_revenue_upload(self, file_contents: bytes):
        """
        Smart revenue file parser. Auto-detects file type and returns structured data.
        
        Supported formats:
        1. POS 일자별 매출내역 (총매출, 현금, 카드 breakdown per day)
        2. 카드상세매출내역 (individual card transactions)
        3. 월별 카드매출내역 (monthly card summary)
        
        Returns:
            dict with keys: status, file_type, data[], summary{}
            data items: { date, amount, vendor_name, note }
        """
        import io
        
        try:
            # Try to read the file with different engines
            df = None
            for engine_name in ['openpyxl', 'xlrd', None]:
                try:
                    if engine_name:
                        df = pd.read_excel(io.BytesIO(file_contents), header=None, engine=engine_name)
                    else:
                        df = pd.read_excel(io.BytesIO(file_contents), header=None)
                    break
                except Exception:
                    continue
            
            if df is None:
                # Try HTML (Korean .xls files are often HTML)
                try:
                    dfs = pd.read_html(io.BytesIO(file_contents))
                    if dfs:
                        df = max(dfs, key=lambda x: x.size)
                except Exception:
                    pass
            
            if df is None:
                return {"status": "error", "message": "파일을 읽을 수 없습니다."}
            
            # --- Detect file type by scanning first few rows ---
            # Priority 1: Known specific formats (exact keyword match)
            first_rows_text = ''
            for i in range(min(5, len(df))):
                row_vals = [str(v) for v in df.iloc[i].tolist() if pd.notna(v)]
                first_rows_text += ' '.join(row_vals) + ' '
            
            if '매출일자' in first_rows_text and ('총매출' in first_rows_text or '순매출' in first_rows_text):
                return self._parse_pos_daily_revenue(df)
            elif '기간별 승인내역' in first_rows_text or ('No.' in first_rows_text and '카드사' in first_rows_text and '승인금액' in first_rows_text):
                return self._parse_card_detail_revenue(df)
            elif '월별 승인내역' in first_rows_text:
                return self._parse_card_summary_revenue(df)
            
            # Priority 1.5: Delivery app packed format (쿠팡이츠 등)
            # Single-column format like: "1. 2026.02.27기본정산286,792원724,366원"
            if len(df.columns) <= 2 and ('기본정산' in first_rows_text or '인출' in first_rows_text):
                return self._parse_delivery_settlement(df)
            
            # Priority 2: Universal pattern-based detection (any POS vendor)
            return self._parse_universal_revenue(df, file_contents)
        
        except Exception as e:
            import traceback
            return {"status": "error", "message": f"매출 파일 파싱 오류: {str(e)}"}

    def _parse_delivery_settlement(self, df):
        """
        Parse delivery app settlement files with packed single-column format.
        Supports: 쿠팡이츠, and similar formats.
        
        Format: "1. 2026.02.27인출-724,366원0원"
        '인출' entries = actual money deposited to bank = revenue for P&L.
        '기본정산' = Coupang-side receipt (not yet deposited), skipped.
        """
        import re
        
        # Regex: number. date type amount원 balance원
        pattern = re.compile(
            r'\d+\.\s*'
            r'(\d{4}\.\d{2}\.\d{2})'
            r'(기본정산|인출|보정|기타)'
            r'(-?[\d,]+)원'
        )
        
        daily_revenue = {}
        total_count = 0
        
        for _, row in df.iterrows():
            text = str(row.iloc[0])
            match = pattern.search(text)
            if not match:
                continue
            
            date_str = match.group(1).replace('.', '-')  # 2026.02.27 -> 2026-02-27
            tx_type = match.group(2)
            amount_str = match.group(3).replace(',', '')
            
            try:
                amount = int(amount_str)
            except ValueError:
                continue
            
            # 인출 = actual deposit to bank account = revenue for P&L
            # Amount is negative in source, so use abs()
            if tx_type == '인출':
                daily_revenue[date_str] = daily_revenue.get(date_str, 0) + abs(amount)
                total_count += 1
        
        results = []
        total_amount = 0
        date_range = [None, None]
        
        for date_str in sorted(daily_revenue.keys()):
            amount = daily_revenue[date_str]
            if date_range[0] is None:
                date_range[0] = date_str
            date_range[1] = date_str
            
            results.append({
                'date': date_str,
                'amount': amount,
                'vendor_name': '쿠팡이츠',
                'note': '쿠팡이츠 정산',
                'payment_type': 'delivery',
            })
            total_amount += amount
        
        return {
            "status": "success",
            "file_type": "delivery_settlement",
            "file_type_label": "🛵 배달앱 정산 (쿠팡이츠)",
            "data": results,
            "summary": {
                "total_amount": total_amount,
                "record_count": len(results),
                "transaction_count": total_count,
                "date_range": date_range,
            }
        }

    # ─── Keyword sets for universal column detection ───
    DATE_KEYWORDS = ['일자', '날짜', '일시', 'date', '매출일']
    AMOUNT_KEYWORDS = ['금액', '매출', '승인금액', '매출액', '결제금액', '승인액', 'amount']
    CARD_CORP_KEYWORDS = ['카드사', '매입사', '카드사명', '매입사명', '매입카드사', '발급사', '카드종류']
    CASH_KEYWORDS = ['현금', 'cash', '현금매출']
    CARD_TOTAL_KEYWORDS = ['카드매출', '카드합계', '카드', '신용카드']
    STATUS_KEYWORDS = ['구분', '승인구분', '상태', '거래구분', '유형']
    TOTAL_KEYWORDS = ['총매출', '총액', '합계', '순매출', '총합', 'total']

    def _parse_universal_revenue(self, df, file_contents):
        """
        Universal revenue file parser — works with any POS vendor format.
        
        Strategy:
        1. Auto-detect header row by scanning for date/amount keywords
        2. Map columns flexibly using broad keyword sets
        3. Classify file as 'daily_summary' or 'card_detail' by data pattern
        4. Parse and return structured data
        """
        import io
        
        # Step 1: Find header row
        header_row = -1
        for i in range(min(10, len(df))):
            row_vals = [str(v).strip() for v in df.iloc[i].tolist() if pd.notna(v)]
            row_text = ' '.join(row_vals)
            has_date = any(k in row_text for k in self.DATE_KEYWORDS)
            has_amount = any(k in row_text for k in self.AMOUNT_KEYWORDS)
            if has_date and has_amount:
                header_row = i
                break
        
        if header_row < 0:
            return {"status": "error", "message": "날짜/금액 컬럼을 자동 감지할 수 없습니다. 헤더 행에 '일자', '금액' 등의 키워드가 포함되어야 합니다."}
        
        # Re-read with proper header
        new_header = [str(v).strip() if pd.notna(v) else f'col_{j}' for j, v in enumerate(df.iloc[header_row])]
        data_df = df.iloc[header_row + 1:].copy()
        data_df.columns = new_header
        cols = list(data_df.columns)
        
        # Step 2: Map columns using keyword matching
        def find_col(keywords, exclude=None):
            for c in cols:
                cl = c.lower() if c else ''
                if any(k in c or k in cl for k in keywords):
                    if exclude and any(ex in c for ex in exclude):
                        continue
                    return c
            return None
        
        date_col = find_col(self.DATE_KEYWORDS)
        amount_col = find_col(self.AMOUNT_KEYWORDS, exclude=['현금', 'cash'])
        card_corp_col = find_col(self.CARD_CORP_KEYWORDS)
        status_col = find_col(self.STATUS_KEYWORDS)
        
        # Look for separate cash/card total columns (daily summary files)
        cash_col = find_col(self.CASH_KEYWORDS)
        card_total_col = find_col(self.CARD_TOTAL_KEYWORDS, exclude=['카드사'])
        total_col = find_col(self.TOTAL_KEYWORDS)
        
        if not date_col:
            return {"status": "error", "message": f"날짜 컬럼을 찾을 수 없습니다. 감지된 컬럼: {cols[:15]}"}
        if not amount_col and not total_col and not (cash_col or card_total_col):
            return {"status": "error", "message": f"금액 컬럼을 찾을 수 없습니다. 감지된 컬럼: {cols[:15]}"}
        
        print(f"[Universal] date={date_col}, amount={amount_col}, card_corp={card_corp_col}, "
              f"status={status_col}, cash={cash_col}, card_total={card_total_col}, total={total_col}")

        # Step 3: Classify file type by data pattern
        # Count date frequency — daily summary has ~1 row/date, detail has many
        date_counts = {}
        sample_size = min(100, len(data_df))
        for i in range(sample_size):
            dv = data_df.iloc[i].get(date_col)
            if pd.notna(dv):
                ds = str(dv)[:10]
                date_counts[ds] = date_counts.get(ds, 0) + 1
        
        avg_rows_per_date = (sum(date_counts.values()) / len(date_counts)) if date_counts else 1
        
        # If card company column exists AND avg > 2 rows per date → card transaction detail
        # If separate cash/card columns exist OR avg ≈ 1 → daily summary
        is_daily_summary = (cash_col or card_total_col or total_col) and not card_corp_col and avg_rows_per_date < 3
        is_card_detail = card_corp_col is not None and avg_rows_per_date >= 2
        
        # Fallback: if card corp column exists, treat as detail regardless
        if card_corp_col and not is_daily_summary:
            is_card_detail = True
        
        if is_daily_summary:
            return self._parse_universal_daily_summary(data_df, date_col, cash_col, card_total_col, total_col)
        elif is_card_detail:
            return self._parse_universal_card_detail(data_df, date_col, amount_col, card_corp_col, status_col)
        else:
            # Generic: treat as card detail if possible, otherwise daily
            if amount_col:
                return self._parse_universal_card_detail(data_df, date_col, amount_col, card_corp_col, status_col)
            return {"status": "error", "message": f"파일 유형을 분류할 수 없습니다. 컬럼: {cols[:15]}"}

    def _parse_universal_daily_summary(self, df, date_col, cash_col, card_col, total_col):
        """Parse a daily summary file (one row per day, cash/card breakdown)."""
        results = []
        total_amount = 0
        date_range = [None, None]
        
        def clean_num(val):
            if pd.isna(val): return 0
            try: return int(float(str(val).replace(',', '').replace('원', '')))
            except: return 0
        
        for _, row in df.iterrows():
            date_val = row.get(date_col)
            if pd.isna(date_val): continue
            
            if isinstance(date_val, datetime.datetime):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                ds = str(date_val).strip().replace('.', '-').replace('/', '-')
                if len(ds) >= 10:
                    date_str = ds[:10]
                elif len(ds) >= 8 and ds[:4].isdigit():
                    date_str = f"{ds[:4]}-{ds[4:6]}-{ds[6:8]}"
                else:
                    continue
            
            # Validate date
            try:
                datetime.datetime.strptime(date_str[:10], '%Y-%m-%d')
            except:
                continue
            
            if date_range[0] is None: date_range[0] = date_str
            date_range[1] = date_str
            
            cash = clean_num(row.get(cash_col)) if cash_col else 0
            card = clean_num(row.get(card_col)) if card_col else 0
            total = clean_num(row.get(total_col)) if total_col else 0
            
            # If only total is available (no cash/card breakdown)
            if total > 0 and cash == 0 and card == 0:
                card = total  # Assume total is card if no breakdown
            
            # If we have total but no separate, use ratio
            if total > 0 and (cash + card) > 0 and abs(total - (cash + card)) > 100:
                # Total includes VAT or fees — scale proportionally
                ratio = total / (cash + card) if (cash + card) > 0 else 1
                cash = int(cash * ratio)
                card = int(card * ratio)
            
            if cash > 0:
                results.append({
                    'date': date_str, 'amount': cash,
                    'vendor_name': self.CASH_VENDOR_NAME,
                    'note': '현금매출', 'payment_type': 'cash',
                })
            if card > 0:
                results.append({
                    'date': date_str, 'amount': card,
                    'vendor_name': '카드매출(통합)',
                    'note': '카드매출', 'payment_type': 'card',
                })
            total_amount += (cash + card)
        
        return {
            "status": "success",
            "file_type": "pos_daily",
            "file_type_label": "📊 일자별 매출내역 (자동감지)",
            "data": results,
            "summary": {
                "total_amount": total_amount,
                "record_count": len(results),
                "date_range": date_range,
            }
        }
    
    def _parse_universal_card_detail(self, df, date_col, amount_col, card_corp_col, status_col):
        """Parse a card transaction detail file (many rows per day)."""
        daily_card = {}
        total_count = 0
        cancel_count = 0
        
        for _, row in df.iterrows():
            date_val = row.get(date_col)
            amount_val = row.get(amount_col) if amount_col else None
            
            if pd.isna(date_val) or (amount_val is not None and pd.isna(amount_val)):
                continue
            
            # Parse date
            if isinstance(date_val, datetime.datetime):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                ds = str(date_val).strip().replace('.', '-').replace('/', '-')
                if '-' in ds:
                    date_str = ds[:10]
                elif len(ds) >= 8 and ds[:4].isdigit():
                    date_str = f"{ds[:4]}-{ds[4:6]}-{ds[6:8]}"
                else:
                    continue
            
            # Validate date
            try:
                datetime.datetime.strptime(date_str[:10], '%Y-%m-%d')
            except:
                continue
            
            # Parse amount
            try:
                amt = int(float(str(amount_val).replace(',', '').replace('원', '')))
            except (ValueError, TypeError):
                continue
            
            # Check cancellation
            if status_col:
                tx_type = str(row.get(status_col, '')).strip()
                if '취소' in tx_type:
                    amt = -amt
                    cancel_count += 1
                else:
                    total_count += 1
            else:
                total_count += 1
            
            # Card company name
            if card_corp_col and pd.notna(row.get(card_corp_col)):
                card_name = str(row.get(card_corp_col)).strip()
            else:
                card_name = '기타카드'
            
            key = (date_str, card_name)
            daily_card[key] = daily_card.get(key, 0) + amt
        
        results = []
        total_amount = 0
        date_range = [None, None]
        
        for (date_str, card_name), amount in sorted(daily_card.items()):
            if amount <= 0:
                continue
            
            vendor_name = self.CARD_VENDOR_MAP.get(card_name, f'기타카드({card_name})')
            
            if date_range[0] is None: date_range[0] = date_str
            date_range[1] = date_str
            
            results.append({
                'date': date_str, 'amount': amount,
                'vendor_name': vendor_name,
                'note': f'카드매출({card_name})',
                'payment_type': 'card',
                'card_company': card_name,
            })
            total_amount += amount
        
        return {
            "status": "success",
            "file_type": "card_detail",
            "file_type_label": "💳 카드매출 상세 (자동감지)",
            "data": results,
            "summary": {
                "total_amount": total_amount,
                "record_count": len(results),
                "transaction_count": total_count,
                "cancel_count": cancel_count,
                "date_range": date_range,
            }
        }

    def _parse_pos_card_detail_revenue(self, df):
        """Parse POS system card sales detail file (신용카드 매출내역).
        Columns: NO, 구분, 영업일자, 거래일자, 거래시간, 포스번호, 승인번호,
                 카드번호, 카드사명, 매입사명, 승인금액, 할부, 승인구분, ...
        """
        # Find header row
        header_row = 0
        for i in range(min(5, len(df))):
            row_vals = [str(v) for v in df.iloc[i].tolist() if pd.notna(v)]
            row_text = ' '.join(row_vals)
            if ('영업일자' in row_text or '거래일자' in row_text) and '승인금액' in row_text:
                header_row = i
                break

        # Set header
        new_header = [str(v).strip() if pd.notna(v) else f'col_{j}' for j, v in enumerate(df.iloc[header_row])]
        data_df = df.iloc[header_row + 1:].copy()
        data_df.columns = new_header

        # Resolve column names
        date_col = None
        for c in ['영업일자', '거래일자', '승인일자']:
            if c in data_df.columns:
                date_col = c
                break

        card_col = None
        for c in ['카드사명', '매입사명', '매입카드사']:
            if c in data_df.columns:
                card_col = c
                break

        status_col = None
        for c in ['구분', '승인구분']:
            if c in data_df.columns:
                status_col = c
                break

        if not date_col or '승인금액' not in data_df.columns:
            return {"status": "error", "message": "신용카드 매출내역 컬럼을 인식할 수 없습니다."}

        daily_card = {}
        total_count = 0
        cancel_count = 0

        for _, row in data_df.iterrows():
            date_val = row.get(date_col)
            amount_val = row.get('승인금액')

            if pd.isna(date_val) or pd.isna(amount_val):
                continue

            # Parse date
            if isinstance(date_val, datetime.datetime):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                ds = str(date_val).strip()
                if '-' in ds:
                    date_str = ds[:10]
                elif len(ds) >= 8 and ds[:4].isdigit():
                    date_str = f"{ds[:4]}-{ds[4:6]}-{ds[6:8]}"
                else:
                    continue

            # Parse amount
            try:
                amt = int(float(str(amount_val).replace(',', '')))
            except (ValueError, TypeError):
                continue

            # Check cancellation
            tx_type = str(row.get(status_col, '')).strip() if status_col else ''
            if '취소' in tx_type:
                amt = -amt
                cancel_count += 1
            else:
                total_count += 1

            card_name = str(row.get(card_col, '기타카드')).strip() if card_col else '기타카드'
            key = (date_str, card_name)
            daily_card[key] = daily_card.get(key, 0) + amt

        results = []
        total_amount = 0
        date_range = [None, None]

        for (date_str, card_name), amount in sorted(daily_card.items()):
            if amount <= 0:
                continue

            vendor_name = self.CARD_VENDOR_MAP.get(card_name, f'기타카드({card_name})')

            if date_range[0] is None:
                date_range[0] = date_str
            date_range[1] = date_str

            results.append({
                'date': date_str,
                'amount': amount,
                'vendor_name': vendor_name,
                'note': f'카드매출({card_name})',
                'payment_type': 'card',
                'card_company': card_name,
            })
            total_amount += amount

        return {
            "status": "success",
            "file_type": "card_detail",
            "file_type_label": "💳 신용카드 매출내역 (POS)",
            "data": results,
            "summary": {
                "total_amount": total_amount,
                "record_count": len(results),
                "transaction_count": total_count,
                "cancel_count": cancel_count,
                "date_range": date_range,
            }
        }

    def _parse_pos_daily_revenue(self, df):
        """Parse POS daily revenue file (File 3 format)."""
        # Find header row with '매출일자'
        header_row = 0
        for i in range(min(5, len(df))):
            row_vals = [str(v) for v in df.iloc[i].tolist() if pd.notna(v)]
            if '매출일자' in row_vals:
                header_row = i
                break
        
        results = []
        total_amount = 0
        date_range = [None, None]
        data_start = header_row + 2  # skip main + sub header
        
        for i in range(data_start, len(df)):
            row = df.iloc[i]
            date_val = row.iloc[0]
            
            if pd.isna(date_val) or str(date_val).startswith('합'):
                continue
            
            if isinstance(date_val, datetime.datetime):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                date_str = str(date_val)[:10]
            
            total = int(row.iloc[6]) if pd.notna(row.iloc[6]) and row.iloc[6] != 0 else 0
            cash_net = int(row.iloc[14]) if pd.notna(row.iloc[14]) and row.iloc[14] != 0 else 0
            card_net = int(row.iloc[15]) if pd.notna(row.iloc[15]) and row.iloc[15] != 0 else 0
            
            if total == 0:
                continue
            
            # FIX: User wants Gross Sales (inc. VAT).
            # iloc[6] is Total Gross. iloc[14/15] are Net.
            # We calculate ratio to scale Net -> Gross.
            net_sum = cash_net + card_net
            vat_ratio = (total / net_sum) if net_sum > 0 else 1.0
            
            # If ratio is close to 1.1, apply it. If it's 1.0, data is already Gross.
            # Just apply generally to align with Total Gross.
            cash = int(cash_net * vat_ratio)
            card = int(card_net * vat_ratio)

            if date_range[0] is None:
                date_range[0] = date_str
            date_range[1] = date_str
            
            if cash > 0:
                results.append({
                    'date': date_str,
                    'amount': cash,
                    'vendor_name': self.CASH_VENDOR_NAME,
                    'note': '현금매출',
                    'payment_type': 'cash',
                })
            
            if card > 0:
                results.append({
                    'date': date_str,
                    'amount': card,
                    'vendor_name': '카드매출(통합)',
                    'note': '카드매출',
                    'payment_type': 'card',
                })
            
            total_amount += (cash + card)
        
        return {
            "status": "success",
            "file_type": "pos_daily",
            "file_type_label": "📊 POS 일자별 매출내역",
            "data": results,
            "summary": {
                "total_amount": total_amount,
                "record_count": len(results),
                "date_range": date_range,
            }
        }

    def _parse_card_detail_revenue(self, df):
        """Parse card transaction detail file (File 2 format)."""
        header_row = 0
        for i in range(min(5, len(df))):
            row_vals = [str(v) for v in df.iloc[i].tolist() if pd.notna(v)]
            if 'No.' in row_vals or ('구분' in row_vals and '카드사' in row_vals):
                header_row = i
                break
        
        data_start = header_row + 1
        daily_card = {}
        total_count = 0
        cancel_count = 0
        
        for i in range(data_start, len(df)):
            row = df.iloc[i]
            date_val = row.iloc[2]
            card_company = row.iloc[4]
            tx_type = row.iloc[1]
            amount = row.iloc[8]
            
            if pd.isna(date_val) or pd.isna(amount):
                continue
            
            if isinstance(date_val, datetime.datetime):
                date_str = date_val.strftime('%Y-%m-%d')
            else:
                date_str = str(date_val)[:10]
            
            try:
                amt = int(float(str(amount).replace(',', '')))
            except (ValueError, TypeError):
                continue
            
            if str(tx_type) == '취소':
                amt = -amt
                cancel_count += 1
            else:
                total_count += 1
            
            card_name = str(card_company).strip() if pd.notna(card_company) else '기타카드'
            key = (date_str, card_name)
            daily_card[key] = daily_card.get(key, 0) + amt
        
        results = []
        total_amount = 0
        date_range = [None, None]
        
        for (date_str, card_name), amount in sorted(daily_card.items()):
            if amount <= 0:
                continue
            
            vendor_name = self.CARD_VENDOR_MAP.get(card_name, f'기타카드({card_name})')
            
            if date_range[0] is None:
                date_range[0] = date_str
            date_range[1] = date_str
            
            results.append({
                'date': date_str,
                'amount': amount,
                'vendor_name': vendor_name,
                'note': f'카드매출({card_name})',
                'payment_type': 'card',
                'card_company': card_name,
            })
            total_amount += amount
        
        return {
            "status": "success",
            "file_type": "card_detail",
            "file_type_label": "💳 카드 상세매출내역",
            "data": results,
            "summary": {
                "total_amount": total_amount,
                "record_count": len(results),
                "transaction_count": total_count,
                "cancel_count": cancel_count,
                "date_range": date_range,
            }
        }

    def _parse_card_summary_revenue(self, df):
        """Parse monthly card summary file (File 1 format)."""
        results = []
        total_amount = 0
        
        for i in range(len(df)):
            row = df.iloc[i]
            val = str(row.iloc[0])
            
            if len(val) >= 7 and val[4] == '-' and val[:4].isdigit():
                year_month = val[:7]
                amount = row.iloc[1]
                
                if pd.notna(amount):
                    try:
                        amt = int(float(str(amount).replace(',', '')))
                    except (ValueError, TypeError):
                        continue
                    
                    approval_total = int(float(str(row.iloc[3]).replace(',', ''))) if pd.notna(row.iloc[3]) else 0
                    approval_count = int(float(str(row.iloc[4]).replace(',', ''))) if pd.notna(row.iloc[4]) else 0
                    cancel_total = int(float(str(row.iloc[5]).replace(',', ''))) if pd.notna(row.iloc[5]) else 0
                    cancel_count = int(float(str(row.iloc[6]).replace(',', ''))) if pd.notna(row.iloc[6]) else 0
                    
                    results.append({
                        'year_month': year_month,
                        'net_amount': amt,
                        'approval_total': approval_total,
                        'approval_count': approval_count,
                        'cancel_total': cancel_total,
                        'cancel_count': cancel_count,
                    })
                    total_amount += amt
        
        return {
            "status": "success",
            "file_type": "card_summary",
            "file_type_label": "📈 월별 카드매출 요약",
            "data": results,
            "summary": {
                "total_amount": total_amount,
                "months": len(results),
            },
            "message": "월별 카드매출 요약 데이터입니다. 상세 매출 데이터를 입력하려면 '카드상세매출내역' 또는 'POS 일자별 매출' 파일을 업로드해 주세요."
        }
