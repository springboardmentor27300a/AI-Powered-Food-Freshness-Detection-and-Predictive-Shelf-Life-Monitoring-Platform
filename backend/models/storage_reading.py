from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from database import Base


class StorageReading(Base):
    __tablename__ = "storage_readings"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True, index=True)
    food_type = Column(String, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    air_circulation = Column(String, nullable=False)
    light_exposure = Column(String, nullable=False)
    packaging_type = Column(String, nullable=True)
    storage_duration = Column(Integer, default=0, nullable=False)
    compliance_score = Column(Float, nullable=False)
    overall_status = Column(String, nullable=False)
    temperature_status = Column(String, nullable=False)
    humidity_status = Column(String, nullable=False)
    air_status = Column(String, nullable=False)
    light_status = Column(String, nullable=False)
    recommendations_json = Column(Text, nullable=True)
    recorded_at = Column(DateTime, server_default=func.now(), nullable=False)
