@echo off
echo === Adaptive Learner Cleanup ===
echo.

echo Container stoppen und entfernen...
for %%c in (adaptive-learner adaptive-learner-app adaptive_learner) do (
    docker stop %%c 2>nul && echo   Container '%%c' gestoppt
    docker rm %%c 2>nul && echo   Container '%%c' entfernt
)

echo.
echo Docker Images entfernen...
for /f "tokens=*" %%i in ('docker images --format "{{.Repository}}:{{.Tag}}" 2^>nul ^| findstr /i "adaptive-learner"') do (
    docker rmi %%i --force 2>nul && echo   Image '%%i' entfernt
)

echo.
echo Port 8501 pruefen...
netstat -an | findstr ":8501 " >nul 2>&1
if %errorlevel%==0 (
    echo   WARNUNG: Port 8501 ist noch belegt
) else (
    echo   Port 8501 ist frei
)

echo.
echo === Cleanup abgeschlossen ===
pause
