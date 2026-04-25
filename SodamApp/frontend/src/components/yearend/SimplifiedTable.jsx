const FIELDS = [
  ['insurance_amount', '보장성보험료'],
  ['medical_amount', '의료비'],
  ['education_amount', '교육비'],
  ['donation_amount', '기부금'],
  ['house_loan_principal', '주택자금원리금'],
  ['house_loan_interest', '주택임차차입금이자'],
  ['pension_amount', '연금저축'],
  ['irp_amount', '퇴직연금/IRP'],
  ['credit_card_amount', '신용카드'],
  ['debit_card_amount', '체크카드/현금영수증'],
  ['traditional_market', '전통시장'],
  ['public_transport', '대중교통'],
  ['cultural_amount', '문화비'],
];

export default function SimplifiedTable({ data }) {
  if (!data) return <div className="text-slate-500 text-sm">간소화 자료가 업로드되지 않았습니다.</div>;
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      {FIELDS.map(([key, label]) => (
        <div key={key} className="flex justify-between bg-slate-50 px-3 py-2 rounded">
          <span className="text-slate-600">{label}</span>
          <span className="font-mono font-semibold">{(data[key] || 0).toLocaleString('ko-KR')}원</span>
        </div>
      ))}
    </div>
  );
}
