# -*- coding: utf-8 -*-
"""
Certificate / Document Generation API (증명서 발급)
Generates Korean HR certificate documents as HTML strings for frontend rendering/printing.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from sqlmodel import Session, select
from datetime import date, datetime
from typing import Optional

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


# ──────────────────────────────────────────────
# Seal rendering (mirrors CompanySeal.jsx)
# ──────────────────────────────────────────────

def _parse_business_settings(business) -> dict:
    """Safely parse Business.settings_json."""
    import json
    if not business:
        return {}
    raw = getattr(business, "settings_json", None)
    if not raw:
        return {}
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else {}
    except Exception:
        return {}


def _svg_escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _render_seal_svg(seal_style: str, seal_text: str) -> str:
    """Render an inline SVG seal matching the frontend CompanySeal component.

    Supports the same seal-01..seal-11 style keys. Defaults to seal-11 (English Traditional).
    The returned SVG is sized to 100% of its container — the caller controls the box size.
    """
    style = (seal_style or "seal-11").lower()
    text = seal_text or ""

    FONT_TRAD = "'Nanum Myeongjo','Noto Serif KR',serif"
    FONT_ENG = "Georgia,'Times New Roman',serif"

    def _wrap(t: str, per: int) -> list:
        t = (t or "").strip()
        if not t:
            return [""]
        if len(t) <= per:
            return [t]
        return [t[i : i + per] for i in range(0, len(t), per)]

    if style == "seal-11":
        words = [w for w in (text or "").strip().upper().split() if w]
        line1 = words[0] if words else ""
        line2 = " ".join(words[1:]) if len(words) > 1 else ""
        longest = max(len(line1), len(line2), 3)
        fs = max(20, min(40, 180 // longest))
        e1 = _svg_escape(line1)
        e2 = _svg_escape(line2)
        if line2:
            text_block = (
                f'<text x="100" y="92" font-size="{fs}">{e1}</text>'
                f'<text x="100" y="134" font-size="{fs}">{e2}</text>'
            )
        else:
            text_block = f'<text x="100" y="115" font-size="{fs + 4}">{e1}</text>'
        return f"""
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <filter id="sealRough11" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5"/>
      <feDisplacementMap in="SourceGraphic" scale="2.2"/>
    </filter>
  </defs>
  <g filter="url(#sealRough11)">
    <circle cx="100" cy="100" r="90" fill="#b71c1c"/>
    <circle cx="100" cy="100" r="90" fill="none" stroke="#7f0f10" stroke-width="3"/>
    <circle cx="100" cy="100" r="74" fill="none" stroke="#ffe9e0" stroke-width="1.5"/>
    <g font-family="{FONT_ENG}" font-weight="900" fill="#fff3ec" text-anchor="middle" letter-spacing="3">
      {text_block}
    </g>
  </g>
</svg>
""".strip()

    # Default Korean round seal (seal-01 fallback for any other key)
    lines = _wrap(text, 2)
    fs = 42 if len(lines) > 1 else 54
    text_tags = ""
    for i, l in enumerate(lines):
        y = 118 if len(lines) == 1 else 90 + i * 50
        text_tags += f'<text x="100" y="{y}" font-size="{fs}">{_svg_escape(l)}</text>'
    return f"""
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <circle cx="100" cy="100" r="88" fill="#c1272d"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="#8b1a1f" stroke-width="3"/>
  <g font-family="{FONT_TRAD}" font-weight="900" fill="#fff8f0" text-anchor="middle">
    {text_tags}
  </g>
