import { User, Calendar, CheckCircle, Shield, Globe, X, Phone, Building2, AlertTriangle, Clock, FileCheck, Info } from 'lucide-react';

export default function BasicInfoTab({
    formData,
    handleChange,
    user,
    isAccountModalOpen,
    setIsAccountModalOpen,
    accountForm,
    setAccountForm,
    handleCreateAccount,
    handleGradeUpdate,
    isVisaGuideOpen,
    setIsVisaGuideOpen,
}) {
    const inputClass = "w-full p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300";
    const labelClass = "block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide";

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
                {/* ═══ Left Column (3/5) — 기본 인적사항 ═══ */}
                <div className="md:col-span-3">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
                                <User size={18} className="text-white" />
                            </div>
                            <h2 className="text-base font-bold text-slate-800">기본 인적사항</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>성명</label>
                                    <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>직책</label>
                                    <input type="text" name="role" value={formData.role || ''} onChange={handleChange} className={inputClass} placeholder="대표이사, 주방장, Staff..." />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>휴대폰</label>
                                    <input type="text" name="phone" value={formData.phone || ''} onChange={handleChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>이메일</label>
                                    <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>주소</label>
                                <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className={inputClass} placeholder="서울시 강남구..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>주민등록번호 (계약용)</label>
                                    <input type="text" name="resident_number" value={formData.resident_number || ''} onChange={handleChange} className={inputClass} placeholder="000000-0000000" />
                                </div>
                                <div>
                                    <label className={labelClass}>생년월일</label>
                                    <input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ Right Column (2/5) — 로그인 계정 + 재직현황 + 체류자격 ═══ */}
                <div className="md:col-span-2 space-y-5">
                    {/* 로그인 계정 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-md">
                                    <Shield size={14} className="text-white" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800">로그인 계정</h3>
                            </div>
                            {!user ? (
                                <button onClick={() => setIsAccountModalOpen(true)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                                    + 계정 생성
                                </button>
                            ) : (
                                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                    <CheckCircle size={12} /> 연동됨
                                </span>
                            )}
                        </div>
                        {user ? (
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center text-sm bg-slate-50 px-3 py-2.5 rounded-xl">
                                    <span className="text-slate-500 text-xs font-medium">아이디</span>
                                    <span className="font-bold text-slate-800">{user.username}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm bg-slate-50 px-3 py-2.5 rounded-xl">
                                    <span className="text-slate-500 text-xs font-medium">등급</span>
                                    <select
                                        value={user.grade === 'normal' ? '정직원' : user.grade === 'vip' ? '아르바이트' : user.grade || '정직원'}
                                        onChange={(e) => handleGradeUpdate(e.target.value)}
                                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                                    >
                                        <option value="정직원">정직원</option>
                                        <option value="아르바이트">아르바이트</option>
                                        <option value="admin">관리자</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-xs text-slate-400">연동된 계정이 없습니다.</div>
                        )}
                    </div>

                    {/* 재직 현황 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-md shadow-teal-200">
                                <Calendar size={14} className="text-white" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">재직 현황</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>입사일</label>
                                    <input type="date" name="start_date" value={formData.start_date || ''} onChange={handleChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>상태</label>
                                    <select name="status" value={formData.status || '재직'} onChange={handleChange} className={inputClass}>
                                        <option value="재직">재직</option>
                                        <option value="휴직">휴직</option>
                                        <option value="퇴사">퇴사</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 외국인 체류자격 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center shadow-md shadow-cyan-200">
                                    <Globe size={14} className="text-white" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800">외국인 체류자격</h3>
                            </div>
                            <button
                                onClick={() => setIsVisaGuideOpen(true)}
                                className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1.5 rounded-lg hover:bg-cyan-100 transition-colors"
                            >
                                자격별 안내
                            </button>
                        </div>
                        <select
                            name="visa_type"
                            value={formData.visa_type || ''}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option value="">선택 안함 (내국인 등)</option>
                            <option value="H-2">H-2 (방문취업)</option>
                            <option value="E-9">E-9 (비전문취업)</option>
                            <option value="F-2">F-2 (거주)</option>
                            <option value="F-4">F-4 (재외동포)</option>
                            <option value="F-5">F-5 (영주)</option>
                            <option value="F-6">F-6 (결혼이민)</option>
                            <option value="D-2">D-2 (유학 - 시간제 취업)</option>
                            <option value="D-4">D-4 (어학연수)</option>
                        </select>
                        {formData.visa_type && (
                            <div className="mt-3 text-[11px] text-cyan-700 bg-cyan-50/60 px-3 py-2 rounded-lg font-medium">
                                {formData.visa_type === 'H-2' && '특례고용가능확인서 필요. 근로개시 14일 이내 신고.'}
                                {(formData.visa_type === 'D-2' || formData.visa_type === 'D-4') && '학교 승인 및 시간제 취업 허가 필수. 주당 시간 제한 확인.'}
                                {(formData.visa_type === 'E-9') && '고용허가서 필요. 사업장 변경 시 신고 필수.'}
                                {['F-2','F-4','F-5','F-6'].includes(formData.visa_type) && '내국인과 동일하게 자유로운 취업 가능.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Account Creation Modal ═══ */}
            {isAccountModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-900">직원 계정 생성</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={labelClass}>아이디</label>
                                <input type="text" value={accountForm.username} onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })} className={inputClass} placeholder="아이디" />
                            </div>
                            <div>
                                <label className={labelClass}>비밀번호</label>
                                <input type="password" value={accountForm.password} onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })} className={inputClass} placeholder="비밀번호" />
                            </div>
                            <div>
                                <label className={labelClass}>등급</label>
                                <select value={accountForm.grade} onChange={(e) => setAccountForm({ ...accountForm, grade: e.target.value })} className={inputClass}>
                                    <option value="정직원">정직원</option>
                                    <option value="아르바이트">아르바이트</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-2 border-t border-slate-100">
                            <button onClick={() => setIsAccountModalOpen(false)} className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">취소</button>
                            <button onClick={handleCreateAccount} className="flex-1 p-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md transition-colors">생성</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Visa Guide Modal (상세) ═══ */}
            {isVisaGuideOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-cyan-50 to-blue-50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center shadow-md shadow-cyan-200">
                                    <Globe size={16} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">체류자격별 외국인 고용 안내</h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">외국인 근로자 고용 시 필수 확인사항</p>
                                </div>
                            </div>
                            <button onClick={() => setIsVisaGuideOpen(false)} className="p-1.5 hover:bg-white/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

                            {/* ── H-2 방문취업 ── */}
                            <div className="bg-teal-50 rounded-xl overflow-hidden border border-teal-100">
                                <div className="px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-700 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><FileCheck size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">H-2 (방문취업)</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-teal-700 mb-1 flex items-center gap-1"><Info size={11} /> 대상자</p>
                                        <p className="text-xs text-teal-800 leading-relaxed">중국·CIS 등 외국국적동포 (만 25세 이상). 한국어능력시험(TOPIK) 또는 사회통합프로그램 이수자 우대.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-teal-700 mb-1 flex items-center gap-1"><Building2 size={11} /> 취업 가능 업종</p>
                                        <p className="text-xs text-teal-800 leading-relaxed">건설업, 서비스업, 제조업, 농축산업, 어업 등 허용 업종에서 자유롭게 취업 가능. 단, <span className="font-bold">특례고용가능확인서</span> 발급 후 취업 가능.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-teal-700 mb-1 flex items-center gap-1"><FileCheck size={11} /> 필요 서류</p>
                                        <ul className="text-xs text-teal-800 space-y-0.5 ml-3 list-disc">
                                            <li>특례고용가능확인서 (고용센터 발급)</li>
                                            <li>외국인등록증 사본</li>
                                            <li>근로계약서 (2부 작성)</li>
                                            <li>여권 사본</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-teal-700 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> 주의사항</p>
                                        <ul className="text-xs text-teal-800 space-y-0.5 ml-3 list-disc">
                                            <li><span className="font-bold">근로개시 신고</span>: 근로 시작일로부터 <span className="font-bold text-red-600">14일 이내</span> 고용센터 신고 필수</li>
                                            <li>체류기간: 최대 3년 (재입국 후 재취업 가능)</li>
                                            <li>사업장 변경 시 고용센터에 변경 신고</li>
                                            <li>4대 보험 가입 의무 (국민연금·건강보험·고용보험·산재보험)</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* ── E-9 비전문취업 ── */}
                            <div className="bg-cyan-50 rounded-xl overflow-hidden border border-cyan-100">
                                <div className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><FileCheck size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">E-9 (비전문취업)</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-cyan-700 mb-1 flex items-center gap-1"><Info size={11} /> 대상자</p>
                                        <p className="text-xs text-cyan-800 leading-relaxed">고용허가제(EPS)를 통해 입국한 비전문 외국인 근로자. 16개 송출국가 대상.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-cyan-700 mb-1 flex items-center gap-1"><Building2 size={11} /> 취업 가능 업종</p>
                                        <p className="text-xs text-cyan-800 leading-relaxed">제조업, 건설업, 농축산업, 어업, 서비스업 (음식점업 포함). <span className="font-bold">고용허가서에 명시된 사업장에서만</span> 취업 가능.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-cyan-700 mb-1 flex items-center gap-1"><FileCheck size={11} /> 필요 서류</p>
                                        <ul className="text-xs text-cyan-800 space-y-0.5 ml-3 list-disc">
                                            <li>고용허가서 (고용센터 발급, 사업주 신청)</li>
                                            <li>표준근로계약서 (한국산업인력공단 서식)</li>
                                            <li>외국인등록증 사본</li>
                                            <li>출국만기보험·귀국비용보험 가입 증명</li>
                                            <li>상해보험 가입증명서</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-cyan-700 mb-1 flex items-center gap-1"><Clock size={11} /> 체류기간</p>
                                        <p className="text-xs text-cyan-800 leading-relaxed">최초 3년 → 성실근로자 재고용 시 1년 10개월 연장 가능 (최대 4년 10개월).</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-cyan-700 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> 주의사항</p>
                                        <ul className="text-xs text-cyan-800 space-y-0.5 ml-3 list-disc">
                                            <li><span className="font-bold text-red-600">사업장 변경 제한</span>: 최대 3회 (사유 발생 시 1개월 이내 신청)</li>
                                            <li>사업장 변경 사유: 휴·폐업, 근로조건 위반, 부당처우 등</li>
                                            <li>출국만기보험: 월 급여의 8.3% 적립 (사업주 부담)</li>
                                            <li>4대 보험 전부 가입 필수</li>
                                            <li>임금체불 시 고용노동부 신고 가능 (1350)</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* ── D-2 유학 / D-4 어학연수 ── */}
                            <div className="bg-blue-50 rounded-xl overflow-hidden border border-blue-100">
                                <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><Clock size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">D-2 (유학) / D-4 (어학연수) — 시간제 취업</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-blue-700 mb-1 flex items-center gap-1"><Info size={11} /> 대상자</p>
                                        <p className="text-xs text-blue-800 leading-relaxed">국내 대학(원) 재학 유학생(D-2) 또는 어학연수생(D-4). 시간제 취업허가를 받은 경우에만 아르바이트 가능.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-blue-700 mb-1 flex items-center gap-1"><Clock size={11} /> 근로시간 제한</p>
                                        <div className="bg-white/60 rounded-lg p-3 mt-1">
                                            <table className="w-full text-xs text-blue-800">
                                                <thead>
                                                    <tr className="border-b border-blue-200">
                                                        <th className="text-left pb-1.5 font-bold">구분</th>
                                                        <th className="text-left pb-1.5 font-bold">학기 중</th>
                                                        <th className="text-left pb-1.5 font-bold">방학 중</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-blue-100">
                                                    <tr><td className="py-1.5">D-2 석·박사</td><td className="py-1.5">주 30시간</td><td className="py-1.5 font-bold text-blue-600">무제한</td></tr>
                                                    <tr><td className="py-1.5">D-2 학부</td><td className="py-1.5">주 25시간</td><td className="py-1.5 font-bold text-blue-600">무제한</td></tr>
                                                    <tr><td className="py-1.5">D-4 어학연수</td><td className="py-1.5">주 20시간</td><td className="py-1.5 font-bold text-blue-600">무제한</td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-blue-700 mb-1 flex items-center gap-1"><FileCheck size={11} /> 필요 서류</p>
                                        <ul className="text-xs text-blue-800 space-y-0.5 ml-3 list-disc">
                                            <li>시간제 취업허가서 (출입국관리사무소 발급)</li>
                                            <li>재학증명서 및 성적증명서</li>
                                            <li>학교 유학생 담당자 확인서 (학교장 추천서)</li>
                                            <li>근로계약서</li>
                                            <li>여권 및 외국인등록증 사본</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-blue-700 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> 주의사항</p>
                                        <ul className="text-xs text-blue-800 space-y-0.5 ml-3 list-disc">
                                            <li><span className="font-bold text-red-600">허가 없이 취업 시 강제퇴거 사유</span></li>
                                            <li>유흥업소, 사행시설 등 취업 금지 업종 확인</li>
                                            <li>TOPIK 2급 이상 소지 시 허가 우대</li>
                                            <li>산재보험 의무가입, 건강보험 지역가입</li>
                                            <li>사업주도 허가 없이 고용 시 <span className="font-bold">과태료 부과</span></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* ── F-2 거주 ── */}
                            <div className="bg-violet-50 rounded-xl overflow-hidden border border-violet-100">
                                <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-violet-700 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><Shield size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">F-2 (거주)</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-violet-700 mb-1 flex items-center gap-1"><Info size={11} /> 대상자</p>
                                        <p className="text-xs text-violet-800 leading-relaxed">점수제(F-2-7) 거주자격 취득자, 영주자격 예비 단계. 국민의 미성년 자녀, 영주권자 배우자 등 포함.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-violet-700 mb-1 flex items-center gap-1"><Building2 size={11} /> 취업 범위</p>
                                        <p className="text-xs text-violet-800 leading-relaxed"><span className="font-bold text-violet-600">내국인과 동일하게 자유롭게 취업 가능.</span> 업종·사업장 제한 없음. 별도 취업허가 불요.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-violet-700 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> 주의사항</p>
                                        <ul className="text-xs text-violet-800 space-y-0.5 ml-3 list-disc">
                                            <li>체류기간 연장 시 소득·납세 증빙 필요</li>
                                            <li>4대 보험 내국인과 동일하게 가입</li>
                                            <li>범죄경력·체류기간 준수 등 자격 유지 요건 확인</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* ── F-4 재외동포 ── */}
                            <div className="bg-indigo-50 rounded-xl overflow-hidden border border-indigo-100">
                                <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><Globe size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">F-4 (재외동포)</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-indigo-700 mb-1 flex items-center gap-1"><Info size={11} /> 대상자</p>
                                        <p className="text-xs text-indigo-800 leading-relaxed">대한민국 국적을 보유했던 자 (또는 그 직계비속)로서 외국국적을 취득한 재외동포.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-indigo-700 mb-1 flex items-center gap-1"><Building2 size={11} /> 취업 범위</p>
                                        <p className="text-xs text-indigo-800 leading-relaxed">대부분 업종 자유 취업 가능. <span className="font-bold text-red-600">단, 단순노무 일부 제한</span> (건설 단순노무, 가사도우미 등은 별도 허가 필요).</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-indigo-700 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> 주의사항</p>
                                        <ul className="text-xs text-indigo-800 space-y-0.5 ml-3 list-disc">
                                            <li>체류기간: 2년 (무제한 연장 가능)</li>
                                            <li>취업활동 신고: 근로 시작 후 <span className="font-bold">14일 이내</span> 출입국관리사무소 신고</li>
                                            <li>단순노무 취업 시 별도 <span className="font-bold">체류자격외활동허가</span> 필요</li>
                                            <li>건강보험 당연적용 (입국 6개월 후)</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* ── F-5 영주 ── */}
                            <div className="bg-emerald-50 rounded-xl overflow-hidden border border-emerald-100">
                                <div className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><Shield size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">F-5 (영주)</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1"><Info size={11} /> 대상자</p>
                                        <p className="text-xs text-emerald-800 leading-relaxed">5년 이상 합법 체류 + 생계유지 능력 + 품행 단정 등 영주 요건 충족자. 대한민국에 특별한 공로가 있는 자 포함.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1"><Building2 size={11} /> 취업 범위</p>
                                        <p className="text-xs text-emerald-800 leading-relaxed"><span className="font-bold text-emerald-600">내국인과 완전히 동일. 모든 업종 자유 취업. 별도 허가 불요.</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> 주의사항</p>
                                        <ul className="text-xs text-emerald-800 space-y-0.5 ml-3 list-disc">
                                            <li>체류기간 제한 없음 (영주권)</li>
                                            <li>단, 출국 후 <span className="font-bold">2년 이상 미입국 시 영주자격 취소</span> 가능</li>
                                            <li>재입국허가 기간 내 입국 필수</li>
                                            <li>4대 보험 내국인과 동일</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* ── F-6 결혼이민 ── */}
                            <div className="bg-pink-50 rounded-xl overflow-hidden border border-pink-100">
                                <div className="px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><User size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">F-6 (결혼이민)</h4>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div>
                                        <p className="text-[11px] font-bold text-pink-700 mb-1 flex items-center gap-1"><Info size={11} /> 대상자</p>
                                        <p className="text-xs text-pink-800 leading-relaxed">대한민국 국민과 혼인관계에 있는 외국인. 혼인 파탄 시에도 귀책사유 없으면 체류 가능.</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-pink-700 mb-1 flex items-center gap-1"><Building2 size={11} /> 취업 범위</p>
                                        <p className="text-xs text-pink-800 leading-relaxed"><span className="font-bold text-pink-600">내국인과 동일하게 자유 취업 가능. 업종·시간 제한 없음.</span></p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-pink-700 mb-1 flex items-center gap-1"><AlertTriangle size={11} /> 주의사항</p>
                                        <ul className="text-xs text-pink-800 space-y-0.5 ml-3 list-disc">
                                            <li>4대 보험 내국인과 동일 적용</li>
                                            <li>한국어·사회통합프로그램(KIIP) 이수 시 영주권 신청 유리</li>
                                            <li>귀화 신청 시 체류기간 산입</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* ═══════ 관계기관 연락처 ═══════ */}
                            <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 mt-6">
                                <div className="px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center"><Phone size={13} className="text-white" /></div>
                                    <h4 className="font-bold text-sm text-white">관계기관 연락처</h4>
                                </div>
                                <div className="p-4 space-y-4">
                                    {/* 정부·공공기관 */}
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1 uppercase tracking-wider"><Building2 size={11} /> 정부·공공기관</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {[
                                                { name: '외국인종합안내센터 (출입국)', tel: '1345', desc: '체류자격·비자·신고 등 전반 상담 (다국어)' },
                                                { name: '고용노동부 고객상담센터', tel: '1350', desc: '임금체불·부당해고·근로기준 상담' },
                                                { name: '외국인력지원센터', tel: '1577-0071', desc: '외국인 근로자 고충상담·생활지원' },
                                                { name: '대한법률구조공단', tel: '132', desc: '무료 법률상담·소송지원 (외국인 포함)' },
                                                { name: '한국산업인력공단 (HRDKorea)', tel: '1644-8000', desc: 'EPS 고용허가제·한국어시험 관련' },
                                                { name: '사회통합정보망 (SOCINET)', tel: '1345 → 4번', desc: '사회통합프로그램(KIIP) 등록·문의' },
                                            ].map((item, i) => (
                                                <div key={i} className="bg-white rounded-lg p-3 border border-slate-100 hover:border-slate-300 transition-colors">
                                                    <div className="flex items-start justify-between">
                                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.name}</p>
                                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md whitespace-nowrap ml-2">{item.tel}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4대 보험 기관 */}
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1 uppercase tracking-wider"><Shield size={11} /> 4대 보험 기관</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {[
                                                { name: '국민연금공단', tel: '1355', desc: '외국인 국민연금 가입·반환일시금 상담' },
                                                { name: '국민건강보험공단', tel: '1577-1000', desc: '직장가입자 등록·보험료·자격 관련' },
                                                { name: '근로복지공단 (산재보험)', tel: '1588-0075', desc: '산재보험 가입·산업재해 신고·보상' },
                                                { name: '고용보험 (고용센터)', tel: '1350', desc: '고용보험 가입확인·실업급여 문의' },
                                            ].map((item, i) => (
                                                <div key={i} className="bg-white rounded-lg p-3 border border-slate-100 hover:border-slate-300 transition-colors">
                                                    <div className="flex items-start justify-between">
                                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.name}</p>
                                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap ml-2">{item.tel}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 외국인 전용 보험 */}
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1 uppercase tracking-wider"><FileCheck size={11} /> 외국인 근로자 전용 보험</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {[
                                                { name: '출국만기보험 (삼성화재)', tel: '1588-5114', desc: 'E-9 출국만기보험 가입·청구 (사업주 가입)' },
                                                { name: '귀국비용보험 (삼성화재)', tel: '1588-5114', desc: 'E-9 귀국비용보험 가입·청구 (근로자 가입)' },
                                                { name: '상해보험 (DB손해보험)', tel: '1588-0100', desc: 'E-9·H-2 상해보험 가입 (입국 후 즉시)' },
                                                { name: '보증보험 (서울보증보험)', tel: '1670-7000', desc: '체불 임금 보증보험 관련 문의' },
                                            ].map((item, i) => (
                                                <div key={i} className="bg-white rounded-lg p-3 border border-slate-100 hover:border-slate-300 transition-colors">
                                                    <div className="flex items-start justify-between">
                                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.name}</p>
                                                        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md whitespace-nowrap ml-2">{item.tel}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 안내 참고사항 */}
                                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                        <p className="text-[10px] text-amber-700 leading-relaxed flex items-start gap-1.5">
                                            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                                            <span>위 전화번호는 변경될 수 있습니다. 외국인 근로자 관련 민원은 <span className="font-bold">1345 (외국인종합안내센터)</span>에서 20개 국어로 상담 가능합니다. 운영시간: 평일 09:00~22:00, 주말·공휴일 09:00~18:00.</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <button onClick={() => setIsVisaGuideOpen(false)} className="w-full p-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-cyan-700 hover:to-blue-700 shadow-md transition-all">확인</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
