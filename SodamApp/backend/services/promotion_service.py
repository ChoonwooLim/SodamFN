"""
홍보물 AI 제작 서비스 – 프리셋 데이터, 요청 모델, 헬퍼 함수
routers/promotions.py 에서 분리된 순수 데이터/유틸 모듈
"""
import io
import uuid
from typing import Optional

from pydantic import BaseModel

from services.storage_service import get_storage


# ─────────────────────────────────────────────
# 프리셋 데이터 (5개 카테고리 × 12개)
# ─────────────────────────────────────────────

POSTER_PRESETS = [
    {
        "id": "poster_new_menu",
        "name": "신메뉴 출시",
        "desc": "새로운 메뉴 출시를 알리는 프리미엄 포스터",
        "icon": "sparkles",
        "color": "#f59e0b",
        "prompt": "premium food advertisement poster, NEW MENU LAUNCH, elegant korean restaurant, top-down food photography, clean white background, gold accents, modern typography, studio lighting",
        "style": "studio",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_discount",
        "name": "할인 이벤트",
        "desc": "강렬한 할인 프로모션 포스터",
        "icon": "percent",
        "color": "#ef4444",
        "prompt": "bold discount sale poster, korean restaurant promotion, vibrant red and gold colors, appetizing food display, percentage off badge, dynamic energetic layout, professional design",
        "style": "premium",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_seasonal",
        "name": "시즌 한정",
        "desc": "계절감 있는 한정 메뉴 포스터",
        "icon": "leaf",
        "color": "#10b981",
        "prompt": "seasonal limited edition menu poster, korean restaurant, beautiful seasonal flowers and nature elements, elegant food presentation, soft pastel colors, premium quality",
        "style": "natural",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_grand_open",
        "name": "오픈/리뉴얼",
        "desc": "매장 오픈 또는 리뉴얼 기념 포스터",
        "icon": "party",
        "color": "#8b5cf6",
        "prompt": "grand opening celebration poster, korean restaurant, confetti and ribbons, warm welcoming atmosphere, premium food display, festive golden decorations, professional design",
        "style": "premium",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_set_menu",
        "name": "세트 메뉴",
        "desc": "가성비 좋은 세트 구성 홍보",
        "icon": "package",
        "color": "#3b82f6",
        "prompt": "combo meal deal poster, korean restaurant set menu, multiple dishes arranged beautifully, value proposition design, clean modern layout, appetizing overhead shot",
        "style": "overhead",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_takeout",
        "name": "포장 할인",
        "desc": "포장 주문 시 할인 혜택 안내",
        "icon": "shopping-bag",
        "color": "#f97316",
        "prompt": "takeout packaging promotion poster, korean restaurant, beautiful takeout containers with food, eco-friendly packaging, modern clean design, warm inviting colors",
        "style": "natural",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_group",
        "name": "단체 주문",
        "desc": "단체/기업 주문 맞춤 포스터",
        "icon": "users",
        "color": "#6366f1",
        "prompt": "catering and group order poster, korean restaurant, large quantity food display, professional corporate style, organized layout, premium quality food photography",
        "style": "studio",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_holiday",
        "name": "명절 특선",
        "desc": "설/추석 명절 특선 메뉴 포스터",
        "icon": "gift",
        "color": "#dc2626",
        "prompt": "korean holiday special menu poster, traditional korean festive design, elegant gift box style, premium food arrangement, red and gold traditional colors, luxurious presentation",
        "style": "premium",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_lunch",
        "name": "점심 특가",
        "desc": "직장인 대상 점심 할인 포스터",
        "icon": "clock",
        "color": "#0ea5e9",
        "prompt": "lunch special deal poster, korean restaurant, quick and delicious lunch set, clock icon emphasizing time, business district style, clean modern typography, appetizing food",
        "style": "minimal",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_free_delivery",
        "name": "무료 배달",
        "desc": "배달비 무료 프로모션 포스터",
        "icon": "truck",
        "color": "#14b8a6",
        "prompt": "free delivery promotion poster, korean restaurant, delivery scooter icon, food delivery concept, green and white clean design, appetizing food photos, modern flat design",
        "style": "minimal",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_bogo",
        "name": "1+1 이벤트",
        "desc": "하나 사면 하나 더! 이벤트 포스터",
        "icon": "plus-circle",
        "color": "#e11d48",
        "prompt": "buy one get one free event poster, korean restaurant, two identical dishes side by side, bold exciting typography, vibrant colors, celebration confetti, dynamic design",
        "style": "premium",
        "width": 768, "height": 1024,
    },
    {
        "id": "poster_membership",
        "name": "적립/멤버십",
        "desc": "스탬프 적립 또는 멤버십 안내",
        "icon": "star",
        "color": "#a855f7",
        "prompt": "loyalty membership program poster, korean restaurant, stamp card concept, VIP golden card design, premium rewards illustration, elegant purple and gold colors",
        "style": "minimal",
        "width": 768, "height": 1024,
    },
]

