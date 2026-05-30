@echo off
title WebToForm — AI Insurance Form Generator
color 1F
echo.
echo  ============================================================
echo   WebToForm — AI Insurance Form Generator
echo  ============================================================
echo.

:: ── Check Python ─────────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo  Download Python 3.10+ from https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo  Python %PY_VER% found.

:: ── Virtual environment ───────────────────────────────────────
if not exist "venv\Scripts\activate.bat" (
    echo  Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo  [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo  Virtual environment created.
)

call venv\Scripts\activate.bat

:: ── Install / update dependencies ────────────────────────────
echo  Installing dependencies (this may take a moment on first run)...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo  [ERROR] Dependency installation failed. Check your internet connection.
    pause
    exit /b 1
)
echo  Dependencies ready.

:: ── .env setup ───────────────────────────────────────────────
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo  .env file created from template.
)

echo.
echo  NOTE: If you have not set your DeepSeek API key yet,
echo  you can enter it directly in the app after it opens.
echo.

:: ── Launch Flask ──────────────────────────────────────────────
echo.
echo  Starting WebToForm server...
echo.

:: Read PORT from .env if set
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="PORT" set APP_PORT=%%b
)
if not defined APP_PORT set APP_PORT=5000

:: Open browser after a short delay (runs in background)
start /b cmd /c "timeout /t 2 >nul && start http://localhost:%APP_PORT%"

echo  ============================================================
echo   App running at: http://localhost:%APP_PORT%
echo   Press Ctrl+C to stop the server.
echo  ============================================================
echo.

python app.py

:: Keep window open if the server crashes
echo.
echo  Server stopped.
pause
