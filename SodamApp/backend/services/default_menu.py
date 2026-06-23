# -*- coding: utf-8 -*-
"""매장 기본 메뉴 시드 데이터 — 신규/기존 매장이 이걸로 시작.
프론트 전역 recipes.js / menuPrices.js 를 일반화(브랜드명 제거)하여 백엔드로 이전.
각 항목: item_type, name, category, price, emoji, spec?, ingredients[], steps[].
"""

# ── 판매 메뉴 (item_type='product') ──
PRODUCTS = [
    # 김밥류
    dict(name="기본김밥", category="gimbap", price=5000, emoji="🍱",
         ingredients=["김 1장","밥","당근채","시금치","단무지","오이","계란지단","맛살"],
         steps=["김 위에 밥을 고르게 편다.","재료를 가지런히 올린다.","단단하게 말아 성형한다.","참기름·깨로 마무리.","한입 크기로 썬다."]),
    dict(name="야채김밥", category="gimbap", price=5000, emoji="🍱",
         ingredients=["김 1장","밥","당근채","시금치","단무지","오이","계란지단"],
         steps=["김에 밥을 편다.","야채를 듬뿍 올린다.","단단하게 말아 참기름을 바른다.","썰어 담는다."]),
    dict(name="참치김밥", category="gimbap", price=5500, emoji="🍱",
         ingredients=["김 1장","밥","참치마요","당근채","오이","단무지","계란지단"],
         steps=["김에 밥을 편다.","참치마요를 중심에 올린다.","나머지 재료를 올려 만다.","썰어 담는다."]),
    dict(name="치즈김밥", category="gimbap", price=5500, emoji="🍱",
         ingredients=["김 1장","밥","슬라이스 치즈","당근채","시금치","단무지","계란지단"],
         steps=["김에 밥을 편다.","치즈를 길게 올린다.","나머지 재료와 함께 만다.","썰어 담는다."]),
    dict(name="매운김밥", category="gimbap", price=5500, emoji="🍱",
         ingredients=["김 1장","밥","매콤 볶음","당근채","오이","단무지","계란지단"],
         steps=["김에 밥을 편다.","매콤 볶음을 올린다.","나머지 재료와 함께 만다.","썰어 담는다."]),
    dict(name="불고기김밥", category="gimbap", price=6000, emoji="🍱",
         ingredients=["김 1장","밥","불고기","당근채","오이","단무지","계란지단"],
         steps=["김에 밥을 편다.","불고기를 중심에 올린다.","나머지 재료와 함께 만다.","썰어 담는다."]),
    dict(name="스팸에그김밥", category="gimbap", price=6000, emoji="🍱",
         ingredients=["김 1장","밥","스팸","계란지단","당근채"],
         steps=["김에 밥을 편다.","스팸·두꺼운 계란지단을 올린다.","당근채와 함께 만다.","썰어 담는다."]),
    dict(name="꼬마김밥", category="gimbap", price=7000, emoji="🍱", spec="여러 개",
         ingredients=["김 1/2장","밥 소량","단무지"],
         steps=["김을 반으로 자른다.","밥을 얇게 편다.","단무지를 넣고 작게 만다.","여러 개씩 묶어 담는다."]),
    dict(name="모둠김밥", category="gimbap", price=13000, emoji="🍱", spec="모둠",
         ingredients=["기본김밥","불고기김밥","치즈김밥","유부초밥"],
         steps=["여러 종류 김밥을 썰어 보기 좋게 담는다.","유부초밥을 곁들인다.","뚜껑을 닫아 담는다."]),
    # 분식류
    dict(name="떡볶이", category="bunsik", price=4500, emoji="🌶️", spec="1인분",
         ingredients=["밀떡","떡볶이 양념","어묵","물"],
         steps=["양념을 물에 푼다.","밀떡·어묵을 넣고 끓인다.","걸쭉해지면 불을 줄인다.","담아 제공한다."]),
    dict(name="미니떡볶이", category="bunsik", price=2500, emoji="🌶️", spec="1인분",
         ingredients=["밀떡","떡볶이 양념","물"],
         steps=["양념을 물에 푼다.","밀떡을 넣고 끓인다.","깨를 뿌려 제공한다."]),
    dict(name="순대", category="bunsik", price=4000, emoji="🫕", spec="1인분",
         ingredients=["찹쌀순대"], steps=["순대를 쪄서 익힌다.","먹기 좋게 썬다.","소금장과 함께 제공한다."]),
    dict(name="미니순대", category="bunsik", price=2000, emoji="🫕", spec="1인분",
         ingredients=["찹쌀순대 1/2"], steps=["순대를 쪄서 익힌다.","썰어 담는다.","소금장과 함께 제공한다."]),
    dict(name="어묵", category="bunsik", price=3000, emoji="🍢", spec="1인분",
         ingredients=["어묵 꼬치","어묵 국물"], steps=["꼬치를 국물에 끓인다.","국물과 함께 제공한다."]),
    dict(name="유부초밥", category="bunsik", price=6500, emoji="🍣",
         ingredients=["유부 주머니","초밥 밥"], steps=["초밥 밥을 준비한다.","유부에 밥을 채워 성형한다.","담아 제공한다."]),
    dict(name="삶은계란", category="bunsik", price=2000, emoji="🥚", spec="2개",
         ingredients=["계란"], steps=["끓는 물에 삶는다.","찬물에 식혀 껍질을 벗긴다."]),
    # 주먹밥류
    dict(name="스팸 삼각주먹밥", category="onigiri", price=3000, emoji="🍙",
         ingredients=["밥","후리가케","참기름","스팸","김"],
         steps=["밥에 후리가케·참기름을 섞는다.","삼각틀에 밥·스팸을 넣어 성형한다.","김으로 감싼다."]),
    dict(name="참치 삼각주먹밥", category="onigiri", price=3000, emoji="🍙",
         ingredients=["밥","후리가케","참기름","참치마요","김"],
         steps=["밥에 후리가케·참기름을 섞는다.","삼각틀에 밥·참치마요를 넣어 성형한다.","김으로 감싼다."]),
    dict(name="불고기 삼각주먹밥", category="onigiri", price=3200, emoji="🍙",
         ingredients=["밥","후리가케","참기름","불고기","김"],
         steps=["밥에 후리가케·참기름을 섞는다.","삼각틀에 밥·불고기를 넣어 성형한다.","김으로 감싼다."]),
    dict(name="햄치즈 삼각주먹밥", category="onigiri", price=3200, emoji="🍙",
         ingredients=["밥","후리가케","참기름","햄","치즈","김가루"],
         steps=["햄을 잘게 썰어 밥에 섞는다.","삼각틀에 밥·치즈를 넣어 성형한다.","겉면에 김가루를 묻힌다."]),
    # 라면류
    dict(name="라면", category="ramen", price=5000, emoji="🍜", ingredients=["라면","물"], steps=["물을 끓여 라면을 조리한다."]),
    dict(name="계란라면", category="ramen", price=5500, emoji="🍜", ingredients=["라면","계란","물"], steps=["라면을 끓이고 계란을 푼다."]),
    dict(name="치즈라면", category="ramen", price=5500, emoji="🍜", ingredients=["라면","치즈","물"], steps=["라면을 끓이고 치즈를 올린다."]),
    # 음료류
    dict(name="생수", category="drinks", price=1000, emoji="💧", ingredients=[], steps=[]),
    dict(name="콜라", category="drinks", price=2000, emoji="🥤", ingredients=[], steps=[]),
    dict(name="사이다", category="drinks", price=2000, emoji="🥤", ingredients=[], steps=[]),
]