SNS_PRESETS = [
    {
        "id": "sns_insta_feed",
        "name": "인스타 피드",
        "desc": "정사각형 인스타그램 피드용 이미지",
        "icon": "instagram",
        "color": "#e1306c",
        "prompt": "instagram feed post, square format, korean restaurant food photography, aesthetic minimalist style, warm natural lighting, beautiful plating, clean composition",
        "style": "natural",
        "width": 1024, "height": 1024,
    },
    {
        "id": "sns_insta_story",
        "name": "인스타 스토리",
        "desc": "세로형 인스타그램 스토리 이미지",
        "icon": "smartphone",
        "color": "#833ab4",
        "prompt": "instagram story format, vertical, korean restaurant promotion, vibrant gradient background, modern typography overlay area, appetizing food closeup, trendy design",
        "style": "closeup",
        "width": 576, "height": 1024,
    },
    {
        "id": "sns_insta_reels",
        "name": "릴스 썸네일",
        "desc": "인스타 릴스/숏폼 썸네일 이미지",
        "icon": "play-circle",
        "color": "#fd1d1d",
        "prompt": "short-form video thumbnail, vertical, korean food making process, dynamic angle, steam and movement, vibrant saturated colors, play button overlay area",
        "style": "steam",
        "width": 576, "height": 1024,
    },
    {
        "id": "sns_kakao",
        "name": "카카오톡 채널",
        "desc": "카카오톡 채널 포스트 이미지",
        "icon": "message-circle",
        "color": "#fee500",
        "prompt": "kakao channel post image, korean restaurant, warm friendly style, yellow accent colors, cute and approachable design, appetizing food photography, clean layout",
        "style": "casual",
        "width": 1024, "height": 768,
    },
    {
        "id": "sns_naver_blog",
        "name": "네이버 블로그",
        "desc": "네이버 블로그 대표 이미지",
        "icon": "edit-3",
        "color": "#2db400",
        "prompt": "naver blog header image, korean restaurant review style, multiple dishes arranged on table, overhead shot, natural daylight, authentic food photography, editorial quality",
        "style": "overhead",
        "width": 1024, "height": 768,
    },
    {
        "id": "sns_youtube",
        "name": "유튜브 썸네일",
        "desc": "유튜브 영상 썸네일 이미지",
        "icon": "youtube",
        "color": "#ff0000",
        "prompt": "youtube thumbnail, korean food mukbang style, extreme closeup of delicious food, bold text overlay area on right, dramatic lighting, vibrant saturated colors, mouth-watering",
        "style": "closeup",
        "width": 1024, "height": 576,
    },
    {
        "id": "sns_today_menu",
        "name": "오늘의 메뉴",
        "desc": "매일 올리는 오늘의 추천 메뉴",
        "icon": "calendar",
        "color": "#f59e0b",
        "prompt": "today's special menu post, korean restaurant, single hero dish beautifully plated, soft bokeh background, warm golden hour lighting, date stamp style design element",
        "style": "natural",
        "width": 1024, "height": 1024,
    },
    {
        "id": "sns_review_thanks",
        "name": "리뷰 감사",
        "desc": "고객 리뷰 감사 답글용 이미지",
        "icon": "heart",
        "color": "#ec4899",
        "prompt": "thank you customer review image, korean restaurant, heart shaped food arrangement, warm grateful atmosphere, pink and white soft colors, cute charming design",
        "style": "casual",
        "width": 1024, "height": 1024,
    },
    {
        "id": "sns_behind",
        "name": "비하인드 스토리",
        "desc": "주방 비하인드/제조 과정 공유",
        "icon": "camera",
        "color": "#64748b",
        "prompt": "behind the scenes kitchen, korean restaurant cooking process, chef hands preparing food, authentic documentary style, warm kitchen lighting, steam rising, candid shot",
        "style": "casual",
        "width": 1024, "height": 1024,
    },
    {
        "id": "sns_staff_intro",
        "name": "직원 소개",
        "desc": "우리 매장 직원 소개 게시물",
        "icon": "smile",
        "color": "#06b6d4",
        "prompt": "staff introduction post, korean restaurant, clean uniform, warm smile, bright kitchen background, professional portrait style, friendly and welcoming atmosphere",
        "style": "studio",
        "width": 1024, "height": 1024,
    },
    {
        "id": "sns_ranking",
        "name": "맛집 랭킹",
        "desc": "맛집 선정/수상 축하 게시물",
        "icon": "award",
        "color": "#eab308",
        "prompt": "restaurant award celebration post, korean restaurant, golden trophy or medal, best restaurant badge, premium food display, confetti, luxurious dark background with gold accents",
        "style": "premium",
        "width": 1024, "height": 1024,
    },
    {
        "id": "sns_event_winner",
        "name": "이벤트 당첨",
        "desc": "이벤트 당첨자 발표용 이미지",
        "icon": "gift",
        "color": "#7c3aed",
        "prompt": "event winner announcement post, celebration design, confetti and sparkles, gift box, exciting vibrant colors, purple and gold, congratulations typography area",
        "style": "premium",
        "width": 1024, "height": 1024,
    },
]

