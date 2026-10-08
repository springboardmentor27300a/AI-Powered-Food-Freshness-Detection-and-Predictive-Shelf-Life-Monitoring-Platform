@echo off
setlocal
cd /d "%~dp0"
title FreshGuard - Milestone 3

color 0A

echo.
echo ============================================================
echo             FRESHGUARD - MILESTONE 3
echo ============================================================
echo.

echo [1/6] Checking Python...
where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python was not found.
    echo Install Python 3.10 or newer, then run this file again.
    pause
    exit /b 1
)

for /f "tokens=*" %%V in ('python --version') do echo %%V

echo.
echo [2/6] Checking Node.js and npm...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found.
    echo Install Node.js 18 or newer, then run this file again.
    pause
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found.
    pause
    exit /b 1
)
node --version
call npm --version

echo.
echo [3/6] Preparing Python environment...
if not exist "backend\venv\Scripts\python.exe" (
    python -m venv backend\venv
    if errorlevel 1 (
        echo ERROR: Could not create the Python virtual environment.
        pause
        exit /b 1
    )
)

call "backend\venv\Scripts\python.exe" -m pip install -q --upgrade pip
call "backend\venv\Scripts\python.exe" -m pip install -q -r backend\requirements.txt
if errorlevel 1 (
    echo ERROR: Backend dependency installation failed.
    pause
    exit /b 1
)

echo.
echo [4/6] Verifying MySQL connection and database...
call "backend\venv\Scripts\python.exe" setup_freshguard.py
if errorlevel 1 (
    echo.
    echo MySQL setup failed. FreshGuard was NOT started.
    pause
    exit /b 1
)

echo.
echo [5/6] Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo ERROR: Frontend dependency installation failed.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [6/6] Starting FreshGuard...
start "FreshGuard Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn app.main:app --reload"
timeout /t 4 /nobreak >nul
start "FreshGuard Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 /nobreak >nul
start "" http://localhost:5173

echo.
echo ============================================================
echo FreshGuard is starting.
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo API docs: http://localhost:8000/docs
echo ============================================================
echo.
echo Keep both black terminal windows open while using FreshGuard.
echo.
endlocal