# ── 재료 레시피 (item_type='ingredient', 가격 없음) ──
INGREDIENTS = [
    dict(name="어묵 조림", category="banchan", emoji="🍢",
         ingredients=["어묵","간장","물엿","다진 마늘","식용유","물"],
         steps=["어묵을 썬다.","양념장을 만든다.","식용유에 볶는다.","양념·물을 넣고 자작하게 조린다."]),
    dict(name="당근 라페", category="sauce", emoji="🥕",
         ingredients=["당근","식초","설탕","소금","올리브유"],
         steps=["당근을 채 썬다.","양념을 만든다.","버무려 잠시 절인다."]),
    dict(name="떡볶이 양념", category="sauce", emoji="🌶️",
         ingredients=["고춧가루","설탕","간장","다진 마늘","물엿"],
         steps=["재료를 섞는다.","단맛·매운맛을 조절한다.","밀폐 보관한다."]),
    dict(name="매콤 참치", category="tuna", emoji="🐟",
         ingredients=["참치캔","고추장","설탕","물엿","후추"],
         steps=["참치 기름을 뺀다.","양념을 만든다.","버무려 으깬다."]),
    dict(name="참치 마요", category="tuna", emoji="🐟",
         ingredients=["참치캔","마요네즈","설탕","후추"],
         steps=["참치 기름을 충분히 뺀다.","마요·간을 넣고 버무린다."]),
    dict(name="우엉 조림", category="banchan", emoji="🥘",
         ingredients=["우엉","간장","설탕","미림","물엿","식용유"],
         steps=["우엉을 데쳐 헹군다.","양념과 조린다.","색이 나게 졸인다."]),
    dict(name="유부초밥 밥", category="sushi", emoji="🍣",
         ingredients=["밥","단촛물","다진 채소","깨"],
         steps=["밥에 단촛물을 섞는다.","채소·깨를 넣어 식힌다."]),
    dict(name="멸치 볶음", category="banchan", emoji="🐟",
         ingredients=["멸치","청양고추","설탕","간장","물엿","식용유","통깨"],
         steps=["멸치를 덖는다.","양념을 녹여 멸치를 넣는다.","청양고추·깨로 마무리."]),
    dict(name="불고기", category="meat", emoji="🥩",
         ingredients=["소고기","불고기 양념","설탕","대파"],
         steps=["고기를 양념에 재운다.","볶아 국물을 졸인다.","식혀 썬다."]),
    dict(name="오이 손질", category="prep", emoji="🥒",
         ingredients=["오이"], steps=["씻어 꼭지를 뗀다.","길이에 맞게 썬다.","물기를 뺀다."]),
]


def default_menu_rows():
    """(item_type, dict) 평탄화 리스트 반환 — sort_order는 순서대로."""
    rows = []
    for i, p in enumerate(PRODUCTS):
        rows.append(("product", i, p))
    for i, g in enumerate(INGREDIENTS):
        rows.append(("ingredient", i, g))
    return rows
