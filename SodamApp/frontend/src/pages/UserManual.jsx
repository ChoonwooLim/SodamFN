import { useState } from 'react';
import { BookOpen, Upload, CreditCard, ArrowRightLeft, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import './UserManual.css';

export default function UserManual() {
    const [openSections, setOpenSections] = useState({ revenue: true, dedup: true, steps: true, faq: true });

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
                    <li><a href="#dedup">중복 방지 시스템</a></li>
                    <li><a href="#upload-steps">업로드 절차 (권장)</a></li>
                    <li><a href="#rollback">업로드 취소 (롤백)</a></li>
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
                            <li>매출 관리 또는 매입 관리 페이지에서 <strong>업로드 내역</strong> 탭을 클릭합니다.</li>
                            <li>취소하려는 업로드 건의 <strong>「취소」</strong> 버튼을 클릭합니다.</li>
                            <li>해당 업로드로 저장된 모든 데이터가 삭제되고, 손익계산서가 자동 재계산됩니다.</li>
                        </ol>

                        <div className="info-box warning">
                            <span className="icon">⚠️</span>
                            <div>
                                롤백 시 해당 업로드로 자동 생성된 거래처(Vendor)도 참조 데이터가 없으면 함께 삭제됩니다.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ═══ 4. FAQ ═══ */}
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
                            현재 배달앱 정산내역은 별도 카테고리로 관리됩니다.
                            매장 카드매출과는 별개이므로 중복 걱정 없이 업로드하시면 됩니다.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
