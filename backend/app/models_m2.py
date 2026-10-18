"""M2 v2 domain records for a future persistence slice.

These are dataclasses, not SQLAlchemy models.  Stage 4.1 intentionally creates
no tables and writes no assessment records, preserving the existing database and
the protected M3 persistence path.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class M2AssessmentRunDraft:
    user_id: int
    category: str
    assessment_status: str
    created_at: datetime


@dataclass(frozen=True)
class M2ModelVersionRecord:
    model_id: str
    registry_version: str
    approval_status: str

