@echo off
echo ========================================================
echo        ShopFast Platform - Khoi dong Local Dev
echo ========================================================
echo.
echo [*] Luu y: Hay chac chan ban da mo Laragon va bam "Start All"
echo     (de PostgreSQL 5432 hoat dong).
echo.
echo [1/2] Dang khoi dong Backend NestJS (Port 3000)...
start "ShopFast Backend (NestJS)" cmd /k "cd /d %~dp0server && npm run start:dev"

echo [2/2] Dang khoi dong Frontend React Vite (Port 5173)...
start "ShopFast Frontend (React)" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ========================================================
echo   TAT CA DICH VU DANG CHAY:
echo   - Swagger API Docs : http://localhost:3000/api/docs
echo   - Web UI Demo      : http://localhost:5173
echo ========================================================
echo.
pause
