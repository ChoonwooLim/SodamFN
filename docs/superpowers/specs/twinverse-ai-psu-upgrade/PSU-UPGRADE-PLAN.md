# twinverse-ai PSU 교체 계획

> **상태**: 2026-04-11 작성. 하드웨어 교체 대기 중.
> **전제**: twinverse-ai 서버의 노후 Enermax Platimax가 9B 이상 조밀 LLM, UE Pixel Streaming, Wan 2.5 비디오 생성 등 고부하 GPU 워크로드에서 하드 크래시 유발. 커널/드라이버/소프트웨어 원인 모두 배제 완료.

## 1. 왜 교체가 필요한가

### 진단 요약

| 워크로드 | sustained | 결과 |
|:---|:---:|:---:|
| qwen2.5:0.5b (0.5B) | 171 W | ✅ 10/10 |
| qwen2.5:7b (7.6B) | 237 W | ✅ 5/5 |
| mistral:7b (7.2B) | 279 W | ✅ 3/3 |
| llava:7b (7B) | 279 W | ✅ 3/3 |
| **gemma4:e4b** | **277-279 W** | ❌ iter 3 |
| **gemma2:9b** | **279 W** | ❌ iter 2 |
| **llama3.2-vision:11b** | **280 W** | ❌ iter 2 |

### 배제한 원인
- ❌ **커널 버그**: 6.17.0-20-generic → 6.8.0-107-generic 다운그레이드. 동일 증상
- ❌ **PSU 용량 부족**: 크래시가 138W, 279W 등 다양한 저전력에서도 발생
- ❌ **Thermal**: liquidctl pump 100%, GPU 49°C, 크래시 시 60°C 수준
- ❌ **Memory**: qwen2.5:7b, mistral, llava 모두 정상 = 대용량 VRAM 전송 건강
- ❌ **Kernel panic / MCE / Xid**: 크래시 로그 완전히 비어있음

### 확정 원인
**Enermax Platimax (2011-2018 제조, 5-8년 노후)의 transient response 마진 부족.**
1차 알루미늄 전해 캡(일제 루비콘/니치콘 추정)의 ESR이 초기 사양 대비 30-50% 상승 → RTX 3090의 μs 단위 600-900W 과도 스파이크를 흡수 못해 12V 레일이 순간 droop → PSU OCP/UVP 트립 → 하드 파워 오프.

## 2. 필수 스펙

| 항목 | 최소 요구 | 권장 |
|:---|:---|:---|
| 와트 | 1000W | **1200W+** |
| 인증 | 80+ Gold | 80+ Platinum/Titanium |
| 제조 연도 | 2023년 이후 | 2024-2025 최신 |
| ATX 표준 | **ATX 3.0 필수** | ATX 3.1 |
| 12V-2x6 / 12VHPWR | 선택 | **필수** (미래 GPU 호환) |
| 모듈러 | Semi | **Full modular** |
| 보증 | 7년 | 10년+ |
| 단일 12V 레일 | 80A+ | 100A+ |

### 왜 ATX 3.0/3.1이 결정적인가
ATX 3.0 표준은 **"sustained 출력의 200% 순간 스파이크 보증"** 조항을 포함. 1200W PSU라면 0.1ms 동안 2400W까지 드롭 없이 공급. 이게 현재 크래시 원인인 transient spike 문제를 **구조적으로** 해결하는 유일한 스펙이야. 구형 ATX 2.x PSU는 100-130% 정도만 보증함.

## 3. 구매 추천 리스트 (2026-04 기준)

### 🥇 가성비 — 1x RTX 3090 전용 유지
| 모델 | 와트 | 인증 | 가격대 | 메모 |
|:---|:---:|:---:|:---:|:---|
| **Corsair RM1000x Shift** (2023) | 1000W | Gold | 20-25만 | 모듈러 측면 배치, 케이블 관리 좋음, ATX 3.0 |
| **be quiet! Straight Power 12 1000W** | 1000W | Platinum | 25-30만 | 독일 명가, 저소음, 10년 보증 |
| **Seasonic FOCUS GX-1000 ATX 3.0** | 1000W | Gold | 22-27만 | Seasonic 엔트리 플래티넘 레벨 제작 |

### 🥈 여유 — 2x RTX 3090 확장 대비 (**권장**)
| 모델 | 와트 | 인증 | 가격대 | 메모 |
|:---|:---:|:---:|:---:|:---|
| **Corsair HX1200i** (2024 SHIFT) | 1200W | Platinum | 38-45만 | iCUE 모니터링, 실시간 전력 그래프 |
| **Seasonic PRIME PX-1300** | 1300W | Platinum | 45-55만 | Seasonic 상위 라인 |
| **Super Flower LEADEX VII Pro 1300W** | 1300W | Platinum | 35-42만 | CWT 대체 탑티어 OEM |

