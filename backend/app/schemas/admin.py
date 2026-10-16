from typing import Dict

from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    total_users: int
    users_by_role: Dict[str, int]
    total_inventory_items: int
    total_freshness_assessments: int
    total_storage_readings: int
