from datetime import date, datetime
from sqlalchemy import String, Integer, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class FoodItem(Base):
    __tablename__ = "food_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60))
    unit: Mapped[str] = mapped_column(String(20), default="kg")
    min_temp: Mapped[float] = mapped_column(Float, default=2)
    max_temp: Mapped[float] = mapped_column(Float, default=8)
    min_humidity: Mapped[float] = mapped_column(Float, default=40)
    max_humidity: Mapped[float] = mapped_column(Float, default=75)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class FoodBatch(Base):
    __tablename__ = "food_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    food_item_id: Mapped[int] = mapped_column(ForeignKey("food_items.id"))
    batch_code: Mapped[str] = mapped_column(String(80), unique=True)
    quantity: Mapped[float] = mapped_column(Float)
    received_date: Mapped[date] = mapped_column(Date)
    expiry_date: Mapped[date] = mapped_column(Date)
    temperature: Mapped[float] = mapped_column(Float, default=5)
    humidity: Mapped[float] = mapped_column(Float, default=60)
    packaging: Mapped[str] = mapped_column(String(60), default="Standard")
    storage_area: Mapped[str] = mapped_column(String(80), default="Main Storage")
    status: Mapped[str] = mapped_column(String(30), default="Active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
