import re

f_path = r'C:\WORK\SodamFN\SodamApp\frontend\src\pages\RevenueManagement.jsx'

with open(f_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. State variable
if 'const [classifyData, setClassifyData] = useState(null);' not in text:
    target = "    const [uploadProgress, setUploadProgress] = useState('');\n    const fileInputRef = useRef(null);\n    const excelInputRef = useRef(null);"
    replace = "    const [uploadProgress, setUploadProgress] = useState('');\n    const fileInputRef = useRef(null);\n    const excelInputRef = useRef(null);\n    const [classifyData, setClassifyData] = useState(null);"
    text = text.replace(target, replace)

# 2. Add classification popup checking logic
target = "                    } else if (response.data.status === 'success') {"
replace = """                    } else if (response.data.status === 'requires_classification') {
                        setClassifyData({
                            file: file,
                            items: response.data.items,
                            message: response.data.message
                        });
                        setUploadLoading(false);
                        if (excelInputRef.current) excelInputRef.current.value = '';
                        return; // Stop processing further files until classified
                    } else if (response.data.status === 'success') {"""
if "requires_classification" not in text:
    text = text.replace(target, replace)

# 3. Add handleClassifySubmit function
target_submit = "    const handleGridCellClick = (vendorId, day, amount, expenseId) => {"
replace_submit = """    const handleClassifySubmit = async (mappings) => {
        if (!classifyData) return;
        setUploadLoading(true);
        const { file } = classifyData;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('classifications', JSON.stringify(mappings));
        
        try {
            const response = await api.post('/upload/excel/revenue', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.status === 'success') {
                const d = response.data;
                let fileMsg = `✅ ${file.name}`;
                if (d.file_type_label) fileMsg += ` (${d.file_type_label})`;
                fileMsg += `: ${d.message || (d.count + '건 저장')}`;
                alert(fileMsg);
            } else {
                alert(`❌ ${file.name}: ${response.data.message}`);
            }
            fetchData();
        } catch (error) {
            console.error('Classification upload error:', error);
            alert('업로드 중 오류가 발생했습니다.');
        } finally {
            setUploadLoading(false);
            setClassifyData(null);
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

    const handleGridCellClick = (vendorId, day, amount, expenseId) => {"""
if "handleClassifySubmit" not in text:
    text = text.replace(target_submit, replace_submit)

# 4. Add Modal UI Render block near the end of the return statement
target_modal = "            {/* ═══════════════════════════════════════════ */}\n            {/* UPLOAD VIEW — Image / Excel Upload */}"
replace_modal = """            {/* Classification Modal */}
            {classifyData && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '600px', width: '95%'}}>
                        <h2>🔍 은행 입금내역 자동 분류</h2>
                        <p style={{fontSize: 13, color: '#94a3b8', marginBottom: 20}}>{classifyData.message}</p>
                        
                        <div style={{maxHeight:'400px', overflowY:'auto', background:'rgba(0,0,0,0.2)', padding:10, borderRadius:8, marginBottom:20}}>
                            {classifyData.items.map((item, idx) => {
                                const handleSelect = (val) => {
                                    const newItems = [...classifyData.items];
                                    newItems[idx].selected_category = val;
                                    setClassifyData({...classifyData, items: newItems});
                                };
                                return (
                                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                                        <div style={{display:'flex', flexDirection:'column'}}>
                                            <span style={{fontSize: 14, fontWeight: 'bold'}}>{item.memo}</span>
                                            <span style={{fontSize: 12, color: '#94a3b8'}}>{item.date} | {formatNumber(item.amount)}원</span>
                                        </div>
                                        <select 
                                            value={item.selected_category || item.default_category || ''} 
                                            onChange={e => handleSelect(e.target.value)}
                                            style={{padding: '6px 10px', borderRadius: 6, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color:'white'}}
                                        >
                                            <option value="">카테고리 선택...</option>
                                            <option value="카드수수료">💳 카드수수료 정산</option>
                                            <option value="현금매출">💵 현금매출</option>
                                            <option value="개인가계부">🏠 개인가계부(개인송금)</option>
                                            <option value="무시">🚫 등록 안 함 (무시)</option>
                                        </select>
                                    </div>
                                )
                            })}
                        </div>
                        
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setClassifyData(null)}>취소</button>
                            <button className="btn-save" onClick={() => {
                                const mappings = classifyData.items.map(i => ({
                                    memo: i.memo,
                                    category: i.selected_category || i.default_category
                                })).filter(i => i.category && i.category !== '');
                                handleClassifySubmit(mappings);
                            }}>
                                분류 저장 및 업로드 계속
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* UPLOAD VIEW — Image / Excel Upload */}"""
if "Bank Deposit Classification" not in text and "은행 입금내역 자동 분류" not in text:
    text = text.replace(target_modal, replace_modal)

with open(f_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("success")
