import { useState } from 'react';
import { BookOpen, Upload, CreditCard, ArrowRightLeft, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronRight, Truck, Lock, ShoppingBag, ClipboardList, Filter } from 'lucide-react';
import './UserManual.css';

export default function UserManual() {
    const [openSections, setOpenSections] = useState({ revenue: true, delivery: true, dedup: true, steps: true, purchase: true, checklist: true, faq: true });

    const toggle = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div className="manual-page">
            <div className="manual-header">
                <h1><BookOpen size={28} /> 사용 매뉴얼</h1>
                <p>SodamFN 관리 시스템의 주요 기능 사용법을 안내합니다.</p>
            </div>

            {/* 목차 */}
            <div className="toc">
                <h3>📑 목차</h3>
                <ul className="toc-list">
                    <li><a href="#revenue-upload">매출 데이터 업로드</a></li>
                    <li><a href="#file-types">지원 파일 형식</a></li>
                    <li><a href="#delivery-upload">배달앱 정산 업로드</a></li>
                    <li><a href="#dedup">중복 방지 시스템</a></li>
                    <li><a href="#upload-steps">업로드 절차 (권장)</a></li>
                    <li><a href="#rollback">업로드 취소 (롤백)</a></li>
                    <li><a href="#purchase-smart">매입 관리 스마트 업로드</a></li>
                    <li><a href="#open-checklist">오픈 체크리스트 (직원용)</a></li>
                    <li><a href="#faq">자주 묻는 질문</a></li>
                </ul>
            </div>

            {/* ═══ 1. 매출 데이터 업로드 ═══ */}
            <div className="manual-section" id="revenue-upload">
                <h2 onClick={() => toggle('revenue')} style={{ cursor: 'pointer' }}>
                    {openSections.revenue ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <Upload size={20} /> 매출 데이터 업로드
                </h2>
                {openSections.revenue && (
                    <>
                        <p>
                            매출 관리 페이지에서 Excel 파일을 업로드하면 시스템이 자동으로 파일 형식을 감지하고
                            데이터를 분류하여 저장합니다. <strong>POS 벤더에 관계없이</strong> 대부분의 매출 파일을 지원합니다.
                        </p>

                        <h3 id="file-types">📂 지원 파일 형식</h3>
                        <table className="manual-table">
                            <thead>
                                <tr>
                                    <th>파일 유형</th>
                                    <th>자동 감지 조건</th>
                                    <th>저장되는 데이터</th>
                                    <th>금액 기준</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><span className="badge blue">일자별 매출내역</span></td>
                                    <td>날짜(1행/day) + 현금/카드 합계 컬럼</td>
                                    <td>일별 현금매출 + 카드매출(통합)</td>
                                    <td>공급가 기준 (부가세 비율 역산)</td>
                                </tr>
                                <tr>
                                    <td><span className="badge green">신용카드 매출내역</span></td>
                                    <td>날짜(N행/day) + 카드사명 + 승인금액</td>
                                    <td>일별 카드사별 카드매출</td>
                                    <td>✅ <strong>부가세 포함 (정확)</strong></td>
                                </tr>
                                <tr>
                                    <td><span className="badge amber">CREFIA 카드상세</span></td>
                                    <td>'기간별 승인내역' 키워드</td>
                                    <td>일별 카드사별 카드매출</td>
                                    <td>부가세 포함</td>
                                </tr>
                                <tr>
                                    <td><span className="badge red">월별 카드매출 요약</span></td>
                                    <td>'월별 승인내역' 키워드</td>
                                    <td>조회용 (DB 저장 안됨)</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td><span className="badge" style={{ background: '#9333ea' }}>쿠팡이츠 정산</span></td>
                                    <td>'기본정산', '인출' 키워드</td>
                                    <td>일별 배달앱 매출 (입금=인출)</td>
                                    <td>정산 입금액</td>
                                </tr>
                                <tr>
                                    <td><span className="badge" style={{ background: '#06b6d4' }}>배달의민족 정산</span></td>
                                    <td>'정산명세서' 또는 '주문중개'+'입금금액'</td>
                                    <td>일별 배달앱 매출 (상세시트)</td>
                                    <td>입금금액 기준</td>
                                </tr>
                                <tr>
                                    <td><span className="badge" style={{ background: '#ef4444' }}>요기요 정산</span></td>
                                    <td>'상호명'+'주문번호'+'주문일시' 키워드</td>
                                    <td>주문별→일별 집계 (수수료 자동계산)</td>
                                    <td>주문금액-수수료</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="info-box warning">
                            <span className="icon">⚠️</span>
                            <div>
                                <strong>금액 차이 주의:</strong> 「일자별 매출내역」의 카드매출은 <strong>공급가 기준</strong>이고,
                                「신용카드 매출내역」의 승인금액은 <strong>부가세 포함</strong>입니다.
                                따라서 카드매출은 <strong>신용카드 매출내역 파일이 더 정확</strong>합니다.
                            </div>
                        </div>

                        <h3>🔍 자동 감지 방식</h3>
                        <p>
                            시스템은 POS 벤더(이지포스, KIS, 포스뱅크 등)에 관계없이
                            <strong>컬럼 키워드</strong>와 <strong>데이터 패턴</strong>으로 파일을 자동 분류합니다:
                        </p>
                        <table className="manual-table">
                            <thead>
                                <tr>
                                    <th>감지 대상</th>
                                    <th>인식 키워드</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>날짜 컬럼</td><td>일자, 날짜, 일시, date, 매출일, 영업일자, 거래일자</td></tr>
                                <tr><td>금액 컬럼</td><td>금액, 매출, 승인금액, 결제금액, amount</td></tr>
                                <tr><td>카드사 컬럼</td><td>카드사, 매입사, 카드사명, 매입사명, 발급사</td></tr>
                                <tr><td>현금 컬럼</td><td>현금, cash, 현금매출</td></tr>
                                <tr><td>거래구분</td><td>구분, 승인구분, 상태, 거래구분</td></tr>
                            </tbody>
                        </table>
                    </>
                )}
            </div>

            {/* ═══ 1.5. 배달앱 정산 업로드 ═══ */}
            <div className="manual-section" id="delivery-upload">
                <h2 onClick={() => toggle('delivery')} style={{ cursor: 'pointer' }}>
                    {openSections.delivery ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <Truck size={20} /> 배달앱 정산 업로드
                </h2>
                {openSections.delivery && (
                    <>
                        <p>
                            배달의민족, 쿠팡이츠, 요기요 등 배달앱 정산 파일을 업로드할 수 있습니다.
                            매장 매출(카드/현금)과는 <strong>별도 카테고리</strong>로 관리되므로 중복 걱정 없이 업로드하면 됩니다.
                        </p>

                        <h3>🛵 지원 배달앱</h3>
                        <table className="manual-table">
                            <thead>
                                <tr><th>배달앱</th><th>파일 형식</th><th>파싱 방식</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>쿠팡이츠</strong></td>
                                    <td>정산내역.xlsx (비밀번호 없음)</td>
                                    <td>'인출' 항목을 일별 정산금으로 추출</td>
                                </tr>
                                <tr>
                                    <td><strong>배달의민족</strong></td>
                                    <td>정산명세서.xlsx (비밀번호 보호)</td>
                                    <td>상세 시트에서 입금일별 정산금 추출</td>
                                </tr>
                                <tr>
                                    <td><strong>요기요</strong></td>
                                    <td>정산내역.xlsx (비밀번호 없음)</td>
                                    <td>주문별 데이터를 일별 집계, 수수료 자동 계산</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="info-box tip">
                            <span className="icon"><Lock size={16} /></span>
                            <div>
                                <strong>비밀번호 보호 파일:</strong> 배달의민족 등 비밀번호가 설정된 Excel 파일은
                                자동으로 감지됩니다. 공통 비밀번호로 먼저 시도하고, 실패 시
                                <strong> 비밀번호 입력 팝업</strong>이 자동으로 표시됩니다.
                            </div>
                        </div>

                        <div className="info-box warning">
                            <span className="icon">⚠️</span>
                            <div>
                                배달앱 매출은 <strong>매출 요약</strong>의 '배달앱매출' 항목과
                                <strong> 배달앱 탭</strong>의 '배달별 정산 분석'에 반영됩니다.
                                카드매출이나 현금매출에는 포함되지 않습니다.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ═══ 2. 중복 방지 시스템 ═══ */}
            <div className="manual-section" id="dedup">
                <h2 onClick={() => toggle('dedup')} style={{ cursor: 'pointer' }}>
                    {openSections.dedup ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <ArrowRightLeft size={20} /> 카드매출 중복 방지 시스템
                </h2>
                {openSections.dedup && (
                    <>
                        <p>
                            「일자별 매출내역」과 「신용카드 매출내역」은 <strong>카드매출 데이터가 중복</strong>됩니다.
                            시스템은 <strong>업로드 순서에 관계없이</strong> 자동으로 중복을 방지합니다.
                        </p>

                        <h3>시나리오 A: 카드상세 → 일자별 순서</h3>
                        <div className="flow-diagram">
                            <div className="flow-step">💳 신용카드 매출내역 업로드</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">카드사별 상세 저장 ✅</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">📊 일자별 매출내역 업로드</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">현금매출만 저장 ✅</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: '1px solid #ef4444' }}>카드매출 자동 제외 🚫</div>
                        </div>

                        <h3>시나리오 B: 일자별 → 카드상세 순서</h3>
                        <div className="flow-diagram">
                            <div className="flow-step">📊 일자별 매출내역 업로드</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">현금 + 카드(통합) 저장</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">💳 신용카드 매출내역 업로드</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: '1px solid #ef4444' }}>카드(통합) 삭제 🗑️</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">카드사별 상세로 대체 ✅</div>
                        </div>

                        <div className="info-box tip">
                            <span className="icon">💡</span>
                            <div>
                                <strong>결과:</strong> 어떤 순서로 업로드하든 최종적으로
                                <strong>「현금매출 + 카드사별 상세매출」</strong>이 정확하게 저장됩니다.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ═══ 3. 권장 업로드 절차 ═══ */}
            <div className="manual-section" id="upload-steps">
                <h2 onClick={() => toggle('steps')} style={{ cursor: 'pointer' }}>
                    {openSections.steps ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <CheckCircle size={20} /> 권장 업로드 절차
                </h2>
                {openSections.steps && (
                    <>
                        <div className="info-box tip">
                            <span className="icon">✅</span>
                            <div>
                                가장 정확한 매출 데이터를 위해 다음 순서를 권장합니다.
                            </div>
                        </div>

                        <ol className="step-list">
                            <li>
                                <strong>신용카드 매출내역</strong> 파일을 먼저 업로드합니다.<br />
                                → 카드사별 승인금액(부가세 포함)이 정확하게 저장됩니다.
                            </li>
                            <li>
                                <strong>일자별 매출내역</strong> 파일을 업로드합니다.<br />
                                → 현금매출만 자동 추출되고, 카드매출은 중복 방지로 스킵됩니다.
                            </li>
                            <li>
                                업로드 완료 후 <strong>매출 요약</strong>에서 금액을 확인합니다.<br />
                                → 카드매출 = 신용카드 매출내역의 합계와 일치해야 합니다.
                            </li>
                            <li>
                                금액이 맞지 않는 경우, <strong>업로드 내역</strong>에서 해당 건을 취소(롤백)하고 다시 업로드합니다.
                            </li>
                        </ol>

                        <h3 id="rollback">🔄 업로드 취소 (롤백)</h3>
                        <p>
                            잘못된 데이터가 입력된 경우, 업로드 단위로 데이터를 되돌릴 수 있습니다:
                        </p>
                        <ol className="step-list">
                            <li>매출 관리 또는 매입 관리 페이지에서 <strong>취소/기록</strong> 탭을 클릭합니다.</li>
                            <li>취소하려는 업로드 건의 <strong>「↩」</strong> 버튼을 클릭합니다.</li>
                            <li>해당 업로드로 저장된 모든 데이터가 삭제됩니다.</li>
                            <li><strong>매출 및 매입 손익계산서가 자동으로 재계산</strong>됩니다.</li>
                        </ol>

                        <div className="info-box tip">
                            <span className="icon">💡</span>
                            <div>
                                <strong>데이터 일관성:</strong> 롤백 시 매출 P/L과 비용 P/L이 모두 자동으로 재계산되므로,
                                손익계산서에 남아있는 잔여 데이터 걱정이 없습니다.
                            </div>
                        </div>

                        <div className="info-box warning">
                            <span className="icon">⚠️</span>
                            <div>
                                롤백 시 해당 업로드로 자동 생성된 거래처(Vendor)도 참조 데이터가 없으면 함께 삭제됩니다.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ═══ 4. 매입 관리 스마트 업로드 ═══ */}
            <div className="manual-section" id="purchase-smart">
                <h2 onClick={() => toggle('purchase')} style={{ cursor: 'pointer' }}>
                    {openSections.purchase ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <ShoppingBag size={20} /> 매입 관리 스마트 업로드
                </h2>
                {openSections.purchase && (
                    <>
                        <p>
                            은행 거래내역이나 카드 명세서를 업로드하면 시스템이 자동으로
                            <strong> 불필요한 내역을 제외</strong>하고, <strong>유사 거래처를 매칭</strong>하여
                            정확한 매입 데이터를 관리할 수 있습니다.
                        </p>

                        <h3><Filter size={16} /> 자동 제외 기능</h3>
                        <p>은행 거래내역 업로드 시 다음 항목이 <strong>자동으로 제외</strong>됩니다:</p>
                        <table className="manual-table">
                            <thead>
                                <tr><th>제외 항목</th><th>기준</th><th>이유</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><span className="badge red">카드대금 결제</span></td>
                                    <td>삼성카드, 현대카드, 롯데카드 등</td>
                                    <td>카드 명세서에서 별도 업로드</td>
                                </tr>
                                <tr>
                                    <td><span className="badge amber">직원 급여</span></td>
                                    <td>직원관리 DB에 등록된 이름</td>
                                    <td>인건비 모듈에서 별도 관리</td>
                                </tr>
                            </tbody>
                        </table>

                        <h3>🔍 유사 거래처 매칭</h3>
                        <p>
                            업로드된 거래처명이 기존 등록된 거래처와 <strong>3글자 이상 겹칠 때</strong> 확인 모달이 표시됩니다.
                        </p>
                        <div className="flow-diagram">
                            <div className="flow-step">📂 파일 업로드</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">🤖 자동 분석</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">🔍 거래처 확인 모달</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-step">✅ 확인 후 저장</div>
                        </div>

                        <p>모달에서 각 거래처에 대해 다음 중 하나를 선택합니다:</p>
                        <table className="manual-table">
                            <thead>
                                <tr><th>선택</th><th>설명</th><th>예시</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><span className="badge blue">동일 거래처 병합</span></td>
                                    <td>기존 거래처로 매핑하여 저장</td>
                                    <td>"다인푸드시스템" → "다인푸드"</td>
                                </tr>
                                <tr>
                                    <td><span className="badge green">신규 거래처 등록</span></td>
                                    <td>카테고리 선택 후 신규 등록</td>
                                    <td>"새마을마트" → 원재료비</td>
                                </tr>
                            </tbody>
                        </table>

                        <h3>📋 지원 은행/카드</h3>
                        <table className="manual-table">
                            <thead>
                                <tr><th>금융기관</th><th>파일 형식</th><th>자동 제외</th></tr>
                            </thead>
                            <tbody>
                                <tr><td><strong>신한은행</strong></td><td>.xls</td><td>카드대금 + 직원급여 + 외국인직원</td></tr>
                                <tr><td><strong>국민은행</strong></td><td>.xls/.xlsx</td><td>카드대금 + 직원급여</td></tr>
                                <tr><td><strong>수협은행</strong></td><td>.xls/.xlsx</td><td>카드대금 + 직원급여</td></tr>
                                <tr><td><strong>롯데카드</strong></td><td>.xls (HTML)</td><td>—</td></tr>
                                <tr><td><strong>삼성카드</strong></td><td>.xlsx</td><td>—</td></tr>
                                <tr><td><strong>신한카드</strong></td><td>.xls</td><td>—</td></tr>
                                <tr><td><strong>현대카드</strong></td><td>.xls (HTML)</td><td>—</td></tr>
                            </tbody>
                        </table>

                        <div className="info-box tip">
                            <span className="icon">💡</span>
                            <div>
                                <strong>AI 자동 분류:</strong> 거래처명을 기반으로 카테고리(원재료비, 소모품비, 수도광열비 등)가
                                자동 분류됩니다. 사용자가 카테고리를 수정하면 AI가 학습하여 다음 업로드부터 반영합니다.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ═══ 5. 오픈 체크리스트 ═══ */}
            <div className="manual-section" id="open-checklist">
                <h2 onClick={() => toggle('checklist')} style={{ cursor: 'pointer' }}>
                    {openSections.checklist ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <ClipboardList size={20} /> 오픈 체크리스트
                </h2>
                {openSections.checklist && (
                    <>
                        <p>
                            매장 오픈 준비 절차를 단계별로 확인할 수 있는 체크리스트입니다.
                            <strong> 직원용 앱</strong>과 <strong>관리페이지</strong> 양쪽에서 사용할 수 있습니다.
                        </p>

                        <h3>📱 접근 방법</h3>
                        <table className="manual-table">
                            <thead>
                                <tr><th>위치</th><th>접근 경로</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>직원용 앱</strong></td>
                                    <td>홈 화면 → 📋 오픈 체크리스트 버튼 (에메랄드 그라데이션)</td>
                                </tr>
                                <tr>
                                    <td><strong>관리자 페이지</strong></td>
                                    <td>좌측 사이드바 → 오픈 체크리스트 메뉴</td>
                                </tr>
                            </tbody>
                        </table>

                        <h3>✅ 주요 기능</h3>
                        <ul style={{ lineHeight: 2, paddingLeft: 20 }}>
                            <li><strong>10단계 체크리스트</strong> — 집기 세팅부터 어묵 담기까지</li>
                            <li><strong>인터랙티브 체크박스</strong> — 완료한 항목 체크 가능</li>
                            <li><strong>진행률 표시</strong> — 상단 프로그레스 바로 진행 상황 한눈에</li>
                            <li><strong>섹션 접기/펼치기</strong> — 필요한 섹션만 확인 가능</li>
                            <li><strong>재고 체크 다운로드</strong> — 오픈 재고 체크 이미지 다운로드</li>
                        </ul>

                        <div className="info-box tip">
                            <span className="icon">💡</span>
                            <div>
                                <strong>매일 초기화:</strong> 체크리스트는 페이지 접속 시마다 초기화됩니다.
                                매일 새로 체크하면서 오픈 준비를 진행하세요.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ═══ 6. FAQ ═══ */}
            <div className="manual-section" id="faq">
                <h2 onClick={() => toggle('faq')} style={{ cursor: 'pointer' }}>
                    {openSections.faq ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <Info size={20} /> 자주 묻는 질문 (FAQ)
                </h2>
                {openSections.faq && (
                    <div>
                        <h3>Q. 카드매출 금액이 실제와 다릅니다.</h3>
                        <p>
                            「일자별 매출내역」의 카드매출은 <strong>공급가(부가세 제외)</strong> 기준인 경우가 많습니다.
                            정확한 카드매출을 원하시면 <strong>「신용카드 매출내역」</strong> 파일을 사용하세요.
                            이 파일의 승인금액은 부가세가 포함된 실제 결제금액입니다.
                        </p>

                        <h3>Q. 같은 파일을 두 번 업로드하면 어떻게 되나요?</h3>
                        <p>
                            같은 날짜 + 같은 거래처의 데이터는 <strong>자동으로 중복 스킵</strong>됩니다.
                            중복된 건수는 업로드 결과에 표시됩니다.
                        </p>

                        <h3>Q. 다른 POS 시스템의 파일도 업로드할 수 있나요?</h3>
                        <p>
                            네, 시스템은 <strong>POS 벤더에 관계없이</strong> 자동 감지합니다.
                            헤더 행에 날짜(일자/날짜) 및 금액(금액/매출/승인금액) 관련 컬럼명이 있으면
                            자동으로 파싱됩니다. 지원되지 않는 양식이면 에러 메시지에 감지된 컬럼 목록이 표시됩니다.
                        </p>

                        <h3>Q. '취소' 거래도 반영되나요?</h3>
                        <p>
                            네, 카드 매출내역에서 '구분' 또는 '승인구분' 컬럼에 <strong>'취소'</strong>가 포함된
                            거래는 자동으로 차감 처리됩니다.
                        </p>

                        <h3>Q. 배달앱 매출(배민, 쿠팡, 요기요)은 어떻게 입력하나요?</h3>
                        <p>
                            각 배달앱의 정산 파일(.xlsx)을 매출 관리 페이지에서 업로드하면 됩니다.
                            시스템이 <strong>자동으로 배달앱 형식을 감지</strong>하여 '배달앱매출'로 분류합니다.
                            배달의민족 파일은 비밀번호가 있어도 <strong>자동 비밀번호 팝업</strong>이 표시됩니다.
                        </p>

                        <h3>Q. 비밀번호가 걸린 엑셀 파일은 어떻게 업로드하나요?</h3>
                        <p>
                            시스템이 비밀번호 보호 파일을 자동으로 감지합니다. 공통 비밀번호(630730 등)로 먼저 시도하고,
                            실패 시 <strong>비밀번호 입력 팝업</strong>이 나타납니다. 올바른 비밀번호를 입력하면 정상 처리됩니다.
                        </p>

                        <h3>Q. 배달앱 매출은 어디서 확인하나요?</h3>
                        <p>
                            매출 관리 페이지 상단의 <strong>배달앱매출</strong> 카드에서 합계를 확인할 수 있고,
                            <strong>배달앱 탭</strong>에서 채널별(배민, 쿠팡 등) 정산 분석도 볼 수 있습니다.
                        </p>

                        <h3>Q. 은행 내역 업로드 시 직원 급여가 자동으로 빠지나요?</h3>
                        <p>
                            네, <strong>직원관리에 등록된 이름</strong>과 일치하는 이체 내역은
                            자동으로 제외됩니다. 카드대금 결제(삼성카드, 현대카드 등)도 자동 제외됩니다.
                        </p>

                        <h3>Q. 거래처 확인 모달은 언제 나타나나요?</h3>
                        <p>
                            업로드한 파일에 <strong>기존에 등록되지 않은 거래처</strong>가 있고,
                            기존 거래처와 <strong>3글자 이상 겹치는</strong> 이름이면 유사 거래처 확인 모달이 나타납니다.
                            완전히 새로운 이름이면 신규 거래처로 카테고리만 선택하면 됩니다.
                        </p>

                        <h3>Q. 직원앱에서 오픈 체크리스트를 어떻게 사용하나요?</h3>
                        <p>
                            직원 앱 홈 화면에서 <strong>📋 오픈 체크리스트</strong> 버튼을 터치하면
                            10단계 오픈 절차를 순서대로 확인할 수 있습니다.
                            각 항목을 체크하면 진행률이 표시되고, 하단에서 재고 체크 이미지를 다운로드할 수 있습니다.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
