import sqlite3
import os

def fix_empty_contracts():
    db_path = os.path.join("backend", "sodam_database.db")
    if not os.path.exists(db_path):
        db_path = "sodam_database.db"
        
    default_text = """표준근로계약서

임춘우(이하 "사업주"라 함)와 {name}(이하 "근로자"라 함)은(는) 다음과 같이
근로계약을 체결한다.

1. 근로계약기간 : {start_date}부터        년    월      일까지
2. 근 무 장 소 : 소담김밥 건대본점 매장
3. 업무의 내용 : 주방업무( )/ 카운터업무( ) / 마감 청소업무(   )
4. 소정근로시간 :         시   분부터     시   분까지 (휴게시간 : 시 분 ~     시   분)
5. 근무일/휴일 : 매주 일 근무, 주휴일 매주 요일
6. 임 금
- 월(일, 시)급 : {wage} 원
- 상여금 : 있음(     ), 없음(     )
- 기타 급여(제 수당 등) : 있음( 주휴수당),  없음(        )
- 지급일 : 매월(매주 또는 매일) 말일(휴일의 경우는 전일 지급)
- 지급 방법 : 근로자에게 직접 지급(      ), 예금통장에 입금 (       )
7. 연차유급휴가
- 연차유급휴가는 근로기준법에서 정하는 바에 따라 부여함
8. 근로계약서 교뷰
- 사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의
교부요구와 관계없이 근로자에게 교부함(근로기준법 제17조 이행)
9. 수습 기간
- 입사 개시 후 3개월은 당사의 업무 수습 근로자의 자격으로 근무한다.
10. 기타
- 이 계약에 정함이 없는 사항은 근로기준법령에 의함.

2026년       월    일
(사업주) 사업체명 : 소담김밥       전 화 : 02- 452-6570
주 소 : 서울시 광진구 능동로 110 스타시티 영존빌딩 B208호
                                  대 표 자 :   임  춘 우  (서명)

(근로자) 주 소 :                                                                                연 락 처 : {phone}
                                       성  명 : {name}                    (서명)"""

    print(f"Connecting to: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Update empty contracts
        cursor.execute("UPDATE electroniccontract SET content = ? WHERE length(content) = 0 OR content IS NULL", (default_text,))
        print(f"Updated {cursor.rowcount} empty contracts with default text.")
        
        # Also ensure GlobalSetting has this text if missing
        cursor.execute("SELECT value FROM globalsetting WHERE key = 'contract_template'")
        if not cursor.fetchone():
            print("Inserting default contract_template into globalsetting...")
            cursor.execute("INSERT INTO globalsetting (key, value) VALUES (?, ?)", ('contract_template', default_text))
            
        conn.commit()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_empty_contracts()
