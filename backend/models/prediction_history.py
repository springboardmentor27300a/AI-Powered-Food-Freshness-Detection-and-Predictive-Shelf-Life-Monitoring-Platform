from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Date,
    DateTime,
    ForeignKey
)
from sqlalchemy.sql import func
from database import Base


class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    batch_id = Column(
        Integer,
        ForeignKey("batches.id"),
        nullable=False
    )

    freshness_score = Column(
        Float,
        nullable=False
    )

    remaining_shelf_life = Column(
        Integer,
        nullable=False
    )

    predicted_expiry_date = Column(
        Date,
        nullable=False
    )

    spoilage_probability = Column(
        Float,
        nullable=False
    )

    spoilage_risk = Column(
        String,
        nullable=False
    )

    temperature = Column(
        Float,
        nullable=True
    )

    humidity = Column(
        Float,
        nullable=True
    )

    recorded_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )