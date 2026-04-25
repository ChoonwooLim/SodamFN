/**
 * 영업관리 업종 레지스트리.
 * V1: 휴게음식점(소담김밥) 1 종.
 * V2: cafe.js, chicken.js 등 추가.
 */
import kimbap from './kimbap';

export const SALES_GUIDE_INDUSTRIES = {
  kimbap,
};

export function getIndustryData(industryKey = 'kimbap') {
  return SALES_GUIDE_INDUSTRIES[industryKey] || SALES_GUIDE_INDUSTRIES.kimbap;
}

export function getAllItems(industryKey = 'kimbap') {
  const data = getIndustryData(industryKey);
  return data.categories.flatMap((cat) => cat.items.map((item) => ({ ...item, _category: cat.key })));
}

export function getCategoryByKey(categoryKey, industryKey = 'kimbap') {
  return getIndustryData(industryKey).categories.find((c) => c.key === categoryKey);
}

export function getItemByKey(itemKey, industryKey = 'kimbap') {
  return getAllItems(industryKey).find((i) => i.key === itemKey);
}