DELIVERY_PRESETS = [
    {
        "id": "dlv_coupang_main",
        "name": "쿠팡이츠 메인",
        "desc": "쿠팡이츠 매장 메인 배너",
        "icon": "shopping-cart",
        "color": "#e31837",
        "prompt": "coupang eats main banner, korean restaurant, hero dish beautifully presented, clean white background, professional food photography, appetizing closeup, studio lighting",
        "style": "studio",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_baemin_main",
        "name": "배달의민족 메인",
        "desc": "배민 매장 메인 배너 이미지",
        "icon": "bike",
        "color": "#2ac1bc",
        "prompt": "baemin restaurant main banner, korean food, clean minimalist composition, mint green accent elements, premium food photography, warm inviting style, professional quality",
        "style": "minimal",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_yogiyo_main",
        "name": "요기요 메인",
        "desc": "요기요 매장 메인 배너 이미지",
        "icon": "utensils",
        "color": "#fa0050",
        "prompt": "yogiyo restaurant banner, korean food, vibrant pink accent design, appetizing food arrangement, modern clean layout, high quality food photography, professional",
        "style": "studio",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_new_menu",
        "name": "신메뉴 알림",
        "desc": "배달앱 신메뉴 출시 알림 배너",
        "icon": "bell",
        "color": "#f59e0b",
        "prompt": "new menu alert banner, delivery app, korean food, NEW badge, sparkling effects, appetizing hero dish, clean modern design, attention-grabbing",
        "style": "studio",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_coupon",
        "name": "할인 쿠폰",
        "desc": "배달앱 할인 쿠폰 배너",
        "icon": "ticket",
        "color": "#ef4444",
        "prompt": "discount coupon banner, delivery app promotion, korean restaurant, bold red sale badge, coupon ticket design element, appetizing food, urgent limited time offer style",
        "style": "premium",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_free_delivery",
        "name": "무료배달",
        "desc": "배달비 무료 프로모션 배너",
        "icon": "truck",
        "color": "#10b981",
        "prompt": "free delivery promotion banner, delivery app, korean restaurant, green free badge, delivery scooter icon, appetizing food, clean modern design, trust-building",
        "style": "minimal",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_first_order",
        "name": "첫 주문 할인",
        "desc": "신규 고객 첫 주문 할인 배너",
        "icon": "zap",
        "color": "#8b5cf6",
        "prompt": "first order discount banner, delivery app, korean restaurant, welcome new customer design, sparkle effects, purple gradient, appetizing food display, exciting offer",
        "style": "premium",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_reorder",
        "name": "재주문 감사",
        "desc": "단골 고객 재주문 감사 배너",
        "icon": "repeat",
        "color": "#ec4899",
        "prompt": "reorder thank you banner, delivery app, korean restaurant, loyalty appreciation design, heart icons, warm pink and white colors, familiar favorite dish display",
        "style": "casual",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_review_event",
        "name": "리뷰 이벤트",
        "desc": "리뷰 작성 시 혜택 배너",
        "icon": "message-square",
        "color": "#06b6d4",
        "prompt": "review event banner, delivery app, korean restaurant, star rating design, review speech bubble, gift reward icon, friendly blue and white design, encouraging",
        "style": "minimal",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_time_sale",
        "name": "시간대 할인",
        "desc": "특정 시간대 한정 할인 배너",
        "icon": "clock",
        "color": "#f97316",
        "prompt": "time-limited sale banner, delivery app, korean restaurant, clock countdown design, urgent orange and red colors, appetizing food, flash sale badge, dynamic layout",
        "style": "premium",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_set_deal",
        "name": "세트 할인",
        "desc": "세트 메뉴 할인 배너",
        "icon": "layers",
        "color": "#3b82f6",
        "prompt": "combo set deal banner, delivery app, korean restaurant, multiple dishes grouped together, value price badge, blue clean design, overhead shot of complete set meal",
        "style": "overhead",
        "width": 1024, "height": 576,
    },
    {
        "id": "dlv_seasonal",
        "name": "계절 특선",
        "desc": "계절 한정 메뉴 배달 배너",
        "icon": "sun",
        "color": "#14b8a6",
        "prompt": "seasonal special menu banner, delivery app, korean restaurant, seasonal ingredients and flowers, elegant nature-inspired design, teal and green accents, fresh and inviting",
        "style": "natural",
        "width": 1024, "height": 576,
    },
]

