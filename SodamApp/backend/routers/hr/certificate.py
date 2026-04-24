# -*- coding: utf-8 -*-
"""
Certificate / Document Generation API (증명서 발급)
Generates Korean HR certificate documents as HTML strings for frontend rendering/printing.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select
from datetime import date, datetime
from typing import Optional
from html import escape
import json

from routers.auth import get_admin_user
from models import User as AuthUser, Staff, Business, Payroll
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter(prefix="/certificate", tags=["certificate"])


# ──────────────────────────────────────────────
# Shared helpers
# ──────────────────────────────────────────────

def _fmt_date(d: Optional[date]) -> str:
    """Format date as Korean style YYYY년 MM월 DD일"""
    if not d:
        return ""
    return f"{d.year}년 {d.month:02d}월 {d.day:02d}일"


def _fmt_number(n: int) -> str:
    """Format number with comma separator"""
    return f"{n:,}"


def _mask_resident(rn: Optional[str]) -> str:
    """Mask resident number for display (앞 6 + - + 뒤 첫자리 + ******)"""
    if not rn:
        return "-"
    clean = rn.replace("-", "")
    if len(clean) >= 7:
        return f"{clean[:6]}-{clean[6]}******"
    return rn


def _h(value: Optional[object], default: str = "-") -> str:
    """Escape user/business data before embedding it in certificate HTML."""
    if value is None or value == "":
        return default
    return escape(str(value), quote=True)


def _business_settings(business: Optional[Business]) -> dict:
    """Parse Business.settings_json safely for document display settings."""
    if not business or not business.settings_json:
        return {}
    try:
        parsed = json.loads(business.settings_json)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _business_display_name(business: Optional[Business]) -> str:
    """Prefer configured Korean seal/display text for formal documents."""
    if not business:
        return "-"
    settings = _business_settings(business)
    return settings.get("seal_text") or business.name or "-"


def _get_staff_and_business(
    staff_id: int,
    bid: Optional[int],
    session: Session,
) -> tuple:
    """Fetch staff and associated business, applying tenant filter."""
    stmt = apply_bid_filter(select(Staff).where(Staff.id == staff_id), Staff, bid)
    staff = session.exec(stmt).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    business = None
    if staff.business_id:
        business = session.get(Business, staff.business_id)

    return staff, business


def _base_css() -> str:
    """Shared print-friendly CSS for all certificates."""
    return """
        @page {
            size: A4;
            margin: 12mm 13mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', sans-serif;
            font-size: 15px;
            line-height: 1.55;
            color: #000;
            background: #fff;
        }
        .certificate-wrap {
            width: 184mm;
            min-height: 273mm;
            margin: 0 auto;
            padding: 6mm 0 0;
            background: #fff;
            position: relative;
        }
        .cert-title {
            text-align: center;
            font-size: 31px;
            font-weight: 900;
            letter-spacing: 12px;
            text-indent: 12px;
            margin: 22mm 0 13mm;
            padding-bottom: 9mm;
            border-bottom: 4px double #111;
        }
        .cert-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-bottom: 13mm;
            border-top: 2px solid #111;
            border-bottom: 2px solid #111;
        }
        .cert-table th,
        .cert-table td {
            border: 1.5px solid #111;
            padding: 8px 13px;
            text-align: left;
            vertical-align: middle;
            height: 13mm;
            font-size: 15px;
        }
        .cert-table th {
            background-color: #fff;
            font-weight: 900;
            width: 31mm;
            text-align: center;
        }
        .cert-table td {
            font-weight: 600;
        }
        .cert-table .section-title {
            height: 12mm;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 8px;
            text-indent: 8px;
            text-align: center;
            background: #fff !important;
        }
        .cert-table .label-col {
            width: 31mm;
        }
        .cert-table .value-col {
            width: 46mm;
        }
        .cert-table .wide-value-col {
            width: auto;
        }
        .cert-purpose {
            text-align: center;
            font-size: 16px;
            margin: 22mm 0 16mm;
            line-height: 2;
            font-weight: 600;
        }
        .cert-statement {
            text-align: center;
            font-size: 16px;
            margin: 30px 0;
            line-height: 2;
        }
        .cert-date {
            text-align: center;
            font-size: 16px;
            margin: 0 0 19mm;
            font-weight: 700;
        }
        .cert-issuer {
            width: 94mm;
            margin: 0 auto;
            font-size: 16px;
            line-height: 2.05;
            font-weight: 700;
        }
        .cert-issuer p {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            min-height: 8mm;
            white-space: nowrap;
        }
        .issuer-label {
            display: inline-block;
            min-width: 36mm;
            text-align: right;
            letter-spacing: 3px;
            text-indent: 3px;
        }
        .issuer-value {
            display: inline-block;
            margin-left: 4mm;
            white-space: normal;
        }
        .issuer-representative {
            margin-top: 8mm;
        }
        .cert-seal {
            display: inline-block;
            width: 18mm;
            height: 18mm;
            border: 2px solid #a50022;
            border-radius: 50%;
            text-align: center;
            line-height: calc(18mm - 4px);
            color: #a50022;
            font-size: 13px;
            font-weight: 900;
            margin-left: 8mm;
            vertical-align: middle;
        }
        .cert-footer {
            position: absolute;
            bottom: 20mm;
            left: 15mm;
            right: 15mm;
            text-align: center;
            font-size: 11px;
            color: #999;
            border-top: 1px solid #ddd;
            padding-top: 8px;
        }
        @media print {
            body { background: #fff; }
            .certificate-wrap {
                width: auto;
                min-height: auto;
                padding: 0;
            }
            .cert-footer { position: fixed; bottom: 10mm; }
        }
    """


def _build_html(title: str, body: str) -> str:
    """Wrap body content in full HTML document with print CSS."""
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>{_base_css()}</style>
</head>
<body>
<div class="certificate-wrap">
{body}
</div>
</body>
</html>"""


# ──────────────────────────────────────────────
# 1. 재직증명서 (Employment Certificate)
# ──────────────────────────────────────────────

@router.get("/employment/{staff_id}")
def generate_employment_certificate(
    staff_id: int,
    purpose: str = Query(default="제출용", description="증명서 용도"),
    _admin: AuthUser = Depends(get_admin_user),
    bid: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """재직증명서 생성 - 현 재직 상태 및 경력 사항 증명"""
    staff, business = _get_staff_and_business(staff_id, bid, session)
    today = date.today()

    # Employment period
    period_end = "현재" if staff.status == "재직" else _fmt_date(staff.contract_end_date or today)
    period_str = f"{_fmt_date(staff.start_date)} ~ {period_end}"

    biz_name = _business_display_name(business)
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"

    staff_name = _h(staff.name)
    staff_birth = _h(_fmt_date(staff.birth_date) if staff.birth_date else "-")
    staff_resident = _h(_mask_resident(staff.resident_number))
    staff_address = _h(staff.address)
    staff_role = _h(staff.role)
    staff_contract_type = _h(staff.contract_type)
    staff_status = _h(staff.status)
    staff_job = _h(staff.job_description)
    biz_name_html = _h(biz_name)
    biz_number_html = _h(biz_number)
    biz_owner_html = _h(biz_owner)
    biz_address_html = _h(biz_address)
    biz_phone_html = _h(biz_phone)
    period_html = _h(period_str)
    purpose_html = _h(purpose)
    today_html = _h(_fmt_date(today))

    body = f"""
    <h1 class="cert-title">재 직 증 명 서</h1>

    <table class="cert-table">
        <colgroup>
            <col class="label-col">
            <col class="value-col">
            <col class="label-col">
            <col class="wide-value-col">
        </colgroup>
        <tbody>
            <tr>
                <th colspan="4" class="section-title">인 적 사 항</th>
            </tr>
            <tr>
                <th>성 명</th>
                <td>{staff_name}</td>
                <th>생년월일</th>
                <td>{staff_birth}</td>
            </tr>
            <tr>
                <th>주민등록번호</th>
                <td colspan="3">{staff_resident}</td>
            </tr>
            <tr>
                <th>주 소</th>
                <td colspan="3">{staff_address}</td>
            </tr>
        </tbody>
    </table>

    <table class="cert-table">
        <colgroup>
            <col class="label-col">
            <col class="wide-value-col">
            <col class="label-col">
            <col class="value-col">
        </colgroup>
        <tbody>
            <tr>
                <th colspan="4" class="section-title">재 직 사 항</th>
            </tr>
            <tr>
                <th>소 속</th>
                <td>{biz_name_html}</td>
                <th>직 위</th>
                <td>{staff_role}</td>
            </tr>
            <tr>
                <th>고용형태</th>
                <td>{staff_contract_type}</td>
                <th>재직상태</th>
                <td>{staff_status}</td>
            </tr>
            <tr>
                <th>재직기간</th>
                <td colspan="3">{period_html}</td>
            </tr>
            <tr>
                <th>담당업무</th>
                <td colspan="3">{staff_job}</td>
            </tr>
        </tbody>
    </table>

    <div class="cert-purpose">
        <p>위 사실을 증명합니다.</p>
        <p style="margin-top:10px;">용 도 : {purpose_html}</p>
    </div>

    <div class="cert-date">
        <p>{today_html}</p>
    </div>

    <div class="cert-issuer">
        <p><span class="issuer-label">사 업 장 명</span> : <span class="issuer-value">{biz_name_html}</span></p>
        <p><span class="issuer-label">사업자등록번호</span> : <span class="issuer-value">{biz_number_html}</span></p>
        <p><span class="issuer-label">주 소</span> : <span class="issuer-value">{biz_address_html}</span></p>
        <p><span class="issuer-label">전 화 번 호</span> : <span class="issuer-value">{biz_phone_html}</span></p>
        <p class="issuer-representative">
            <span class="issuer-label">대 표 자</span> : <span class="issuer-value">{biz_owner_html}</span>
            <span class="cert-seal">직인</span>
        </p>
    </div>
    """

    html = _build_html("재직증명서", body)
    return {"status": "success", "html": html, "title": "재직증명서"}


# ──────────────────────────────────────────────
# 2. 경력증명서 (Career Certificate)
# ──────────────────────────────────────────────

@router.get("/career/{staff_id}")
def generate_career_certificate(
    staff_id: int,
    purpose: str = Query(default="제출용", description="증명서 용도"),
    _admin: AuthUser = Depends(get_admin_user),
    bid: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """경력증명서 생성 - 근무 경력 증명 (퇴사자 포함)"""
    staff, business = _get_staff_and_business(staff_id, bid, session)
    today = date.today()

    # Career period
    end_date = staff.contract_end_date or today
    if staff.status == "재직":
        end_date = today
    period_str = f"{_fmt_date(staff.start_date)} ~ {_fmt_date(end_date)}"

    # Calculate duration
    delta = (end_date - staff.start_date).days
    years = delta // 365
    months = (delta % 365) // 30
    days = (delta % 365) % 30
    duration_parts = []
    if years > 0:
        duration_parts.append(f"{years}년")
    if months > 0:
        duration_parts.append(f"{months}개월")
    if days > 0:
        duration_parts.append(f"{days}일")
    duration_str = " ".join(duration_parts) if duration_parts else "1일"

    biz_name = _business_display_name(business)
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"

    body = f"""
    <h1 class="cert-title">경 력 증 명 서</h1>

    <table class="cert-table">
        <tbody>
            <tr>
                <th colspan="4" style="text-align:center; background-color:#e8e8e8; font-size:15px;">인 적 사 항</th>
            </tr>
            <tr>
                <th>성 명</th>
                <td>{staff.name}</td>
                <th>생년월일</th>
                <td>{_fmt_date(staff.birth_date) if staff.birth_date else "-"}</td>
            </tr>
            <tr>
                <th>주민등록번호</th>
                <td colspan="3">{_mask_resident(staff.resident_number)}</td>
            </tr>
            <tr>
                <th>주 소</th>
                <td colspan="3">{staff.address or "-"}</td>
            </tr>
        </tbody>
    </table>

    <table class="cert-table">
        <tbody>
            <tr>
                <th colspan="4" style="text-align:center; background-color:#e8e8e8; font-size:15px;">경 력 사 항</th>
            </tr>
            <tr>
                <th>근무처</th>
                <td colspan="3">{biz_name}</td>
            </tr>
            <tr>
                <th>직 위</th>
                <td>{staff.role}</td>
                <th>고용형태</th>
                <td>{staff.contract_type}</td>
            </tr>
            <tr>
                <th>근무기간</th>
                <td>{period_str}</td>
                <th>근속기간</th>
                <td>{duration_str}</td>
            </tr>
            <tr>
                <th>담당업무</th>
                <td colspan="3">{staff.job_description or "-"}</td>
            </tr>
            <tr>
                <th>퇴직사유</th>
                <td colspan="3">{"해당없음 (재직중)" if staff.status == "재직" else "일신상의 사유"}</td>
            </tr>
        </tbody>
    </table>

    <div class="cert-purpose">
        <p>위 사실을 증명합니다.</p>
        <p style="margin-top:10px;">용 도 : {purpose}</p>
    </div>

    <div class="cert-date">
        <p>{_fmt_date(today)}</p>
    </div>

    <div class="cert-issuer">
        <p>사 업 장 명 : {biz_name}</p>
        <p>사업자등록번호 : {biz_number}</p>
        <p>주 소 : {biz_address}</p>
        <p>전 화 번 호 : {biz_phone}</p>
        <p style="margin-top:15px;">
            대 표 자 : {biz_owner}
            <span class="cert-seal">직인</span>
        </p>
    </div>
    """

    html = _build_html("경력증명서", body)
    return {"status": "success", "html": html, "title": "경력증명서"}


# ──────────────────────────────────────────────
# 3. 급여확인서 (Salary Confirmation)
# ──────────────────────────────────────────────

@router.get("/salary/{staff_id}")
def generate_salary_certificate(
    staff_id: int,
    purpose: str = Query(default="제출용", description="증명서 용도"),
    _admin: AuthUser = Depends(get_admin_user),
    bid: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """급여확인서 생성 - 최근 3개월 급여 내역 포함"""
    staff, business = _get_staff_and_business(staff_id, bid, session)
    today = date.today()

    # Fetch recent 3 months of payroll, ordered descending
    payrolls = session.exec(
        select(Payroll)
        .where(Payroll.staff_id == staff_id)
        .order_by(Payroll.month.desc())  # type: ignore
        .limit(3)
    ).all()

    if not payrolls:
        raise HTTPException(status_code=404, detail="급여 내역이 없습니다.")

    # Build payroll rows
    payroll_rows = ""
    total_base = 0
    total_bonus = 0
    total_deductions = 0
    total_net = 0

    for p in reversed(payrolls):  # chronological order
        bonus_sum = (p.bonus or 0) + (p.bonus_special or 0) + (p.bonus_meal or 0) + (p.bonus_holiday or 0)
        total_base += p.base_pay or 0
        total_bonus += bonus_sum
        total_deductions += p.deductions or 0
        total_net += p.total_pay or 0

        payroll_rows += f"""
            <tr>
                <td style="text-align:center;">{p.month}</td>
                <td style="text-align:right;">{_fmt_number(p.base_pay or 0)}원</td>
                <td style="text-align:right;">{_fmt_number(bonus_sum)}원</td>
                <td style="text-align:right;">{_fmt_number(p.deductions or 0)}원</td>
                <td style="text-align:right; font-weight:bold;">{_fmt_number(p.total_pay or 0)}원</td>
            </tr>
        """

    count = len(payrolls)
    avg_net = total_net // count if count > 0 else 0

    biz_name = _business_display_name(business)
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"

    body = f"""
    <h1 class="cert-title">급 여 확 인 서</h1>

    <table class="cert-table">
        <tbody>
            <tr>
                <th colspan="4" style="text-align:center; background-color:#e8e8e8; font-size:15px;">인 적 사 항</th>
            </tr>
            <tr>
                <th>성 명</th>
                <td>{staff.name}</td>
                <th>생년월일</th>
                <td>{_fmt_date(staff.birth_date) if staff.birth_date else "-"}</td>
            </tr>
            <tr>
                <th>소 속</th>
                <td>{biz_name}</td>
                <th>직 위</th>
                <td>{staff.role}</td>
            </tr>
            <tr>
                <th>고용형태</th>
                <td>{staff.contract_type}</td>
                <th>입 사 일</th>
                <td>{_fmt_date(staff.start_date)}</td>
            </tr>
        </tbody>
    </table>

    <table class="cert-table">
        <tbody>
            <tr>
                <th colspan="5" style="text-align:center; background-color:#e8e8e8; font-size:15px;">급 여 내 역 (최근 {count}개월)</th>
            </tr>
            <tr>
                <th style="text-align:center; width:100px;">급여월</th>
                <th style="text-align:center;">기본급</th>
                <th style="text-align:center;">수당합계</th>
                <th style="text-align:center;">공제합계</th>
                <th style="text-align:center;">실수령액</th>
            </tr>
            {payroll_rows}
            <tr style="background-color:#f9f9f9; font-weight:bold;">
                <td style="text-align:center;">합 계</td>
                <td style="text-align:right;">{_fmt_number(total_base)}원</td>
                <td style="text-align:right;">{_fmt_number(total_bonus)}원</td>
                <td style="text-align:right;">{_fmt_number(total_deductions)}원</td>
                <td style="text-align:right;">{_fmt_number(total_net)}원</td>
            </tr>
            <tr style="background-color:#f0f0f0; font-weight:bold;">
                <td style="text-align:center;">월 평균</td>
                <td colspan="3"></td>
                <td style="text-align:right;">{_fmt_number(avg_net)}원</td>
            </tr>
        </tbody>
    </table>

    <div class="cert-purpose">
        <p>위 사실을 증명합니다.</p>
        <p style="margin-top:10px;">용 도 : {purpose}</p>
    </div>

    <div class="cert-date">
        <p>{_fmt_date(today)}</p>
    </div>

    <div class="cert-issuer">
        <p>사 업 장 명 : {biz_name}</p>
        <p>사업자등록번호 : {biz_number}</p>
        <p>주 소 : {biz_address}</p>
        <p>전 화 번 호 : {biz_phone}</p>
        <p style="margin-top:15px;">
            대 표 자 : {biz_owner}
            <span class="cert-seal">직인</span>
        </p>
    </div>
    """

    html = _build_html("급여확인서", body)
    return {"status": "success", "html": html, "title": "급여확인서"}


# ──────────────────────────────────────────────
# 4. 퇴직증명서 (Retirement Certificate)
# ──────────────────────────────────────────────

@router.get("/retirement/{staff_id}")
def generate_retirement_certificate(
    staff_id: int,
    purpose: str = Query(default="제출용", description="증명서 용도"),
    _admin: AuthUser = Depends(get_admin_user),
    bid: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """퇴직증명서 생성 - 퇴사자 전용"""
    staff, business = _get_staff_and_business(staff_id, bid, session)
    today = date.today()

    if staff.status != "퇴사":
        raise HTTPException(status_code=400, detail="퇴직증명서는 퇴사한 직원만 발급 가능합니다.")

    end_date = staff.contract_end_date or today

    # Calculate work duration
    delta = (end_date - staff.start_date).days
    years = delta // 365
    months = (delta % 365) // 30
    days = (delta % 365) % 30
    duration_parts = []
    if years > 0:
        duration_parts.append(f"{years}년")
    if months > 0:
        duration_parts.append(f"{months}개월")
    if days > 0:
        duration_parts.append(f"{days}일")
    duration_str = " ".join(duration_parts) if duration_parts else "1일"

    # Check retirement payment info
    from models import RetirementPayment
    retirement = session.exec(
        select(RetirementPayment)
        .where(RetirementPayment.staff_id == staff_id)
        .order_by(RetirementPayment.created_at.desc())  # type: ignore
    ).first()

    retirement_info = ""
    if retirement:
        retirement_info = f"""
        <table class="cert-table">
            <tbody>
                <tr>
                    <th colspan="4" style="text-align:center; background-color:#e8e8e8; font-size:15px;">퇴 직 금 정 보</th>
                </tr>
                <tr>
                    <th>퇴직금액</th>
                    <td>{_fmt_number(retirement.paid_amount)}원</td>
                    <th>지급상태</th>
                    <td>{retirement.status}</td>
                </tr>
                <tr>
                    <th>지급일</th>
                    <td>{_fmt_date(retirement.payment_date) if retirement.payment_date else "미지급"}</td>
                    <th>지급방법</th>
                    <td>{retirement.payment_method}</td>
                </tr>
            </tbody>
        </table>
        """
    else:
        retirement_info = """
        <table class="cert-table">
            <tbody>
                <tr>
                    <th colspan="2" style="text-align:center; background-color:#e8e8e8; font-size:15px;">퇴 직 금 정 보</th>
                </tr>
                <tr>
                    <th>퇴직금</th>
                    <td>해당사항 없음</td>
                </tr>
            </tbody>
        </table>
        """

    biz_name = _business_display_name(business)
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"

    body = f"""
    <h1 class="cert-title">퇴 직 증 명 서</h1>

    <table class="cert-table">
        <tbody>
            <tr>
                <th colspan="4" style="text-align:center; background-color:#e8e8e8; font-size:15px;">인 적 사 항</th>
            </tr>
            <tr>
                <th>성 명</th>
                <td>{staff.name}</td>
                <th>생년월일</th>
                <td>{_fmt_date(staff.birth_date) if staff.birth_date else "-"}</td>
            </tr>
            <tr>
                <th>주민등록번호</th>
                <td colspan="3">{_mask_resident(staff.resident_number)}</td>
            </tr>
            <tr>
                <th>주 소</th>
                <td colspan="3">{staff.address or "-"}</td>
            </tr>
        </tbody>
    </table>

    <table class="cert-table">
        <tbody>
            <tr>
                <th colspan="4" style="text-align:center; background-color:#e8e8e8; font-size:15px;">근 무 사 항</th>
            </tr>
            <tr>
                <th>소 속</th>
                <td>{biz_name}</td>
                <th>직 위</th>
                <td>{staff.role}</td>
            </tr>
            <tr>
                <th>고용형태</th>
                <td>{staff.contract_type}</td>
                <th>담당업무</th>
                <td>{staff.job_description or "-"}</td>
            </tr>
            <tr>
                <th>입 사 일</th>
                <td>{_fmt_date(staff.start_date)}</td>
                <th>퇴 사 일</th>
                <td>{_fmt_date(end_date)}</td>
            </tr>
            <tr>
                <th>근속기간</th>
                <td colspan="3">{duration_str}</td>
            </tr>
            <tr>
                <th>퇴직사유</th>
                <td colspan="3">일신상의 사유</td>
            </tr>
        </tbody>
    </table>

    {retirement_info}

    <div class="cert-purpose">
        <p>위 사실을 증명합니다.</p>
        <p style="margin-top:10px;">용 도 : {purpose}</p>
    </div>

    <div class="cert-date">
        <p>{_fmt_date(today)}</p>
    </div>

    <div class="cert-issuer">
        <p>사 업 장 명 : {biz_name}</p>
        <p>사업자등록번호 : {biz_number}</p>
        <p>주 소 : {biz_address}</p>
        <p>전 화 번 호 : {biz_phone}</p>
        <p style="margin-top:15px;">
            대 표 자 : {biz_owner}
            <span class="cert-seal">직인</span>
        </p>
    </div>
    """

    html = _build_html("퇴직증명서", body)
    return {"status": "success", "html": html, "title": "퇴직증명서"}