</svg>
""".strip()


def _fetch_image_as_data_uri(url: str) -> Optional[str]:
    """이미지 URL(상대/절대)을 다운받아 data:image/...;base64 URI로 변환.

    WeasyPrint는 컨테이너 내부에서 상대 URL이나 외부 호스트를 resolve하지
    못하는 경우가 있어 증명서 PDF 생성 시 직인 이미지가 로드되지 않고
    `alt` 텍스트만 남는 문제가 발생. data URI로 inline 하면 네트워크
    의존성 없이 확실히 embed됨.
    """
    import base64
    import os
    try:
        import requests
    except Exception:
        return None

    if not url:
        return None

    # Build absolute URL candidates
    candidates: list[str] = []
    if url.startswith("http://") or url.startswith("https://"):
        candidates.append(url)
    else:
        path = url if url.startswith("/") else "/" + url
        frontend = (os.getenv("FRONTEND_URL") or "").rstrip("/")
        if frontend:
            candidates.append(f"{frontend}{path}")
        candidates.append(f"http://localhost:3788{path}")

    for cand in candidates:
        try:
            resp = requests.get(cand, timeout=5, verify=True)
            if resp.ok and resp.content:
                content_type = (resp.headers.get("content-type") or "image/png").split(";")[0].strip()
                b64 = base64.b64encode(resp.content).decode("ascii")
                return f"data:{content_type};base64,{b64}"
        except Exception:
            continue
    return None


def _seal_block(business) -> str:
    """Return the HTML snippet that replaces the placeholder seal span.

    Priority:
    1. seal_image_url (uploaded image file) — 다운받아 data URI로 embed
    2. seal_style SVG rendered inline (default fallback)
    """
    settings = _parse_business_settings(business)
    seal_image_url = (settings.get("seal_image_url") or "").strip()
    if seal_image_url:
        data_uri = _fetch_image_as_data_uri(seal_image_url)
        if data_uri:
            return (
                f'<span class="cert-seal-img">'
                f'<img src="{data_uri}" alt="직인" />'
                f'</span>'
            )
        # 이미지 로드 실패 시 SVG fallback (alt 텍스트 "직인" 대신)
    seal_style = settings.get("seal_style", "seal-11")
    seal_text = settings.get("seal_text") or (business.name if business else "") or ""
    svg = _render_seal_svg(seal_style, seal_text)
    return f'<span class="cert-seal-img">{svg}</span>'


def _base_css() -> str:
    """Shared print-friendly CSS for all certificates."""
    return """
        @page {
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Malgun Gothic', '맑은 고딕', 'Nanum Gothic', sans-serif;
            font-size: 14px;
            line-height: 1.8;
            color: #000;
            background: #fff;
        }
        .certificate-wrap {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 20mm 15mm;
            background: #fff;
            position: relative;
        }
        .cert-title {
            text-align: center;
            font-size: 26px;
            font-weight: bold;
            letter-spacing: 10px;
            margin-bottom: 28px;
            padding-bottom: 12px;
            border-bottom: 3px double #333;
        }
        .cert-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .cert-table th,
        .cert-table td {
            border: 1px solid #333;
            padding: 7px 12px;
            text-align: left;
            vertical-align: middle;
            font-size: 13.5px;
        }
        .cert-table th {
            background-color: #f5f5f5;
            font-weight: bold;
            width: 140px;
            text-align: center;
        }
        .cert-purpose {
            text-align: center;
            font-size: 15px;
            margin: 22px 0 12px;
            line-height: 1.7;
        }
        .cert-statement {
            text-align: center;
            font-size: 15px;
            margin: 20px 0;
            line-height: 1.7;
        }
        .cert-date {
            text-align: center;
            font-size: 15px;
            margin: 22px 0 16px;
        }
        .cert-issuer {
            text-align: center;
            margin-top: 18px;
            font-size: 15px;
            line-height: 1.8;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .cert-issuer p {
            margin: 4px 0;
        }
        .cert-purpose, .cert-statement, .cert-date {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .cert-seal-img {
            display: inline-block;
            width: 72px;
            height: 72px;
            margin-left: 12px;
            vertical-align: middle;
            transform: rotate(-6deg);
        }
        .cert-seal-img img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .cert-seal-img svg {
            width: 100%;
            height: 100%;
            display: block;
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
            .certificate-wrap { padding: 0; }
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

    biz_name = business.name if business else "-"
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"
    seal_html = _seal_block(business)

    body = f"""
    <h1 class="cert-title">재 직 증 명 서</h1>

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
                <th colspan="4" style="text-align:center; background-color:#e8e8e8; font-size:15px;">재 직 사 항</th>
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
                <th>재직상태</th>
                <td>{staff.status}</td>
            </tr>
            <tr>
                <th>재직기간</th>
                <td colspan="3">{period_str}</td>
            </tr>
            <tr>
                <th>담당업무</th>
                <td colspan="3">{staff.job_description or "-"}</td>
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
            {seal_html}
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

    biz_name = business.name if business else "-"
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"
    seal_html = _seal_block(business)

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
            {seal_html}
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

    biz_name = business.name if business else "-"
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"
    seal_html = _seal_block(business)

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
            {seal_html}
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

    biz_name = business.name if business else "-"
    biz_number = business.business_number or "-" if business else "-"
    biz_owner = business.owner_name or "-" if business else "-"
    biz_address = business.address or "-" if business else "-"
    biz_phone = business.phone or "-" if business else "-"
    seal_html = _seal_block(business)

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
            {seal_html}
        </p>
    </div>
    """

    html = _build_html("퇴직증명서", body)
    return {"status": "success", "html": html, "title": "퇴직증명서"}


# ──────────────────────────────────────────────
# 5. PDF 직접 반환 (서버사이드 WeasyPrint 렌더링)
# ──────────────────────────────────────────────

_CERT_GENERATORS = {
    "employment": generate_employment_certificate,
    "career": generate_career_certificate,
    "salary": generate_salary_certificate,
    "retirement": generate_retirement_certificate,
}


@router.get("/pdf/{cert_type}/{staff_id}")
def generate_certificate_pdf(
    cert_type: str,
    staff_id: int,
    purpose: str = Query(default="제출용", description="증명서 용도"),
    admin: AuthUser = Depends(get_admin_user),
    bid: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """증명서 HTML을 WeasyPrint로 PDF 변환해 바로 스트림 반환.

    프론트에서 html2pdf.js로 빈 페이지가 생성되던 문제 해결. 이 엔드포인트는
    응답 body가 PDF 바이트이므로 axios로 받을 때 `responseType: 'blob'` 필수.
    """
    if cert_type not in _CERT_GENERATORS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 증명서 종류: {cert_type}")

    # Reuse the existing HTML endpoint function (call as plain python)
    result = _CERT_GENERATORS[cert_type](
        staff_id=staff_id,
        purpose=purpose,
        _admin=admin,
        bid=bid,
        session=session,
    )
    html = result.get("html", "")
    title = result.get("title", "증명서")

    try:
        from weasyprint import HTML as WHTML  # type: ignore
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"서버에 WeasyPrint 설치가 필요합니다: {e}",
        )

    try:
        pdf_bytes = WHTML(string=html).write_pdf()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 생성 실패: {e}")

    import urllib.parse
    filename_enc = urllib.parse.quote(f"{title}.pdf")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{filename_enc}",
            "Cache-Control": "no-store",
        },
    )