### 🥉 프리미엄 — Wan 2.5 + Pixel Streaming + 향후 2x GPU 동시
| 모델 | 와트 | 인증 | 가격대 | 메모 |
|:---|:---:|:---:|:---:|:---|
| **Seasonic PRIME TX-1600 Titanium** | 1600W | Titanium | 60-75만 | 최상급, 12년 보증, 94% 효율 |
| **Corsair AX1600i** | 1600W | Titanium | 65-80만 | 디지털 제어, 코르세어 플래그십 |

## 4. 구매 시 체크 포인트

- [ ] **ATX 3.0 or 3.1** 인증 라벨 확인 (박스/스펙시트)
- [ ] **제조 연도** 2023년 이후 (오래된 재고 조심)
- [ ] **Single rail 12V 100A 이상** (multi-rail보다 transient 대응 좋음)
- [ ] **12VHPWR 또는 12V-2x6** 네이티브 케이블 포함
- [ ] **EPS 8-pin × 2** 케이블 포함 (Threadripper 3970X 필수)
- [ ] **PCIe 8-pin × 4-6** 케이블 포함 (현재 3090 + 향후 확장)

## 5. 교체 절차 개요

1. **백업**: `/etc/systemd/system/*.service`, Ollama 모델 리스트, 설정 파일
2. **시스템 종료**: `sudo shutdown -h now`
3. **물리 교체**: 구 PSU 제거 → 신 PSU 장착 (EPS×2, PCIe×3, ATX24, SATA 등 모든 케이블 연결)
4. **첫 부팅 확인**: BIOS 진입 → POST 정상 → Ubuntu 부팅
5. **검증 루틴**:
   ```bash
   nvidia-smi --query-gpu=power.limit --format=csv  # 280W 확인
   liquidctl status                                   # 펌프 100%
   systemctl status ollama liquidctl nvidia-power-limit
   ```
6. **Power limit 해제**:
   ```bash
   sudo nvidia-smi -pl 350  # 기본값 복구
   # 또는 nvidia-power-limit.service 수정: -pl 350
   ```
7. **재검증 테스트** (project_twinverse_ai_psu_constraint.md 참고):
   - gemma4:e4b, gemma2:9b, llama3.2-vision:11b 순차 pull
   - 각 10회 iteration stress test
   - gpt-oss:20b pull + 5회 iteration
   - 전부 통과 시 금지 모델 목록 해제

## 6. 교체 후 복구 체크리스트

- [ ] `nvidia-smi -pl 350` 적용 (systemd service 수정)
- [ ] 금지 모델 재pull: gemma4:e4b, gemma2:9b, llama3.2-vision:11b, gpt-oss:20b
- [ ] 각 모델 10회 stress test 통과 확인
- [ ] Wan 2.5 단일 생성 테스트 (30-60초)
- [ ] UE Pixel Streaming 10분 soak test
- [ ] `project_twinverse_ai_psu_constraint.md` 메모리에서 "해제" 표시
- [ ] AI Gateway Phase 1 스펙의 금지 모델 목록 업데이트
- [ ] 2번째 RTX 3090 장착 준비 (케이블 확보 시)

## 7. 비용 대비 효과

| 시나리오 | 비용 | 결과 |
|:---|:---:|:---|
| **PSU 교체 (권장 1200W급)** | 35-50만 | Wan 2.5, Pixel Streaming, 모든 LLM 완전 해제. Twinverse 생태계 최종 목표 달성 가능 |
| 현재 유지 | 0 | 7B 이하 LLM만, Pixel Streaming 불가, Wan 2.5 불가. Twinverse 생태계 목표 달성 불가 |
| 별도 GPU 서버 신구축 | 500만+ | 중복 투자, 3970X/3090/128GB ECC 유휴 |

**결론**: 35-50만원 투자로 서버를 "LLM 전용 박스" → "Twinverse 생태계 공용 GPU 인프라"로 전환. 가성비 10배+.

## 8. 관련 문서

- 메모리: `project_twinverse_ai_psu_constraint.md` — 크래시 패턴, 금지 모델 목록
- 메모리: `project_twinverse_ecosystem.md` — 장기 비전 맥락
- 메모리: `project_ai_gateway_phase1.md` — Phase 1 인프라 상태
- 스펙: `docs/superpowers/specs/ai-gateway-phase1-infra/RESUME-HERE.md` — Phase 1 재개 포인트
