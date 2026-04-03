import { useState, useRef } from 'react';
import api from '../../api';

export function useUploadHandler({ fetchData }) {
    const [uploadTab, setUploadTab] = useState('excel');
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [classifyData, setClassifyData] = useState(null);
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);

    const handleUploadFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadLoading(true);

        if (uploadTab === 'camera') {
            const file = files[0];
            const formData = new FormData();
            formData.append('file', file);
            try {
                await new Promise(r => setTimeout(r, 800));
                const response = await api.post('/upload/image/revenue', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (response.data.status === 'success') {
                    alert('이미지가 성공적으로 분석되었습니다.');
                    fetchData();
                } else {
                    alert('처리 실패: ' + response.data.message);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('업로드 중 오류가 발생했습니다.');
            } finally {
                setUploadLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
            return;
        }

        // Excel upload — multiple files
        let totalCount = 0;
        let successCount = 0;
        let errorFiles = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress(`(${i + 1}/${files.length}) ${file.name} 처리 중...`);
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const response = await api.post('/upload/excel/revenue', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (response.data.status === 'password_required') {
                        const pwd = prompt(`🔒 ${file.name}\n\n${response.data.message}`);
                        if (pwd) {
                            const retryFormData = new FormData();
                            retryFormData.append('file', file);
                            retryFormData.append('password', pwd);
                            const retryResponse = await api.post('/upload/excel/revenue', retryFormData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            if (retryResponse.data.status === 'password_required') {
                                errorFiles.push(`🔒 ${file.name}: 비밀번호가 맞지 않습니다.`);
                            } else if (retryResponse.data.status === 'success') {
                                totalCount += retryResponse.data.count || 0;
                                successCount++;
                                const d = retryResponse.data;
                                let fileMsg = `✅ ${file.name}`;
                                if (d.file_type_label) fileMsg += ` (${d.file_type_label})`;
                                fileMsg += `: ${d.count || 0}건 저장`;
                                errorFiles.push(fileMsg);
                            } else {
                                errorFiles.push(`❌ ${file.name}: ${retryResponse.data.message}`);
                            }
                        } else {
                            errorFiles.push(`⏭️ ${file.name}: 비밀번호 입력 취소`);
                        }
                    } else if (response.data.status === 'requires_classification') {
                        setClassifyData({
                            file: file,
                            items: response.data.items,
                            message: response.data.message
                        });
                        setUploadLoading(false);
                        if (excelInputRef.current) excelInputRef.current.value = '';
                        return;
                    } else if (response.data.status === 'success') {
                        totalCount += response.data.count || 0;
                        successCount++;
                        const d = response.data;
                        let fileMsg = `✅ ${file.name}`;
                        if (d.file_type_label) fileMsg += ` (${d.file_type_label})`;
                        fileMsg += `: ${d.count || 0}건 저장`;
                        if (d.skipped) fileMsg += `, ${d.skipped}건 중복 스킵`;
                        if (d.dedup_skipped) fileMsg += `, ${d.dedup_skipped}건 카드중복 자동제외`;
                        if (d.dedup_replaced) fileMsg += `, ${d.dedup_replaced}건 통합→상세 대체`;
                        errorFiles.push(fileMsg);
                    } else {
                        errorFiles.push(`❌ ${file.name}: ${response.data.message}`);
                    }
                } catch (error) {
                    console.error(`Upload error for ${file.name}:`, error);
                    errorFiles.push(`❌ ${file.name}: 업로드 실패`);
                }
            }
            let message = `📊 ${successCount}개 파일 처리 완료, 총 ${totalCount}건 저장됨\n\n${errorFiles.join('\n')}`;
            alert(message);
            fetchData();
        } catch (error) {
            console.error('Upload error:', error);
            alert('업로드 중 오류가 발생했습니다.');
        } finally {
            setUploadLoading(false);
            setUploadProgress('');
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

    return {
        uploadTab, setUploadTab,
        uploadLoading, setUploadLoading,
        uploadProgress, setUploadProgress,
        classifyData, setClassifyData,
        fileInputRef, excelInputRef,
        handleUploadFileChange,
    };
}
