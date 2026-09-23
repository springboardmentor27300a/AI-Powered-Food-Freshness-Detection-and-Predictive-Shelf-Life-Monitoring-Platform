@echo off
echo Starting Food Freshness Platform...

echo Starting Backend...
start cmd /k "cd food-freshness-backend && conda activate freshness && uvicorn main:app --reload"

echo Starting Frontend...
start cmd /k "cd food-freshness-frontend && npm run dev"

echo Both servers are launching in separate windows!
