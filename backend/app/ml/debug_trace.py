"""
Debug trace for the freshness analysis pipeline.

The analyzer runs
    INPUT -> PREPROCESS -> FOOD REGION -> COLOR -> TEXTURE -> MOLD -> BRUISE
          -> DAMAGE -> CNN -> FRESHNESS SCORE -> SPOILAGE -> CLASSIFICATION

This module records every stage (raw measurement, normalised score, confidence
and the contribution each stage made to the final number) and can print it as a
readable trace.  Enable it with::

    FRESHNESS_DEBUG=1 uvicorn app.main:app --reload

The trace is also returned inside ``analysis_details["debug"]`` so the values
are inspectable from the API response and the UI, which makes regressions in
the pipeline visible instead of silent.
"""
import logging
import os
from dataclasses import dataclass, field

logger = logging.getLogger("app.ml.pipeline")

_ENABLED = os.getenv("FRESHNESS_DEBUG", "").strip().lower() in ("1", "true", "yes", "on")


def debug_enabled() -> bool:
    return _ENABLED


def set_debug_enabled(value: bool) -> None:
    global _ENABLED
    _ENABLED = bool(value)


@dataclass
class Stage:
    name: str
    raw: dict = field(default_factory=dict)
    score: float | None = None
    confidence: float = 0.0
    contribution: float | None = None
    note: str = ""

    def as_dict(self) -> dict:
        return {
            "raw": self.raw,
            "score": None if self.score is None else round(self.score, 4),
            "confidence": round(self.confidence, 4),
            "contribution": None if self.contribution is None else round(self.contribution, 4),
            "note": self.note,
        }


class PipelineTrace:
    """Collects and optionally prints each analysis stage."""

    def __init__(self, enabled: bool | None = None, logger_: logging.Logger | None = None):
        self.enabled = debug_enabled() if enabled is None else bool(enabled)
        self.logger = logger_ or logger
        self.stages: list[Stage] = []
        self.extra: dict = {}

    def stage(self, name: str, raw: dict | None = None, score: float | None = None,
              confidence: float = 0.0, contribution: float | None = None,
              note: str = "") -> Stage:
        s = Stage(
            name=name,
            raw=raw or {},
            score=score,
            confidence=confidence,
            contribution=contribution,
            note=note,
        )
        self.stages.append(s)
        if self.enabled:
            self._log_stage(s)
        return s

    def add(self, key: str, value) -> None:
        self.extra[key] = value
        if self.enabled:
            self.logger.info("  %-22s %s", key, value)

    def _log_stage(self, s: Stage) -> None:
        raw_txt = " ".join(f"{k}={_fmt(v)}" for k, v in s.raw.items()) or "-"
        score_txt = "-" if s.score is None else f"{s.score * 100:.1f}%"
        contrib_txt = "" if s.contribution is None else f" contrib={s.contribution * 100:+.1f}pt"
        self.logger.info(
            "  [%s] raw: %s | score: %s | conf: %.2f%s%s",
            s.name, raw_txt, score_txt, s.confidence, contrib_txt,
            f" | {s.note}" if s.note else "",
        )

    def render(self) -> str:
        lines = ["FRESHNESS ANALYSIS PIPELINE TRACE"]
        for key, value in self.extra.items():
            lines.append(f"  {key:<22} {value}")
        for s in self.stages:
            raw_txt = " ".join(f"{k}={_fmt(v)}" for k, v in s.raw.items()) or "-"
            score_txt = "-" if s.score is None else f"{s.score * 100:.1f}%"
            lines.append(
                f"  [{s.name}] raw: {raw_txt} | score: {score_txt} | "
                f"conf: {s.confidence:.2f}"
            )
        return "\n".join(lines)

    def as_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "inputs": self.extra,
            "stages": [s.as_dict() for s in self.stages],
        }


def _fmt(v) -> str:
    if isinstance(v, float):
        return f"{v:.3f}"
    return str(v)
