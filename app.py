import html

from fastapi import FastAPI,UploadFile, File
import sqlite3
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.responses import FileResponse
from reportlab.pdfgen import canvas
from openpyxl import Workbook
app = FastAPI(title="Food Freshness Monitoring Platform")
def init_database():
    conn = sqlite3.connect("food_freshness.db")
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS food_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            food_name TEXT,
            freshness_score REAL,
            category TEXT,
            shelf_life TEXT,
            expiry_date TEXT
        )
    """)

    try:
        cursor.execute("ALTER TABLE food_analysis ADD COLUMN expiry_date TEXT")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()


init_database()
from pathlib import Path
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_FILE = BASE_DIR / "frontend" / "index.html"

@app.get("/")
def home():
    return FileResponse(str(INDEX_FILE))

class FoodData(BaseModel):
    food_name: str
    temperature: float
    humidity: float
    duration: int
    air_circulation: str
    light_exposure: str
    expiry_date: str

@app.post("/analyze")
def analyze_food(food: FoodData):

    score = 100

    if food.temperature > 10:
        score -= 15

    if food.humidity > 75:
        score -= 10

    if food.duration > 5:
        score -= 20
    if food.air_circulation == "Moderate":
     score -= 5

    if food.air_circulation == "Poor":
     score -= 10
    if food.light_exposure =="High":
        score -=10
    elif food.light_exposure =="Moderate":
        score -=5
    if score >= 80:
        category = "Fresh"
    elif score >= 60:
        category = "Good"
    elif score >= 40:
        category = "Acceptable"
    elif score >= 20:
        category = "Near Spoilage"
    else:
        category = "Spoiled"
    recommendation =""
    if category == "Fresh":
         recommendation = "Store properly and maintain recommended temperature."
    elif category == "Good":
         recommendation = "Consume soon and maintain proper storage conditions."
    elif category == "Acceptable":
         recommendation = "Consume soon and monitor freshness regularly."
    elif category == "Near Spoilage":
         recommendation = "Consume immediately or move to better storage conditions."
    else:
         recommendation = "Do not consume. Remove from inventory."

    shelf_life = max(1, round(score / 20))
    conn = sqlite3.connect("food_freshness.db")
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO food_analysis
    (food_name, freshness_score, category, shelf_life, expiry_date)
    VALUES (?, ?, ?, ?, ?)
""", (
    food.food_name,
    score,
    category,
    shelf_life,
    food.expiry_date
))

    conn.commit()
    conn.close()
    return {
    "food_name": food.food_name,
        "freshness_score": score,
        "category": category,
        "recommendation": recommendation,
        "shelf_life": shelf_life,
        "expiry_date": food.expiry_date
    }
@app.get("/history")
def get_history():
    conn = sqlite3.connect("food_freshness.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, food_name, freshness_score, category, shelf_life
        FROM food_analysis
        ORDER BY id DESC
    """)

    history = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return history
@app.get("/generate-pdf/{food_id}")
def generate_pdf(food_id: int):

    conn = sqlite3.connect("food_freshness.db")
    cursor = conn.cursor()

    cursor.execute("""
        SELECT food_name, freshness_score, category, shelf_life, expiry_date
        FROM food_analysis
        WHERE id = ?
    """, (food_id,))

    food = cursor.fetchone()
    conn.close()

    if not food:
        return {"error": "Food record not found"}

    file_name = "food_report.pdf"

    pdf = canvas.Canvas(file_name)

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(150, 800, "Food Freshness Report")

    pdf.setFont("Helvetica", 12)
    pdf.drawString(80, 750, f"Food Name: {food[0]}")
    pdf.drawString(80, 720, f"Freshness Score: {food[1]}%")
    pdf.drawString(80, 690, f"Category: {food[2]}")
    pdf.drawString(80, 660, f"Shelf Life: {food[3]} days")
    pdf.drawString(80, 630, f"Expiry Date: {food[4]}")

    pdf.save()

    return FileResponse(
        file_name,
        media_type="application/pdf",
        filename="food_freshness_report.pdf"
    )
@app.get("/generate-excel")
def generate_excel():

    conn = sqlite3.connect("food_freshness.db")
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, food_name, freshness_score,
               category, shelf_life, expiry_date
        FROM food_analysis
        ORDER BY id DESC
    """)

    records = cursor.fetchall()
    conn.close()

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Food Freshness Report"

    sheet.append([
        "ID",
        "Food Name",
        "Freshness Score",
        "Category",
        "Shelf Life",
        "Expiry Date"
    ])

    for record in records:
        sheet.append(record)

    file_name = "food_freshness_report.xlsx"
    workbook.save(file_name)

    return FileResponse(
        file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="food_freshness_report.xlsx"
    )
@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    return {
        "filename": file.filename,
        "message": "Image uploaded successfully"
    }
