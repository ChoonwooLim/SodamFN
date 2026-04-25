"""HTML 렌더 + WeasyPrint PDF 변환."""
from __future__ import annotations
import datetime
import logging
import os
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger("sodam.yearend.generator")

TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent / "templates" / "yearend"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _mask_resident_number(rn: Optional[str]) -> str:
    if not rn:
        return "-"
    cleaned = rn.replace("-", "").strip()
    if len(cleaned) < 7:
        return rn
    return f"{cleaned[:6]}-{cleaned[6]}******"


def _resolve_resident_display(staff, mask: bool) -> str:
    rn = getattr(staff, "resident_number", None)
    if mask:
        return _mask_resident_number(rn)
    return rn or "-"


def _work_period(staff, year: int) -> tuple[str, str]:
    from_str = f"{year}.01.01"
    if getattr(staff, "contract_start_date", None):
        d = staff.contract_start_date
        if hasattr(d, "year") and d.year == year:
            from_str = d.strftime("%Y.%m.%d")
    to_str = f"{year}.12.31"
    return from_str, to_str


def render_withholding_html(*, report, staff, business, simplified=None,
                             is_draft: bool = True,
                             mask_resident_number: bool = False) -> str:
    """별지 24호 유사 레이아웃 HTML."""
    template = _env.get_template("withholding_receipt_24.html.j2")
    wp_from, wp_to = _work_period(staff, report.year)
    return template.render(
        report=report,
        staff=staff,
        business=business,
        simplified=simplified,
        is_draft=is_draft,
        resident_number_display=_resolve_resident_display(staff, mask_resident_number),
        work_period_from=wp_from,
        work_period_to=wp_to,
        issued_at=datetime.date.today().strftime("%Y-%m-%d"),
    )


def render_business_income_html(*, report, staff, business,
                                 is_draft: bool = True,
                                 mask_resident_number: bool = False) -> str:
    """별지 23호 유사 레이아웃 (사업소득자용) HTML."""
    template = _env.get_template("business_income_receipt_23.html.j2")
    wp_from, wp_to = _work_period(staff, report.year)
    return template.render(
        report=report,
        staff=staff,
        business=business,
        is_draft=is_draft,
        resident_number_display=_resolve_resident_display(staff, mask_resident_number),
        work_period_from=wp_from,
        work_period_to=wp_to,
        issued_at=datetime.date.today().strftime("%Y-%m-%d"),
    )


def html_to_pdf(html: str) -> bytes:
    """WeasyPrint HTML → PDF bytes. ImportError 대응."""
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as e:
        raise RuntimeError(
            f"WeasyPrint 사용 불가 ({e}). Linux Docker 에서는 libpango/libcairo 필요."
        )
    return HTML(string=html).write_pdf()
