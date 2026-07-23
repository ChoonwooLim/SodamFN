"""영수증 이미지 → 구조화 추출 (Ollama 멀티모달 비전).

- twinverse-ai @ OLLAMA_URL 의 멀티모달 모델(gemma3:12b 등)에 이미지를 보내
  거래처명/날짜/금액/결제수단/카테고리를 JSON 으로 추출한다.
- 모델 목록은 OLLAMA_RECEIPT_MODELS (콤마 구분, 앞에서부터 시도).
- 실패 시 None 반환 — 호출부는 영수증을 '확인 필요(pending)' 상태로 보관하고
  사용자가 수동 입력으로 보완한다 (추출 실패가 업로드를 막으면 안 됨).
"""
import os
import json
import base64
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# 손익 비용 카테고리 (frontend utils/constants.js EXPENSE_CATEGORIES 와 동일 id)
RECEIPT_CATEGORIES = [
    "원재료비", "소모품비", "수도광열비", "임차료", "수선비",
    "감가상각비", "세금과공과", "보험료", "인건비", "기타경비",
]

RECEIPT_PROMPT = (
    "이 사진은 한국 매장/마트/식자재 구매 영수증입니다. 정보를 추출해 JSON 하나로만 답하세요.\n"
    "형식:\n"
    '{"vendor_name": "상호명(지점명 제외한 핵심 상호)", "receipt_date": "YYYY-MM-DD", '
    '"total_amount": 최종결제금액(정수, 원), "payment_method": "Card" 또는 "Cash", '
    f'"category": {json.dumps(RECEIPT_CATEGORIES, ensure_ascii=False)} 중 하나, '
    '"items": [{"name": "품목명", "amount": 금액(정수)}]}\n'
    "규칙: 읽을 수 없는 값은 null. total_amount 는 할인 반영된 최종 결제금액. "
    "식재료·야채·정육·수산물이면 원재료비, 포장재·일회용품·세제·잡화면 소모품비, "
    "장비 수리면 수선비, 판단 어려우면 기타경비."
)


def extract_receipt(image_bytes: bytes) -> Optional[dict]:
    """영수증 이미지에서 구조화 데이터 추출. 실패 시 None (업로드는 계속 진행)."""
    base_url = os.getenv("OLLAMA_URL", "").rstrip("/")
    if not base_url:
        logger.warning("OLLAMA_URL not set — receipt extraction skipped")
        return None

    # 2026-07-23 실측: gemma4:e4b 가 합계금액·상호·품목 전부 정확 (35s),
    # qwen2.5vl:7b 는 빠르고(10s) 분류까지 하지만 합계 오독 → 폴백으로만 사용.
    # gemma3:12b/llava:7b 는 환각·오독으로 부적합, gemma4:26b 는 콜드로드 타임아웃.
    models = [
        m.strip() for m in
        os.getenv("OLLAMA_RECEIPT_MODELS", "gemma4:e4b,qwen2.5vl:7b").split(",")
        if m.strip()
    ]
    timeout = float(os.getenv("OLLAMA_RECEIPT_TIMEOUT_SEC", "90"))
    b64 = base64.b64encode(image_bytes).decode()

    for model in models:
        try:
            resp = httpx.post(
                f"{base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": RECEIPT_PROMPT,
                    "images": [b64],
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0},
                },
                timeout=timeout,
            )
            resp.raise_for_status()
            text = resp.json().get("response", "")
            data = json.loads(text)
            if isinstance(data, dict) and (data.get("vendor_name") or data.get("total_amount")):
                data["_model"] = model
                return data
            logger.warning(f"receipt extract: empty result from {model}")
        except Exception as e:
            logger.warning(f"receipt extract failed (model={model}): {e}")
    return None


def normalize_extraction(data: Optional[dict]) -> dict:
    """추출 결과를 안전한 필드로 정규화. 실패/누락은 기본값."""
    import datetime as dt

    out = {
        "vendor_name": None, "receipt_date": None, "amount": 0,
        "payment_method": "Card", "category": None, "items": [],
    }
    if not data:
        return out

    name = data.get("vendor_name")
    if isinstance(name, str) and name.strip():
        out["vendor_name"] = name.strip()[:100]

    raw_date = data.get("receipt_date")
    if isinstance(raw_date, str):
        for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d"):
            try:
                out["receipt_date"] = dt.datetime.strptime(raw_date.strip()[:10], fmt).date()
                break
            except ValueError:
                continue

    amt = data.get("total_amount")
    try:
        amt = int(float(str(amt).replace(",", "").replace("원", "")))
        if 0 < amt < 100_000_000:
            out["amount"] = amt
    except (TypeError, ValueError):
        pass

    pm = str(data.get("payment_method") or "").strip().lower()
    out["payment_method"] = "Cash" if pm in ("cash", "현금") else "Card"

    cat = data.get("category")
    if isinstance(cat, str) and cat.strip() in RECEIPT_CATEGORIES:
        out["category"] = cat.strip()

    items = data.get("items")
    if isinstance(items, list):
        out["items"] = [
            {"name": str(i.get("name", ""))[:80], "amount": i.get("amount")}
            for i in items if isinstance(i, dict) and i.get("name")
        ][:50]

    return out
