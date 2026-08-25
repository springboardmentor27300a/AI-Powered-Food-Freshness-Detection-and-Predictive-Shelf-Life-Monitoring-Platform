from fastapi import APIRouter
from app.models.schemas import CategoryResponse
from app.db.mongodb import get_database
from typing import List

router = APIRouter(prefix="/categories", tags=["Product Categories"])

def format_category(doc) -> CategoryResponse:
    return CategoryResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        code=doc["code"],
        icon=doc.get("icon", "📦"),
        description=doc.get("description", "")
    )

@router.get("", response_model=List[CategoryResponse])
async def list_categories():
    db = get_database()
    cursor = db.categories.find({}).sort("name", 1)
    docs = await cursor.to_list(length=100)
    return [format_category(d) for d in docs]
