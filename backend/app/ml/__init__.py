"""
Machine Learning & Domain Inference Package
Provides Computer Vision Freshness Analysis, Arrhenius Shelf-Life Modeling,
Intelligent Storage Recommendations, and Analytical Reporting.
"""

from backend.app.ml.cv_analyzer import image_analyzer, FoodImageAnalyzer
from backend.app.ml.shelf_life_model import shelf_life_predictor, ShelfLifePredictor
from backend.app.ml.recommendation_engine import recommendation_engine, FoodRecommendationEngine
from backend.app.ml.report_generator import report_generator, ReportGenerator

__all__ = [
    "image_analyzer",
    "FoodImageAnalyzer",
    "shelf_life_predictor",
    "ShelfLifePredictor",
    "recommendation_engine",
    "FoodRecommendationEngine",
    "report_generator",
    "ReportGenerator",
]
