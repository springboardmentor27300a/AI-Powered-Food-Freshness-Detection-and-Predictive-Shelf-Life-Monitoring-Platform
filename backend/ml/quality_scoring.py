def get_quality_category(score: float) -> str:
    """Map a 0-100 score to the official quality categories."""
    if score >= 90: return "Fresh"
    if score >= 70: return "Good"
    if score >= 50: return "Acceptable"
    if score >= 30: return "Near Spoilage"
    return "Spoiled"

def calculate_quality_score(ml_status: str, ml_confidence: float, ml_freshness_score: float, cv_analysis: dict) -> dict:
    """
    Combines MobileNetV2 ML predictions with OpenCV heuristics to create a final 0-100 score.
    Uses beginner-friendly normalization formulas.
    """
    
    color_metrics = cv_analysis.get("color_analysis", {})
    texture_metrics = cv_analysis.get("texture_analysis", {})
    deg_metrics = cv_analysis.get("degradation_analysis", {})

    brown_ratio = color_metrics.get("brown_pixel_ratio", 0.0)
    dark_ratio = color_metrics.get("dark_pixel_ratio", 0.0)
    
    edge_density = texture_metrics.get("edge_density", 0.0)
    texture_var = texture_metrics.get("texture_variance", 0.0)
    
    discoloration = deg_metrics.get("discoloration_ratio", 0.0)
    irregularity = deg_metrics.get("surface_irregularity", 0.0)

    
    color_score = 100.0 - (brown_ratio * 1.5) - (dark_ratio * 1.0)
    color_score = max(0.0, min(100.0, color_score))

    texture_score = 100.0 - (edge_density * 1.5)
    if texture_var > 1000:
        # Extremely high variance usually indicates rough/damaged surface
        texture_score -= (texture_var - 1000) / 50.0
    texture_score = max(0.0, min(100.0, texture_score))

    surface_score = 100.0 - (discoloration * 2.0) - (irregularity * 1.0)
    surface_score = max(0.0, min(100.0, surface_score))

    weighted_score = (
        (ml_freshness_score * 0.40) +
        (color_score * 0.20) +
        (texture_score * 0.20) +
        (surface_score * 0.20)
    )

    rotten_penalty_applied = False
    final_score = weighted_score
    
    if ml_status == "Rotten":
        # Strongly penalize the final score without hard-capping it to 29.
        final_score = weighted_score * 0.60
        rotten_penalty_applied = True

    final_score = round(max(0.0, min(100.0, final_score)), 1)
    
    is_rotten = (ml_status == "Rotten")
    risk_level = "Low"
    if is_rotten:
        if ml_confidence >= 0.80:
            risk_level = "High"
        elif ml_confidence >= 0.50:
            risk_level = "Medium"
        else:
            risk_level = "Low"

    return {
        "quality_score": final_score,
        "quality_category": get_quality_category(final_score),
        "score_breakdown": {
            "ml_freshness_score": round(ml_freshness_score, 1),
            "color_score": round(color_score, 1),
            "texture_score": round(texture_score, 1),
            "surface_score": round(surface_score, 1),
            "weighted_score_before_penalty": round(weighted_score, 1),
            "rotten_penalty_applied": rotten_penalty_applied
        },
        "spoilage_assessment": {
            "detected": is_rotten,
            "risk_level": risk_level
        }
    }
