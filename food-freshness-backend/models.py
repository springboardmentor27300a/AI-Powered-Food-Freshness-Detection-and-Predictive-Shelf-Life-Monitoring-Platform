from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="consumer")
class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    quantity = Column(Integer, default=1)
    expiry_date = Column(String, nullable=True)
    batch_number = Column(String, nullable=True)
    storage_temp = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
from datetime import datetime

class FreshnessAnalysis(Base):
    __tablename__ = "freshness_analyses"

    id = Column(Integer, primary_key=True, index=True)
    food_item_id = Column(Integer, ForeignKey("food_items.id"))
    owner_id = Column(Integer, ForeignKey("users.id"))
    label = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    quality_score = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    color_score = Column(Float, nullable=True, default=100.0)
    mold_score = Column(Float, nullable=True, default=100.0)
    bruising_score = Column(Float, nullable=True, default=100.0)
    visual_score = Column(Float, nullable=True, default=100.0)
    storage_score = Column(Float, nullable=True, default=90.0)
    shelflife_days = Column(Float, nullable=True, default=7.0)
    age_score = Column(Float, nullable=True, default=80.0)
    created_at = Column(DateTime, default=datetime.utcnow)