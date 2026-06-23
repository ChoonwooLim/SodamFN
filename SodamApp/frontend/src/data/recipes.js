// ══════════════════════════════════════════
//  상품 레시피 (Product Recipes)
//  ※ 데모용 예시 레시피입니다. 실제 매장 비법이 아닙니다.
// ══════════════════════════════════════════
export const PRODUCT_RECIPES = [
    // ── 김밥류 ──
    {
        id: 'p1', file: 'products/sodam-gimbap.jpg', name: '기본김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '당근채', '시금치', '단무지', '오이', '계란지단', '맛살'],
        steps: ['김 위에 밥을 고르게 편다.', '재료를 가지런히 올린다.', '단단하게 말아 성형한다.', '참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 담는다.'],
    },
    {
        id: 'p2', file: 'products/bulgogi-gimbap.jpg', name: '불고기김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '불고기', '당근채', '오이', '단무지', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '불고기를 중심에 올린다.', '나머지 재료를 함께 올린다.', '단단하게 말아 참기름을 바른다.', '한입 크기로 썰어 담는다.'],
    },
    {
        id: 'p3', file: 'products/chamchi-gimbap.jpg', name: '참치김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '참치마요', '당근채', '오이', '단무지', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '참치마요를 중심에 올린다.', '나머지 재료를 함께 올린다.', '단단하게 말아 참기름을 바른다.', '한입 크기로 썰어 담는다.'],
    },
    {
        id: 'p4', file: 'products/cheese-gimbap.jpg', name: '치즈김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '슬라이스 치즈', '당근채', '시금치', '단무지', '오이', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '치즈를 중심에 길게 올린다.', '나머지 재료를 함께 올린다.', '단단하게 말아 참기름을 바른다.', '한입 크기로 썰어 담는다.'],
    },
    {
        id: 'p5', file: 'products/danggeun-gimbap.jpg', name: '야채김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '당근채', '시금치', '단무지', '오이', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '야채 재료를 듬뿍 올린다.', '단단하게 말아 참기름을 바른다.', '깨를 뿌린다.', '한입 크기로 썰어 담는다.'],
    },
    {
        id: 'p6', file: 'products/ttaengcho-gimbap.jpg', name: '매운김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '매콤 볶음', '당근채', '오이', '단무지', '계란지단', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '매콤 볶음을 중심에 올린다.', '나머지 재료를 함께 올린다.', '단단하게 말아 참기름을 바른다.', '한입 크기로 썰어 담는다.'],
    },
    {
        id: 'p7', file: 'products/spam-egg-gimbap.jpg', name: '스팸에그김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1장', '밥 적당량', '스팸', '계란지단', '당근채', '깨'],
        steps: ['김 위에 밥을 고르게 편다.', '스팸과 두툼한 계란지단을 중심에 올린다.', '당근채를 올려 단단하게 만다.', '참기름을 바르고 깨를 뿌린다.', '한입 크기로 썰어 담는다.'],
    },
    {
        id: 'p8', file: 'products/kkoma-gimbap.jpg', name: '꼬마김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['김 1/2장', '밥 소량', '단무지', '깨'],
        steps: ['김을 반으로 자른다.', '밥을 얇게 편다.', '단무지를 넣고 작게 만다.', '참기름을 바르고 깨를 뿌린다.', '여러 개씩 묶어 담는다.'],
    },
    {
        id: 'p9', file: 'products/modum-gimbap.jpg', name: '모둠김밥', category: 'gimbap', emoji: '🍱',
        ingredients: ['기본김밥 슬라이스', '불고기김밥 슬라이스', '치즈김밥 슬라이스', '유부초밥 약간'],
        steps: ['용기를 준비한다.', '여러 종류 김밥을 썰어 보기 좋게 담는다.', '유부초밥을 곁들인다.', '색감을 살려 마무리한다.', '뚜껑을 닫아 담는다.'],
    },
    // ── 분식류 ──
    {
        id: 'p10', file: 'products/tteokbokki.jpg', name: '떡볶이', category: 'bunsik', emoji: '🌶️',
        ingredients: ['밀떡 (대)', '떡볶이 양념', '어묵', '물'],
        steps: ['양념을 물에 푼다.', '밀떡과 어묵을 넣고 끓인다.', '걸쭉해지면 불을 줄인다.', '접시에 담아 제공한다.'],
    },
    {
        id: 'p11', file: 'products/mini-tteokbokki.jpg', name: '미니떡볶이', category: 'bunsik', emoji: '🌶️',
        ingredients: ['밀떡 (소)', '떡볶이 양념', '물', '깨'],
        steps: ['양념을 물에 푼다.', '밀떡을 넣고 끓인다.', '걸쭉해지면 불을 줄인다.', '깨를 뿌려 제공한다.'],
    },
    {
        id: 'p12', file: 'products/sundae.jpg', name: '순대', category: 'bunsik', emoji: '🫕',
        ingredients: ['찹쌀순대 1줄'],
        steps: ['순대를 쪄서 익힌다.', '먹기 좋은 크기로 썬다.', '소금장과 함께 제공한다.'],
    },
    {
        id: 'p13', file: 'products/mini-sundae.jpg', name: '미니순대', category: 'bunsik', emoji: '🫕',
        ingredients: ['찹쌀순대 1/2줄'],
        steps: ['순대를 쪄서 익힌다.', '먹기 좋은 크기로 썬다.', '소금장과 함께 제공한다.'],
    },
    {
        id: 'p14', file: 'products/eomuk.jpg', name: '어묵', category: 'bunsik', emoji: '🍢',
        ingredients: ['어묵 꼬치 1개', '어묵 국물'],
        steps: ['어묵을 꼬치에 꿴다.', '국물에 넣어 끓인다.', '국물과 함께 제공한다.'],
    },
    {
        id: 'p15', file: 'products/yubu.jpg', name: '유부초밥', category: 'bunsik', emoji: '🍣',
        ingredients: ['유부 주머니', '초밥 밥'],
        steps: ['초밥 밥을 준비한다 (→ 재료레시피 참고).', '유부 주머니에 밥을 채워 성형한다.', '가지런히 담아 제공한다.'],
    },
    {
        id: 'p16', file: 'products/egg.jpg', name: '삶은계란', category: 'bunsik', emoji: '🥚',
        ingredients: ['계란'],
        steps: ['끓는 물에 계란을 삶는다.', '찬물에 식혀 껍질을 벗긴다.', '담아 제공한다.'],
    },
    // ── 주먹밥류 ──
    {
        id: 'p17', file: 'products/spam-onigiri.jpg', name: '스팸 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥', '후리가케', '참기름', '스팸', '김', '포장지'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 스팸을 넣어 성형한다.', '김으로 감싼다.', '포장지에 넣어 마무리한다.'],
    },
    {
        id: 'p18', file: 'products/sunhan-onigiri.jpg', name: '참치 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥', '후리가케', '참기름', '참치마요', '김', '포장지'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 참치마요를 넣어 성형한다.', '김으로 감싼다.', '포장지에 넣어 마무리한다.'],
    },
    {
        id: 'p19', file: 'products/maekom-onigiri.jpg', name: '매콤참치 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥', '후리가케', '참기름', '매콤 참치', '김', '포장지'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 매콤 참치를 넣어 성형한다.', '김으로 감싼다.', '포장지에 넣어 마무리한다.'],
    },
    {
        id: 'p20', file: 'products/bulgogi-onigiri.jpg', name: '불고기 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥', '후리가케', '참기름', '불고기', '김', '포장지'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 불고기를 넣어 성형한다.', '김으로 감싼다.', '포장지에 넣어 마무리한다.'],
    },
    {
        id: 'p21', file: 'products/myeolchi-onigiri.jpg', name: '멸치 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥', '후리가케', '참기름', '멸치 볶음', '김', '포장지'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 멸치 볶음을 넣어 성형한다.', '김으로 감싼다.', '포장지에 넣어 마무리한다.'],
    },
    {
        id: 'p22', file: 'products/hamcheese-onigiri.jpg', name: '햄치즈 삼각주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥', '후리가케', '참기름', '햄', '치즈', '김가루', '포장지'],
        steps: ['햄을 잘게 썰어 밥에 섞는다.', '삼각틀에 밥과 치즈를 넣어 성형한다.', '겉면에 김가루를 묻힌다.', '포장지에 넣어 마무리한다.'],
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
//  ※ 데모용 예시 레시피입니다. 실제 매장 배합비/비법이 아닙니다.
//    각 매장에서 직접 입력해 사용하세요.
// ══════════════════════════════════════════
export const INGREDIENT_RECIPES = [
    {
        id: 'i1', file: null, name: '어묵 조림', category: 'banchan', emoji: '🍢',
        ingredients: ['어묵', '간장', '물엿', '다진 마늘', '식용유', '물'],
        steps: ['어묵을 한입 크기로 썬다.', '간장·물엿으로 양념장을 만든다.', '식용유에 어묵을 살짝 볶는다.', '양념장과 물을 넣고 조린다.', '국물이 자작해질 때까지 조린다.'],
    },
    {
        id: 'i2', file: null, name: '당근 라페', category: 'sauce', emoji: '🥕',
        ingredients: ['당근', '식초', '설탕', '소금', '올리브유'],
        steps: ['당근을 곱게 채 썬다.', '식초·설탕·소금으로 양념을 만든다.', '채 썬 당근에 버무린다.', '잠시 절여 맛이 배게 둔다.'],
    },
    {
        id: 'i3', file: null, name: '떡볶이 양념', category: 'sauce', emoji: '🌶️',
        ingredients: ['고춧가루', '설탕', '간장', '다진 마늘', '물엿'],
        steps: ['모든 재료를 한데 섞는다.', '취향에 맞게 단맛·매운맛을 조절한다.', '밀폐 용기에 보관한다.'],
    },
    {
        id: 'i4', file: null, name: '매콤 참치', category: 'tuna', emoji: '🐟',
        ingredients: ['참치캔', '고추장', '설탕', '물엿', '후추'],
        steps: ['참치 기름을 뺀다.', '고추장·설탕으로 양념을 만든다.', '참치에 버무린다.', '덩어리는 으깨 골고루 섞는다.'],
    },
    {
        id: 'i5', file: null, name: '참치 마요', category: 'tuna', emoji: '🐟',
        ingredients: ['참치캔', '마요네즈', '설탕', '후추'],
        steps: ['참치 기름을 충분히 뺀다.', '마요네즈를 넣고 섞는다.', '설탕·후추로 간한다.', '골고루 버무려 보관한다.'],
    },
    {
        id: 'i6', file: null, name: '우엉 조림', category: 'banchan', emoji: '🥘',
        ingredients: ['우엉', '간장', '설탕', '미림', '물엿', '식용유'],
        steps: ['우엉을 데쳐 불순물을 제거한다.', '찬물에 헹군다.', '양념과 함께 조린다.', '색이 나고 국물이 졸 때까지 조린다.'],
    },
    {
        id: 'i7', file: null, name: '유부초밥 밥', category: 'sushi', emoji: '🍣',
        ingredients: ['밥', '단촛물(식초·설탕·소금)', '다진 채소', '깨'],
        steps: ['따뜻한 밥에 단촛물을 섞는다.', '다진 채소와 깨를 넣는다.', '고루 섞어 식힌다.', '계량을 지켜 맛을 일정하게 유지한다.'],
    },
    {
        id: 'i8', file: null, name: '멸치 볶음', category: 'banchan', emoji: '🐟',
        ingredients: ['멸치', '청양고추', '설탕', '간장', '물엿', '식용유', '통깨'],
        steps: ['멸치를 마른 팬에 덖는다.', '양념을 녹인 뒤 멸치를 넣는다.', '다진 청양고추를 넣고 볶는다.', '통깨를 뿌려 마무리한다.'],
    },
    {
        id: 'i9', file: null, name: '불고기', category: 'meat', emoji: '🥩',
        ingredients: ['소고기(불고기용)', '불고기 양념', '설탕', '대파'],
        steps: ['고기를 양념에 재운다.', '팬에 볶는다.', '국물이 졸 때까지 익힌다.', '식혀 적당한 크기로 썬다.'],
    },
    {
        id: 'i10', file: null, name: '스팸 굽기', category: 'meat', emoji: '🥓',
        ingredients: ['스팸'],
        steps: ['스팸을 알맞게 썬다.', '중불에서 굽는다.', '너무 바싹 굽지 않도록 주의한다.'],
    },
    {
        id: 'i11', file: null, name: '오이 손질', category: 'prep', emoji: '🥒',
        ingredients: ['오이'],
        steps: ['오이를 깨끗이 씻는다.', '꼭지를 떼어낸다.', '길이에 맞게 썬다.', '물기를 빼 둔다.'],
    },
    {
        id: 'i12', file: null, name: '스팸 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '예시',
        ingredients: ['밥', '후리가케', '참기름', '스팸'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 스팸을 넣어 성형한다.'],
    },
    {
        id: 'i13', file: null, name: '참치 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '예시',
        ingredients: ['밥', '후리가케', '참기름', '참치마요'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 참치마요를 넣어 성형한다.'],
    },
    {
        id: 'i14', file: null, name: '매콤참치 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '예시',
        ingredients: ['밥', '후리가케', '참기름', '매콤 참치'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 매콤 참치를 넣어 성형한다.'],
    },
    {
        id: 'i15', file: null, name: '불고기 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '예시',
        ingredients: ['밥', '후리가케', '참기름', '불고기'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 불고기를 넣어 성형한다.'],
    },
    {
        id: 'i16', file: null, name: '멸치 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '예시',
        ingredients: ['밥', '후리가케', '참기름', '멸치 볶음'],
        steps: ['밥에 후리가케와 참기름을 섞는다.', '삼각틀에 밥과 멸치 볶음을 넣어 성형한다.'],
    },
    {
        id: 'i17', file: null, name: '햄치즈 주먹밥', category: 'onigiri', emoji: '🍙',
        yield: '예시',
        ingredients: ['밥', '후리가케', '참기름', '햄', '치즈', '김가루'],
        steps: ['햄을 잘게 썰어 밥에 섞는다.', '삼각틀에 밥과 치즈를 넣어 성형한다.', '겉면에 김가루를 묻혀 마무리한다.'],
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