TTS_PRESETS = [
    {
        "id": "tts_store_intro",
        "name": "매장 소개",
        "desc": "매장을 소개하는 나레이션",
        "icon": "home",
        "color": "#3b82f6",
        "voice": "ko-KR-SunHiNeural",
        "script": "안녕하세요, {store_name}입니다. 매일 아침 신선한 재료로 정성껏 준비하는 건강한 한 끼, 저희 매장에서 만나보세요. 언제나 변함없는 맛과 정성으로 여러분을 기다리겠습니다.",
    },
    {
        "id": "tts_menu_desc",
        "name": "메뉴 설명",
        "desc": "대표 메뉴를 설명하는 나레이션",
        "icon": "book-open",
        "color": "#f59e0b",
        "voice": "ko-KR-SunHiNeural",
        "script": "저희 {store_name}의 대표 메뉴를 소개합니다. 엄선된 재료와 정통 레시피로 만든 특별한 맛, 한 입 드시면 그 차이를 느끼실 수 있습니다. 지금 바로 주문해보세요.",
    },
    {
        "id": "tts_event",
        "name": "이벤트 안내",
        "desc": "진행 중인 이벤트를 안내",
        "icon": "megaphone",
        "color": "#ef4444",
        "voice": "ko-KR-SunHiNeural",
        "script": "{store_name}에서 특별한 이벤트를 준비했습니다! 지금 주문하시면 놀라운 혜택이 기다리고 있어요. 이 기회를 놓치지 마세요! 자세한 내용은 매장에서 확인해주세요.",
    },
    {
        "id": "tts_welcome",
        "name": "환영 인사",
        "desc": "매장 방문 고객 환영 멘트",
        "icon": "hand",
        "color": "#10b981",
        "voice": "ko-KR-SunHiNeural",
        "script": "어서오세요, {store_name}에 오신 것을 환영합니다! 오늘도 신선하고 맛있는 음식으로 여러분의 하루를 응원하겠습니다. 편안하게 즐겨주세요.",
    },
    {
        "id": "tts_delivery_promo",
        "name": "배달 프로모션",
        "desc": "배달 주문 유도 나레이션",
        "icon": "truck",
        "color": "#8b5cf6",
        "voice": "ko-KR-SunHiNeural",
        "script": "{store_name}의 맛을 집에서도 즐기세요! 배달앱에서 간편하게 주문하시면, 따뜻하고 맛있는 음식을 문 앞까지 빠르게 배달해드립니다.",
    },
    {
        "id": "tts_season_greeting",
        "name": "시즌 인사",
        "desc": "계절/명절 인사 나레이션",
        "icon": "snowflake",
        "color": "#06b6d4",
        "voice": "ko-KR-SunHiNeural",
        "script": "고객님, 행복한 하루 보내고 계신가요? {store_name}에서 이번 시즌 특별 메뉴를 준비했습니다. 소중한 분들과 함께 따뜻한 한 끼 어떠세요?",
    },
    {
        "id": "tts_hours",
        "name": "영업시간 안내",
        "desc": "매장 영업시간 안내 멘트",
        "icon": "clock",
        "color": "#64748b",
        "voice": "ko-KR-SunHiNeural",
        "script": "{store_name}의 영업시간을 안내드립니다. 평일은 오전 열 시부터 오후 아홉 시까지, 주말과 공휴일은 오전 열한 시부터 오후 여덟 시까지 운영합니다.",
    },
    {
        "id": "tts_thanks",
        "name": "감사 인사",
        "desc": "고객 감사 메시지 나레이션",
        "icon": "heart",
        "color": "#ec4899",
        "voice": "ko-KR-SunHiNeural",
        "script": "항상 {store_name}을 찾아주시는 고객님께 진심으로 감사드립니다. 앞으로도 더 맛있고 건강한 음식으로 보답하겠습니다. 감사합니다.",
    },
    {
        "id": "tts_brand_story",
        "name": "브랜드 스토리",
        "desc": "매장 브랜드 스토리 나레이션",
        "icon": "book",
        "color": "#a855f7",
        "voice": "ko-KR-HyunsuMultilingualNeural",
        "script": "{store_name}은 정직한 재료와 진심을 담은 요리로 시작했습니다. 하나하나 손으로 빚는 정성, 가족의 건강을 생각하는 마음으로 오늘도 정성껏 만들고 있습니다.",
    },
    {
        "id": "tts_hygiene",
        "name": "위생 안내",
        "desc": "매장 위생/안전 관리 안내",
        "icon": "shield",
        "color": "#14b8a6",
        "voice": "ko-KR-SunHiNeural",
        "script": "{store_name}은 고객님의 안전을 최우선으로 생각합니다. 매일 철저한 위생 관리와 신선한 식재료 검수를 실시하고 있으며, 안심하고 드실 수 있도록 최선을 다하겠습니다.",
    },
    {
        "id": "tts_order_guide",
        "name": "주문 안내",
        "desc": "주문 방법을 안내하는 멘트",
        "icon": "list",
        "color": "#f97316",
        "voice": "ko-KR-SunHiNeural",
        "script": "주문 방법을 안내드립니다. 매장에서 직접 주문하시거나, 배달앱을 통해 간편하게 주문하실 수 있습니다. 전화 주문도 가능하오니 편한 방법으로 이용해주세요.",
    },
    {
        "id": "tts_new_menu",
        "name": "신메뉴 소개",
        "desc": "새로운 메뉴를 소개하는 나레이션",
        "icon": "sparkles",
        "color": "#eab308",
        "voice": "ko-KR-SunHiNeural",
        "script": "{store_name}의 새로운 메뉴가 출시되었습니다! 오랜 연구 끝에 탄생한 특별한 맛, 한번 드시면 반하실 거예요. 출시 기념 특별 가격으로 만나보세요!",
    },
]

