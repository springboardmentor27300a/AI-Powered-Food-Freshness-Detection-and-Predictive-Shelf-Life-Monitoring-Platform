import requests

print("E2E Mathematical Verification...")

def verify_math(qa):
    print("---------------------------------")
    score = qa.get("quality_score")
    bd = qa.get("score_breakdown", {})
    
    ml = bd.get("ml_freshness_score", 0)
    col = bd.get("color_score", 0)
    tex = bd.get("texture_score", 0)
    sur = bd.get("surface_score", 0)
    
    calculated = (ml * 0.4) + (col * 0.2) + (tex * 0.2) + (sur * 0.2)
    penalized = calculated * 0.6 if bd.get("rotten_penalty_applied") else calculated
    final_rounded = round(max(0.0, min(100.0, penalized)), 1)
    
    print(f"Components: ML={ml}, Col={col}, Tex={tex}, Sur={sur}")
    print(f"Calculated Weighted: {calculated:.2f}")
    print(f"Penalty Applied: {bd.get('rotten_penalty_applied')}")
    print(f"Final Mathematically Calculated: {final_rounded}")
    print(f"API Returned Score: {score}")
    if final_rounded == score:
        print("✅ MATH MATCHES PERFECTLY")
    else:
        print("❌ MATH MISMATCH")

from ml.quality_scoring import calculate_quality_score

print("\nTest 1: Fresh")
res1 = calculate_quality_score("Fresh", 0.9, 90.0, {"color_analysis": {"brown_pixel_ratio": 5.0}})
verify_math(res1)

print("\nTest 2: Rotten")
res2 = calculate_quality_score("Rotten", 0.9, 45.0, {"color_analysis": {"brown_pixel_ratio": 50.0}})
verify_math(res2)
