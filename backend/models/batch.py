from sqlalchemy import Column, Integer, ForeignKey, Date, String, Float
from database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)

    food_item_id = Column(
        Integer,
        ForeignKey("food_items.id"),
        nullable=False
    )

    quantity = Column(
        Integer,
        nullable=False
    )

    # Original/manual expiry date
    expiry_date = Column(
        Date,
        nullable=False
    )

    availability = Column(
        String,
        default="Available",
        nullable=False
    )

    # -------------------------------
    # Milestone 3 prediction fields
    # -------------------------------

    freshness_score = Column(
        Float,
        nullable=True
    )

    remaining_shelf_life = Column(
        Integer,
        nullable=True
    )

    predicted_expiry_date = Column(
        Date,
        nullable=True
    )

    spoilage_probability = Column(
        Float,
        nullable=True
    )

    spoilage_risk = Column(
        String,
        nullable=True
    )

    consumption_priority = Column(
        String,
        nullable=True
    )