MUSIC_PRESETS = [
    {
        "id": "music_bright",
        "name": "밝고 경쾌한",
        "desc": "매장에 활기를 주는 밝은 BGM",
        "icon": "sun",
        "color": "#f59e0b",
        "tags": "bright, cheerful, upbeat, happy, pop, major key",
        "prompt": "A bright and cheerful background music for a Korean restaurant, upbeat tempo, happy melody with acoustic guitar and light percussion, warm and welcoming atmosphere",
        "duration": 30,
    },
    {
        "id": "music_relaxing",
        "name": "편안한 식사",
        "desc": "식사 시간에 어울리는 잔잔한 음악",
        "icon": "coffee",
        "color": "#8b5cf6",
        "tags": "calm, relaxing, ambient, dining, gentle, soothing",
        "prompt": "Calm and relaxing dining background music, gentle piano melody with soft strings, peaceful atmosphere perfect for a family restaurant, warm and comfortable",
        "duration": 30,
    },
    {
        "id": "music_upbeat_promo",
        "name": "활기찬 프로모션",
        "desc": "광고/홍보 영상용 에너지 넘치는 음악",
        "icon": "zap",
        "color": "#ef4444",
        "tags": "energetic, promotional, dynamic, exciting, advertisement, upbeat",
        "prompt": "Energetic and exciting promotional background music for a restaurant advertisement, dynamic beat with catchy melody, modern pop production, builds excitement",
        "duration": 30,
    },
    {
        "id": "music_morning",
        "name": "아침 상쾌한",
        "desc": "상쾌한 아침 분위기의 BGM",
        "icon": "sunrise",
        "color": "#10b981",
        "tags": "morning, fresh, light, acoustic, nature, bright start",
        "prompt": "Fresh morning background music, light acoustic guitar with birds chirping, gentle ukulele, positive and refreshing start to the day, cafe morning vibes",
        "duration": 30,
    },
    {
        "id": "music_lunch_energy",
        "name": "점심 에너지",
        "desc": "점심 시간 활기찬 분위기",
        "icon": "battery-charging",
        "color": "#3b82f6",
        "tags": "lunch, energetic, groovy, funky, upbeat, busy",
        "prompt": "Energetic lunch hour background music, groovy bass line with funky guitar riffs, upbeat drums, positive energy for a busy restaurant lunch rush",
        "duration": 30,
    },
    {
        "id": "music_evening",
        "name": "저녁 아늑한",
        "desc": "따뜻한 저녁 식사 분위기",
        "icon": "moon",
        "color": "#6366f1",
        "tags": "evening, cozy, warm, intimate, soft, dinner",
        "prompt": "Cozy evening dinner background music, warm jazzy piano with soft brushed drums, intimate and comfortable atmosphere, mellow and sophisticated",
        "duration": 30,
    },
    {
        "id": "music_festival",
        "name": "축제/이벤트",
        "desc": "특별 이벤트용 축제 분위기 음악",
        "icon": "party-popper",
        "color": "#e11d48",
        "tags": "festival, celebration, party, exciting, festive, event",
        "prompt": "Festive celebration background music for a restaurant event, exciting brass section with upbeat rhythm, confetti and party atmosphere, joyful and energetic",
        "duration": 30,
    },
    {
        "id": "music_korean_modern",
        "name": "한국 전통 모던",
        "desc": "한국적 감성의 모던 퓨전 음악",
        "icon": "music",
        "color": "#dc2626",
        "tags": "korean traditional, modern, fusion, gayageum, contemporary, k-music",
        "prompt": "Modern Korean fusion background music, traditional gayageum or haegeum melodies blended with electronic beats, contemporary K-culture style, elegant and unique",
        "duration": 30,
    },
    {
        "id": "music_jazz",
        "name": "재즈 카페",
        "desc": "세련된 재즈 카페 분위기",
        "icon": "music-2",
        "color": "#0ea5e9",
        "tags": "jazz, cafe, sophisticated, smooth, saxophone, piano",
        "prompt": "Smooth jazz cafe background music, saxophone melody with piano chords, walking bass line, sophisticated and relaxed atmosphere, classic jazz lounge feel",
        "duration": 30,
    },
    {
        "id": "music_lofi",
        "name": "로파이 칠",
        "desc": "트렌디한 로파이 힙합 BGM",
        "icon": "headphones",
        "color": "#64748b",
        "tags": "lo-fi, chill, hip-hop, study, relaxed, beats",
        "prompt": "Lo-fi chill hip-hop background music, mellow beats with vinyl crackle, soft piano samples, relaxed and trendy atmosphere, perfect for a modern casual restaurant",
        "duration": 30,
    },
    {
        "id": "music_acoustic",
        "name": "어쿠스틱 감성",
        "desc": "따뜻한 어쿠스틱 기타 음악",
        "icon": "guitar",
        "color": "#f97316",
        "tags": "acoustic, warm, guitar, heartfelt, folk, indie",
        "prompt": "Warm acoustic guitar background music, fingerpicking style with gentle melody, heartfelt and sincere atmosphere, indie folk feel, perfect for a homestyle restaurant",
        "duration": 30,
    },
    {
        "id": "music_trendy_pop",
        "name": "트렌디 팝",
        "desc": "최신 트렌드 K-POP 느낌",
        "icon": "trending-up",
        "color": "#a855f7",
        "tags": "pop, trendy, modern, K-pop inspired, catchy, young",
        "prompt": "Trendy K-pop inspired background music, catchy synth melody with modern production, youthful and fresh energy, perfect for a trendy Korean food brand",
        "duration": 30,
    },
]


# ─────────────────────────────────────────────
# Request Models
# ─────────────────────────────────────────────

class ImageGenRequest(BaseModel):
    preset_id: str
    custom_prompt: Optional[str] = None
    product_name: Optional[str] = None
    store_name: Optional[str] = None
    style: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class TTSGenRequest(BaseModel):
    preset_id: str
    custom_text: Optional[str] = None
    store_name: str = "소담김밥"
    voice: Optional[str] = None
    speed: str = "+0%"


class MusicGenRequest(BaseModel):
    preset_id: str
    custom_prompt: Optional[str] = None
    duration: Optional[int] = None


# ─────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────

def get_all_presets() -> dict:
    """전체 프리셋 목록을 딕셔너리로 반환"""
    return {
        "poster": POSTER_PRESETS,
        "sns": SNS_PRESETS,
        "delivery": DELIVERY_PRESETS,
        "tts": TTS_PRESETS,
        "music": MUSIC_PRESETS,
    }


def _find_image_preset(preset_id: str):
    """이미지 프리셋(poster/sns/delivery) 중에서 ID로 검색"""
    all_img = POSTER_PRESETS + SNS_PRESETS + DELIVERY_PRESETS
    return next((p for p in all_img if p["id"] == preset_id), None)


def _build_image_prompt(req: ImageGenRequest, preset: dict) -> str:
    """요청 + 프리셋 정보로 최종 이미지 프롬프트 조립"""
    prompt = req.custom_prompt or preset["prompt"]
    if req.product_name:
        prompt = f"{req.product_name}, {prompt}"
    if req.store_name:
        prompt = f"{prompt}, restaurant name: {req.store_name}"
    return prompt


def _save_content_to_storage(file_bytes: bytes, category: str, preset_id: str, ext: str) -> tuple:
    """스토리지에 파일 업로드 후 (url, storage_key) 반환"""
    storage = get_storage()
    key = f"promo/{category}/{preset_id}_{uuid.uuid4().hex[:8]}.{ext}"
    content_type = "image/png" if ext == "png" else "audio/mpeg" if ext == "mp3" else "audio/wav"
    url = storage.upload_file(io.BytesIO(file_bytes), key, content_type)
    return url, key
