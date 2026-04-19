import { User, Calendar, CheckCircle, X } from 'lucide-react';

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
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Left Column */}
                <div className="space-y-6">
                    {/* 1. Basic Info */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b pb-4">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><User size={24} /></div>
                            <h2 className="text-lg font-bold text-slate-800">기본 인적사항</h2>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">성명</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">직책</label>
                                <input
                                    type="text"
                                    name="role"
                                    value={formData.role || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="예: 대표이사, 주방장, Staff, 아르바이트"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">휴대폰</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">이메일</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">주소</label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="서울시 강남구..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">주민등록번호 (계약용)</label>
                                <input
                                    type="text"
                                    name="resident_number"
                                    value={formData.resident_number || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="000000-0000000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">생년월일</label>
                                <input
                                    type="date"
                                    name="birth_date"
                                    value={formData.birth_date || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Working Conditions & Visa */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b pb-4">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Calendar size={24} /></div>
                            <h2 className="text-lg font-bold text-slate-800">재직 현황 및 체류자격</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">입사일</label>
                                    <input
                                        type="date"
                                        name="start_date"
                                        value={formData.start_date || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">상태</label>
                                    <select
                                        name="status"
                                        value={formData.status || '재직'}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="재직">재직</option>
                                        <option value="휴직">휴직</option>
                                        <option value="퇴사">퇴사</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-bold text-amber-900">외국인 체류자격 (Visa)</label>
                                    <button
                                        onClick={() => setIsVisaGuideOpen(true)}
                                        className="text-[10px] bg-amber-200 text-amber-800 px-2 py-1 rounded font-bold hover:bg-amber-300"
                                    >
                                        자격별 안내 보기
                                    </button>
                                </div>
                                <select
                                    name="visa_type"
                                    value={formData.visa_type || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
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
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Login Account */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 text-sm">로그인 계정</h3>
                            {!user ? (
                                <button
                                    onClick={() => setIsAccountModalOpen(true)}
                                    className="text-xs font-bold text-blue-600 hover:underline"
                                >
                                    계정 생성
                                </button>
                            ) : (
                                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                    <CheckCircle size={12} /> 연동됨
                                </span>
                            )}
                        </div>
                        {user ? (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">아이디</span>
                                    <span className="font-medium text-slate-800">{user.username}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2">
                                    <span className="text-slate-500">등급</span>
                                    <select
                                        value={user.grade === 'normal' ? '정직원' : user.grade === 'vip' ? '아르바이트' : user.grade || '정직원'}
                                        onChange={(e) => handleGradeUpdate(e.target.value)}
                                        className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                                    >
                                        <option value="정직원">정직원</option>
                                        <option value="아르바이트">아르바이트</option>
                                        <option value="admin">관리자</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-slate-400 italic">연동된 계정이 없습니다.</div>
                        )}
                    </div>

                </div>
            </div>

            {/* Account Creation Modal */}
            {isAccountModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-slate-900 mb-6">직원 계정 생성</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">아이디</label>
                                    <input
                                        type="text"
                                        value={accountForm.username}
                                        onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="아이디"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">비밀번호</label>
                                    <input
                                        type="password"
                                        value={accountForm.password}
                                        onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="비밀번호"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">등급</label>
                                    <select
                                        value={accountForm.grade}
                                        onChange={(e) => setAccountForm({ ...accountForm, grade: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="정직원">정직원</option>
                                        <option value="아르바이트">아르바이트</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-2">
                            <button onClick={() => setIsAccountModalOpen(false)} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100">취소</button>
                            <button onClick={handleCreateAccount} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">생성</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Visa Guide Modal */}
            {isVisaGuideOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">체류자격별 외국인 고용 안내</h3>
                            <button onClick={() => setIsVisaGuideOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-2">
                                <h4 className="font-bold text-blue-600">H-2 (방문취업)</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-blue-50 p-3 rounded-xl">특례고용가능확인서 필요. 근로개시일 14일 이내 신고 필수.</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-bold text-purple-600">D-2 (유학) / D-4 (연수)</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-purple-50 p-3 rounded-xl">학교 유학생 담당자 승인 및 출입국 '시간제 취업 허가' 필수. 주당 시간 제한 확인.</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-bold text-emerald-600">F-2, F-4, F-5, F-6</h4>
                                <p className="text-sm text-slate-600 leading-relaxed bg-emerald-50 p-3 rounded-xl">내국인과 동일하게 자유로운 취업 가능 (단, F-4는 단순노무 일부 제한).</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50">
                            <button onClick={() => setIsVisaGuideOpen(false)} className="w-full p-3 bg-slate-200 text-slate-700 rounded-xl font-bold">확인</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
