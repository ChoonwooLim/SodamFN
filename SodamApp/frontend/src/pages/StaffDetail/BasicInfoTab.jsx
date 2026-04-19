import { User, Calendar, CheckCircle, Shield, Globe, X } from 'lucide-react';

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

            {/* ═══ Visa Guide Modal ═══ */}
            {isVisaGuideOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center">
                                    <Globe size={14} className="text-white" />
                                </div>
                                <h3 className="text-base font-bold text-slate-800">체류자격별 외국인 고용 안내</h3>
                            </div>
                            <button onClick={() => setIsVisaGuideOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                            {[
                                { code: 'H-2 (방문취업)', color: 'from-teal-500 to-teal-700', bg: 'bg-teal-50', text: 'text-teal-800', desc: '특례고용가능확인서 필요. 근로개시일 14일 이내 신고 필수.' },
                                { code: 'E-9 (비전문취업)', color: 'from-cyan-500 to-cyan-700', bg: 'bg-cyan-50', text: 'text-cyan-800', desc: '고용허가서 필요. 사업장 변경 시 고용센터 신고 필수.' },
                                { code: 'D-2 (유학) / D-4 (연수)', color: 'from-blue-500 to-blue-700', bg: 'bg-blue-50', text: 'text-blue-800', desc: '학교 유학생 담당자 승인 및 출입국 시간제 취업 허가 필수. 주당 시간 제한 확인.' },
                                { code: 'F-2, F-4, F-5, F-6', color: 'from-indigo-500 to-indigo-700', bg: 'bg-indigo-50', text: 'text-indigo-800', desc: '내국인과 동일하게 자유로운 취업 가능 (단, F-4는 단순노무 일부 제한).' },
                            ].map((item, i) => (
                                <div key={i} className={`${item.bg} p-4 rounded-xl`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${item.color}`}></div>
                                        <h4 className={`font-bold text-sm ${item.text}`}>{item.code}</h4>
                                    </div>
                                    <p className={`text-xs ${item.text} opacity-80 leading-relaxed`}>{item.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <button onClick={() => setIsVisaGuideOpen(false)} className="w-full p-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">확인</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
