from sqlalchemy.orm import Session

from app.models.analysis import VisualAnalysisResult
from app.models.food_image import FoodImage
from app.services import opencv_service
from app.services.image_service import get_image_path


def run_visual_analysis(db: Session, food_image: FoodImage) -> VisualAnalysisResult:
    image_path = str(get_image_path(food_image))
    result = opencv_service.analyze_image(image_path)

    row = VisualAnalysisResult(
        image_id=food_image.id,
        color_score=result.color_score,
        texture_score=result.texture_score,
        dark_spot_score=result.dark_spot_score,
        bruising_score=result.bruising_score,
        damage_score=result.damage_score,
        overall_visual_score=result.overall_visual_score,
        dark_spot_area_pct=result.dark_spot_area_pct,
        summary=result.summary,
        explanation=result.explanation,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
