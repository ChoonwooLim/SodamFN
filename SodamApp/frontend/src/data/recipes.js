// ══════════════════════════════════════════
//  상품 레시피 (Product Recipes)
// ══════════════════════════════════════════
export const PRODUCT_RECIPES = [
    // ── 김밥류 ──
    {
        id: 'p1', file: 'products/sodam-gimbap.jpg', name: '소담김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '당근채', '우엉 조림', '단무지', '오이', '계란지단', '게맛살'],
        steps: ['김 위에 밥을 고르게 편다.', '재료를 순서대로 올린다: 계란지단, 게맛살, 당근채, 우엉, 단무지, 오이.', '김밥을 단단하게 말아 성형한다.', '참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 포장한다.'],
    },
    {
        id: 'p2', file: 'products/bulgogi-gimbap.jpg', name: '불고기김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '불고기', '당근채', '오이', '단무지', '계란지단', '게맛살', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '불고기를 중심 재료로 넉넉히 올린다.', '당근채, 오이, 단무지, 계란지단, 게맛살을 함께 올린다.', '단단하게 말아 참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 포장한다.'],
    },
    {
        id: 'p3', file: 'products/chamchi-gimbap.jpg', name: '참치김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '순한 참치', '당근채', '오이', '단무지', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '순한 참치를 중심 재료로 넉넉히 올린다.', '당근채, 오이, 단무지, 계란지단을 함께 올린다.', '단단하게 말아 참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 포장한다.'],
    },
    {
        id: 'p4', file: 'products/cheese-gimbap.jpg', name: '치즈김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '슬라이스 치즈', '당근채', '우엉 조림', '단무지', '오이', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '치즈를 중심에 길게 올린다.', '당근채, 우엉, 단무지, 오이, 계란지단을 함께 올린다.', '단단하게 말아 참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 포장한다.'],
    },
    {
        id: 'p5', file: 'products/danggeun-gimbap.jpg', name: '당근라페김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '당근 라페', '단무지', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '당근 라페를 듬뿍 올린다 (메인 재료).', '단무지, 계란지단을 함께 올린다.', '단단하게 말아 참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 포장한다.'],
    },
    {
        id: 'p6', file: 'products/ttaengcho-gimbap.jpg', name: '땡초멸치김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '땡초 멸치', '당근채', '오이', '단무지', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '땡초 멸치를 중심 재료로 올린다.', '당근채, 오이, 단무지, 계란지단을 함께 올린다.', '단단하게 말아 참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 포장한다.'],
    },
    {
        id: 'p7', file: 'products/spam-egg-gimbap.jpg', name: '스팸에그김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '스팸 (두툼하게 자른 것)', '계란지단 (두껍게)', '당근채', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '스팸을 두툼하게 썰어 중심에 올린다.', '두꺼운 계란지단을 스팸 옆에 올린다.', '당근채를 올리고 단단하게 말아준다.', '참기름을 바르고 깨를 뿌린 후 썰어 포장한다.'],
    },
    {
        id: 'p8', file: 'products/kkoma-gimbap.jpg', name: '꼬마김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장 (반으로 자름)', '밥 소량', '단무지', '깨'],
        steps: ['김을 반으로 자른다.', '밥을 얇게 편다.', '단무지를 가운데 놓고 작게 말아준다.', '참기름을 바르고 깨를 뿌린다.', '6~8개씩 묶어 포장한다.'],
    },
    {
        id: 'p9', file: 'products/modum-gimbap.jpg', name: '모둠김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['소담김밥 슬라이스', '불고기김밥 슬라이스', '치즈김밥 슬라이스', '유부초밥 3~4개', '당근채 (가니쉬)'],
        steps: ['크라프트 박스를 준비한다.', '소담김밥, 불고기김밥, 치즈김밥을 각각 썰어 담는다.', '유부초밥 3~4개를 가운데 배치한다.', '당근채로 가니쉬하여 색감을 살린다.', '뚜껑을 닫아 포장한다.'],
    },
    // ── 분식류 ──
    {
        id: 'p10', file: 'products/tteokbokki.jpg', name: '소담떡볶이', category: 'bunsik', emoji: '🌶️',
        ingredients: ['밀떡 (대)', '떡볶이 소스 (떡볶이 가루 + 물)', '어묵'],
        steps: ['떡볶이 가루를 물에 풀어 소스를 만든다.', '밀떡과 어묵을 넣고 끓인다.', '소스가 걸쭉해지면 불을 줄인다.', '접시에 담아 제공한다.'],
    },
    {
        id: 'p11', file: 'products/mini-tteokbokki.jpg', name: '미니떡볶이', category: 'bunsik', emoji: '🌶️',
        ingredients: ['밀떡 (소)', '떡볶이 소스 (떡볶이 가루 + 물)', '깨'],
        steps: ['떡볶이 가루를 물에 풀어 소스를 만든다.', '밀떡을 넣고 끓인다.', '소스가 걸쭉해지면 불을 줄인다.', '접시에 담고 깨를 뿌려 제공한다.'],
    },
    {
        id: 'p12', file: 'products/sundae.jpg', name: '소담순대', category: 'bunsik', emoji: '🫕',
        ingredients: ['찹쌀순대 1줄'],
        steps: ['찹쌀순대를 쪄서 익힌다.', '먹기 좋은 크기로 썰어 용기에 담는다 (약 12조각).', '소금장과 함께 제공한다.'],
    },
    {
        id: 'p13', file: 'products/mini-sundae.jpg', name: '미니순대', category: 'bunsik', emoji: '🫕',
        ingredients: ['찹쌀순대 반 줄'],
        steps: ['찹쌀순대를 쪄서 익힌다.', '먹기 좋은 크기로 썰어 접시에 담는다 (약 8조각).', '소금장과 함께 제공한다.'],
    },
    {
        id: 'p14', file: 'products/eomuk.jpg', name: '소담어묵', category: 'bunsik', emoji: '🍢',
        ingredients: ['어묵 꼬치 1개 (어묵 6~7조각)'],
        steps: ['어묵을 한입 크기로 잘라 꼬치에 꿴다.', '어묵 국물에 넣어 끓인다.', '접시에 담아 제공한다.'],
    },
    {
        id: 'p15', file: 'products/yubu.jpg', name: '유부초밥', category: 'bunsik', emoji: '🍣',
        ingredients: ['유부 주머니 8~10장', '초밥 밥 (우엉, 당근, 식초, 설탕, 깨)'],
        steps: ['유부초밥 밥을 준비한다 (→ 재료레시피 참고).', '유부 주머니에 밥을 적당량 넣고 성형한다.', '접시에 가지런히 담아 제공한다.'],
    },
    {
        id: 'p16', file: 'products/egg.jpg', name: '삶은계란', category: 'bunsik', emoji: '🥚',
        ingredients: ['계란 2개'],
        steps: ['물을 끓여 계란을 넣고 12분 삶는다.', '찬물에 식힌 후 껍질을 벗긴다.', '접시에 담아 제공한다.'],
    },
    // ── 주먹밥류 ──
    {
        id: 'p17', file: 'products/spam-onigiri.jpg', name: '스팸 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 160g', '후리가케', '참기름', '스팸 반 조각', '김', '비닐 포장지', '라벨 스티커'],
        steps: ['밥에 후리가케와 참기름을 넣고 섞는다.', '삼각틀에 밥 + 스팸 반 조각으로 성형한다.', '김으로 감싸고 비닐 포장지에 넣는다.', '"스팸" 라벨을 붙여 완성한다.'],
    },
    {
        id: 'p18', file: 'products/sunhan-onigiri.jpg', name: '순한참치 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 160g', '후리가케', '참기름', '순한 참치 20g', '김', '비닐 포장지', '라벨 스티커'],
        steps: ['밥에 후리가케와 참기름을 넣고 섞는다.', '삼각틀에 밥 + 순한 참치 20g으로 성형한다.', '김으로 감싸고 비닐 포장지에 넣는다.', '"순한참치" 라벨을 붙여 완성한다.'],
    },
    {
        id: 'p19', file: 'products/maekom-onigiri.jpg', name: '매콤참치 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 160g', '후리가케', '참기름', '매콤 참치 20g', '김', '비닐 포장지', '라벨 스티커'],
        steps: ['밥에 후리가케와 참기름을 넣고 섞는다.', '삼각틀에 밥 + 매콤 참치 20g으로 성형한다.', '김으로 감싸고 비닐 포장지에 넣는다.', '"매콤참치" 라벨을 붙여 완성한다.'],
    },
    {
        id: 'p20', file: 'products/bulgogi-onigiri.jpg', name: '불고기 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 171g', '후리가케', '참기름', '불고기 9g', '김', '비닐 포장지', '라벨 스티커'],
        steps: ['밥에 후리가케와 참기름을 넣고 섞는다.', '삼각틀에 밥 + 불고기 9g으로 성형한다.', '김으로 감싸고 비닐 포장지에 넣는다.', '"불고기" 라벨을 붙여 완성한다.'],
    },
    {
        id: 'p21', file: 'products/myeolchi-onigiri.jpg', name: '멸치 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 174g', '후리가케', '참기름', '멸치 6g', '김', '비닐 포장지', '라벨 스티커'],
        steps: ['밥에 후리가케와 참기름을 넣고 섞는다.', '삼각틀에 밥 + 멸치 6g으로 성형한다.', '김으로 감싸고 비닐 포장지에 넣는다.', '"멸치" 라벨을 붙여 완성한다.'],
    },
    {
        id: 'p22', file: 'products/hamcheese-onigiri.jpg', name: '햄치즈 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 165g', '후리가케', '참기름', '햄 반 줄', '치즈 반 개', '김가루', '비닐 포장지', '라벨 스티커'],
        steps: ['햄을 약 3mm 두께로 썰어 밥에 섞는다.', '밥 1/3을 삼각틀에 깔고 치즈 1/4을 올린다.', '나머지 밥 2/3를 올려 삼각틀로 성형한다.', '평평한 면에 치즈 1/4을 올리고 김가루를 묻힌다.', '비닐 포장지에 넣고 "햄치즈" 라벨을 붙인다.'],
    },
];

export const PRODUCT_CATEGORIES = [
    { key: 'all', label: '전체', emoji: '📋' },
    { key: 'gimbap', label: '김밥류', emoji: '🍱' },
    { key: 'bunsik', label: '분식류', emoji: '🌶️' },
    { key: 'onigiri', label: '주먹밥류', emoji: '🍙' },
];

export const PRODUCT_CATEGORY_LABEL = {
    gimbap: '김밥류', bunsik: '분식류', onigiri: '주먹밥류',
};

export const PRODUCT_CATEGORY_COLORS = {
    gimbap: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    bunsik: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    onigiri: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
};

// ══════════════════════════════════════════
//  재료 레시피 (Ingredient Recipes)
// ══════════════════════════════════════════
export const INGREDIENT_RECIPES = [
    {
        id: 'i1', file: null, name: '어묵 조림', category: 'banchan', emoji: '🍢',
        ingredients: ['어묵 한 봉지 반 (75장)', '간장 230~240g', '물엿 230~240g', '다시다 50g', '식용유 170g', '물 930g'],
        steps: ['어묵을 한입 크기로 썰어 준비한다.', '간장, 물엿, 다시다를 섞어 양념장을 만든다.', '냄비에 식용유를 두르고 어묵을 볶는다.', '양념장과 물을 넣고 중불에서 조린다.', '국물이 자작하게 줄어들 때까지 뒤적이며 조린다.'],
    },
    {
        id: 'i2', file: null, name: '당근 라페', category: 'sauce', emoji: '🥕',
        ingredients: ['당근 2.4kg', '연겨자 소스 80g', '설탕 60g', '다시다 35g'],
        steps: ['당근을 곱게 채 썬다.', '연겨자 소스, 설탕, 다시다를 섞어 양념을 만든다.', '채 썬 당근에 양념을 넣고 골고루 버무린다.'],
    },
    {
        id: 'i3', file: null, name: '떡볶이 가루', category: 'sauce', emoji: '🌶️',
        ingredients: ['고운 고춧가루 1.5kg', '고운 청양고춧가루 0.5kg', '설탕 7.7kg', '찹쌀가루 1kg', '맛소금 100g', '후추가루 50g', '다시다 1,000g', '마늘가루 250g', '미원 100g', '치킨스톡 250g'],
        steps: ['모든 가루 재료를 큰 볼에 넣는다.', '골고루 섞어준다.', '총 12,450g → 700g 17봉지 + 550g 1봉지로 소분한다.'],
    },
    {
        id: 'i4', file: null, name: '매콤 참치', category: 'tuna', emoji: '🐟',
        ingredients: ['참치캔 1통 (1.8kg)', '고추장 800g', '설탕 120g', '물엿 100g', '후추 8g (밥 수저 1개)', '다시다 14g (밥 수저 2개)'],
        steps: ['참치캔을 열어 기름을 빼준다.', '고추장, 설탕, 물엿, 후추, 다시다를 섞어 양념장을 만든다.', '기름 뺀 참치에 양념장을 넣고 골고루 버무린다.', '참치 덩어리가 있으면 손으로 으깨준다.'],
    },
    {
        id: 'i5', file: null, name: '순한 참치', category: 'tuna', emoji: '🐟',
        ingredients: ['참치캔 4통 (1.8kg × 4 = 총 7.2kg)', '마요네즈 2,400g', '설탕 450g', '후추 24g (밥 수저 3개)', '다시다 30g'],
        steps: ['참치 기름빼기: 볼에 참치를 담고 넓은 채반에 펴서 무거운 것으로 누른다.', '3~4시간 정도 기름을 빼준다 (오래 둘수록 잘 빠짐).', '기름은 신문지에 흡수시켜 일반 쓰레기로 배출.', '물기 제거한 큰 스테인리스 볼에 마요네즈를 먼저 넣는다.', '기름 뺀 참치를 넣고, 가루 재료는 맨 위에 올린다.', '골고루 버무리며 참치 덩어리를 손으로 으깨준다.', '진득진득해지면 잘 버무려진 상태 → 바트에 담아 보관.'],
    },
    {
        id: 'i6', file: null, name: '우엉 조림', category: 'banchan', emoji: '🥘',
        ingredients: ['우엉 4kg × 2봉지 (총 8kg)', '간장 1300g', '흑설탕 400g', '백설탕 300g', '미림 200g', '물엿 550g', '다시다 70g', '식용유 170g'],
        steps: ['큰 솥에 우엉이 잠길 정도로 물을 넣고 삶는다.', '물이 끓으면 6분 시간을 재고, 펄펄 끓으면 뒤집어 준다.', '6분 뒤 건져서 찬물에 헹궈 불순물을 제거한다.', '※ 너무 익히면 양념 조릴 때 우엉이 끊어짐!', '양념 재료를 모두 섞고, 물 뺀 우엉을 넣고 조린다.', '어묵보다 자주 뒤집고, 양념이 끓으면 6분 재기.', '색깔을 입히는 게 중요! 양념 국물이 많으면 3~6분 추가.'],
    },
    {
        id: 'i7', file: null, name: '유부초밥', category: 'sushi', emoji: '🍣',
        ingredients: ['[2kg] 우엉 250g · 당근 125g · 설탕 40g · 식초 155g · 검은 깨 20g', '[1kg] 우엉 125g · 당근 62g · 설탕 20g · 식초 77g · 검은 깨 10g', '[500g] 우엉 63g · 당근 31g · 설탕 10g · 식초 39g · 검은 깨 5g'],
        steps: ['새벽에 2kg 기준으로 준비한다.', '영업 중에는 상황에 맞게 적당량씩 추가로 만든다.', '남으면 다음 날 밥맛이 떨어지므로 주의.', '맛이 일관되게 유지되도록 계량을 반드시 지킨다.'],
    },
    {
        id: 'i8', file: null, name: '땡초 멸치', category: 'banchan', emoji: '🐟',
        ingredients: ['멸치 1박스', '청양고추 1kg', '백설탕 550g', '간장 100g', '소주 100g', '다시다 60g', '식용유 70g', '물엿 350g', '통깨 130g (1국자)'],
        steps: ['멸치 덖기: 대형 웍에 센 불로 덖는다.', '뒤집개로 쉬지 않고 계속 덖는다 (약간 탄 것 같을 정도까지).', '※ 반드시 목장갑 착용! 매우 뜨거움.', '청양고추: 씻어 물기 빼고, 가위로 반 자른 뒤 믹서기로 간다.', '양념 볶기: 웍에 양념을 넣고 중강불로 녹인 후, 멸치와 깨를 넣는다.', '다진 청양고추를 넣고 센 불에서 볶는다.', '팬 가운데에 물이 끓으면 소주를 한 바퀴 둘러 마무리.'],
    },
    {
        id: 'i9', file: null, name: '불고기', category: 'meat', emoji: '🥩',
        ingredients: ['설탕 60g (평평하게 1주걱)', '소주 50g (평평하게 1주걱)', '불고기 소스 120g (평평하게 2주걱)'],
        steps: ['※ 설탕은 반드시 정량! 너무 달아지지 않도록 주의.', '냄비에 불고기와 재료를 모두 넣는다.', '안·밖 불을 중간으로 맞추고 볶는다.', '불고기가 익으면 불을 크게 올린다 (안-90도, 밖-45도).', '국물이 거의 없어질 때까지 볶는다.', '불을 끄고 한 김 식히며 덖어준 후 잔열로 국물을 날린다.', '적당한 크기로 잘라 담는다.'],
    },
    {
        id: 'i10', file: null, name: '스팸', category: 'meat', emoji: '🥓',
        ingredients: ['스팸 10통'],
        steps: ['한 번에 10통씩 잘라 중불에서 굽는다.', '※ 바싹 구우면 김밥 전 데울 때 스팸이 마를 수 있으니 주의!'],
    },
    {
        id: 'i11', file: null, name: '오이 손질', category: 'prep', emoji: '🥒',
        ingredients: ['오이 (큰 바트 1개 분량)'],
        steps: ['오이를 물에 깨끗이 씻는다.', '꼭지를 떼어낸다.', '길면 3등분, 짧으면 2등분한다.', '물기가 빠지도록 바트에 밑받침을 깔아 둔다.'],
    },
    {
        id: 'i12', file: null, name: '스팸 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '10개',
        ingredients: ['밥 1,600g', '후리가케 50g', '참기름 16g', '스팸 반 조각 / 1개당 밥 160g'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 160g + 스팸 반 조각으로 삼각틀에 성형한다.'],
    },
    {
        id: 'i13', file: null, name: '순한참치 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '10개',
        ingredients: ['밥 1,600g', '후리가케 50g', '참기름 16g', '참치 20g / 1개당 밥 160g (총 180g)'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 160g + 참치 20g으로 삼각틀에 성형한다.'],
    },
    {
        id: 'i14', file: null, name: '매콤참치 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '10개',
        ingredients: ['밥 1,600g', '후리가케 50g', '참기름 16g', '참치 20g / 1개당 밥 160g (총 180g)'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 160g + 매콤 참치 20g으로 삼각틀에 성형한다.'],
    },
    {
        id: 'i15', file: null, name: '불고기 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '10개',
        ingredients: ['밥 1,710g', '후리가케 54g', '참기름 17g', '불고기 9g / 1개당 밥 171g (총 180g)'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 171g + 불고기 9g으로 삼각틀에 성형한다.'],
    },
    {
        id: 'i16', file: null, name: '멸치 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '10개',
        ingredients: ['밥 1,740g', '후리가케 55g', '참기름 17g', '멸치 6g / 1개당 밥 174g'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 174g + 멸치 6g으로 삼각틀에 성형한다.'],
    },
    {
        id: 'i17', file: null, name: '햄치즈 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '10개',
        ingredients: ['밥 1,650g', '후리가케 52g', '참기름 16g', '햄 반 줄 / 치즈 반 개 / 1개당 밥 165g'],
        steps: ['햄을 약 3mm 두께로 썰어 밥에 섞는다.', '밥 165g의 1/3을 삼각틀에 깐다.', '그 위에 치즈 1/4을 올린다.', '나머지 밥 2/3를 올려 삼각틀로 완성한다.', '삼각틀에서 뺀 후 평평한 면에 치즈 1/4을 올린다.', '평평한 쪽에 김가루를 묻힌다.', '비닐 포장지에 넣고 삼각 주먹밥 라벨을 붙인다.'],
    },
];

export const INGREDIENT_CATEGORIES = [
    { key: 'all', label: '전체', emoji: '📖' },
    { key: 'banchan', label: '반찬/조림', emoji: '🥘' },
    { key: 'tuna', label: '참치', emoji: '🐟' },
    { key: 'sauce', label: '소스/양념', emoji: '🍳' },
    { key: 'sushi', label: '초밥', emoji: '🍣' },
    { key: 'meat', label: '고기', emoji: '🥩' },
    { key: 'prep', label: '손질', emoji: '🥒' },
    { key: 'onigiri', label: '주먹밥', emoji: '🍙' },
];

export const INGREDIENT_CATEGORY_LABEL = {
    banchan: '반찬/조림', tuna: '참치', sauce: '소스/양념',
    sushi: '초밥', meat: '고기', prep: '손질', onigiri: '주먹밥',
};

export const INGREDIENT_CATEGORY_COLORS = {
    banchan: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    tuna: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
    sauce: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    sushi: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    meat: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    prep: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    onigiri: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
};
