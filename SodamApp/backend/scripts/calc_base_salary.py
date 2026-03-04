"""
Reverse-engineer 보수월액 from tax accountant's deduction figures.
Uses 고용보험 (EI, 0.9%) as primary source, cross-checks with others.
"""

employees = [
    {"name": "김금순", "code": 12, "gross": 3400000,
     "np": 142500, "hi": 107850, "ei": 0, "lti": 14170,
     "note": "EI missing (정규직?)"},
    {"name": "허윤희", "code": 13, "gross": 1680000,
     "np": 71250, "hi": 53920, "ei": 13500, "lti": 7080,
     "note": ""},
    {"name": "정명주", "code": 14, "gross": 1481040,
     "np": 13300, "hi": 50330, "ei": 2520, "lti": 6610,
     "note": "NP very low"},
    {"name": "정수현", "code": 15, "gross": 1742400,
     "np": 17740, "hi": 67140, "ei": 3370, "lti": 8820,
     "note": "NP very low"},
    {"name": "설주리", "code": 16, "gross": 1814399,
     "np": 245760, "hi": 186000, "ei": 46560, "lti": 24440,
     "note": ""},
    {"name": "김순복", "code": 17, "gross": 1900800,
     "np": 0, "hi": 120520, "ei": 30160, "lti": 15820,
     "note": "NP exempt (60+)"},
]

print("=" * 90)
print(f"{'이름':<10} {'코드':>4} {'지급액':>10} {'EI역산':>10} {'NP역산':>10} {'HI역산':>10}  추정보수월액")
print("=" * 90)

results = []
for e in employees:
    # Method 1: EI (0.9%) - most reliable
    ei_base = round(e["ei"] / 0.009) if e["ei"] > 0 else 0
    # Method 2: NP (4.75%)
    np_base = round(e["np"] / 0.0475) if e["np"] > 0 else 0
    # Method 3: HI (3.595%)
    hi_base = round(e["hi"] / 0.03595) if e["hi"] > 0 else 0

    best = ei_base if ei_base > 0 else (np_base if np_base > 0 else hi_base)
    results.append({"name": e["name"], "base": best, "data": e})

    note = f"  ({e['note']})" if e["note"] else ""
    print(f"{e['name']:<10} {e['code']:>4} {e['gross']:>10,} {ei_base:>10,} {np_base:>10,} {hi_base:>10,}  {best:>10,}{note}")

print()
print("=== Verification (recalculate with estimated base) ===")
for r in results:
    e = r["data"]
    base = r["base"]
    
    calc_np = int(round(max(400000, min(base, 6370000)) * 0.0475)) if e["np"] > 0 else 0
    calc_hi = int(round(max(280383, min(base, 127725730)) * 0.03595)) // 10 * 10
    calc_ei = int(round(base * 0.009)) // 10 * 10
    calc_lti = int(round(calc_hi * 0.1314)) // 10 * 10

    checks = []
    checks.append(f"NP={'OK' if calc_np == e['np'] else str(calc_np) + ' vs ' + str(e['np'])}")
    checks.append(f"HI={'OK' if calc_hi == e['hi'] else str(calc_hi) + ' vs ' + str(e['hi'])}")
    if e["ei"] > 0:
        checks.append(f"EI={'OK' if calc_ei == e['ei'] else str(calc_ei) + ' vs ' + str(e['ei'])}")
    checks.append(f"LTI={'OK' if calc_lti == e['lti'] else str(calc_lti) + ' vs ' + str(e['lti'])}")

    print(f"  {r['name']:<10} base={base:>10,}  {', '.join(checks)}")
