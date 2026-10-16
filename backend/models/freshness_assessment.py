from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base


class FreshnessAssessment(Base):
    __tablename__ = "freshness_assessments"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True, index=True)
    food_type = Column(String, nullable=False)
    image_name = Column(String, nullable=True)
    image_path = Column(String, nullable=True)

    freshness_score = Column(Float, nullable=False)
    freshness_status = Column(String, nullable=False)
    spoilage_probability = Column(Float, nullable=False)
    spoilage_risk = Column(String, nullable=False)
    shelf_life_at_assessment = Column(Integer, nullable=False)
    predicted_expiry_date = Column(Date, nullable=False)

    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    air_circulation = Column(String, nullable=False)
    light_exposure = Column(String, nullable=False)
    packaging_type = Column(String, nullable=False)
    storage_duration = Column(Integer, default=0, nullable=False)
    storage_compliance_score = Column(Float, nullable=False)
    overall_storage_status = Column(String, nullable=False)
    overall_health_score = Column(Float, nullable=False)

    color_analysis_json = Column(Text, nullable=True)
    texture_analysis_json = Column(Text, nullable=True)
    mold_analysis_json = Column(Text, nullable=True)
    bruising_analysis_json = Column(Text, nullable=True)
    physical_damage_json = Column(Text, nullable=True)
    final_assessment_json = Column(Text, nullable=True)
    storage_json = Column(Text, nullable=True)
    shelf_life_json = Column(Text, nullable=True)
    recommendations_json = Column(Text, nullable=True)

    recorded_at = Column(DateTime, server_default=func.now(), nullable=False)
