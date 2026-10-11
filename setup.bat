@echo off
setlocal
echo ======================================================
echo    Starting Biddyapith Platform Setup (Windows)
echo ======================================================

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js (v18 or higher) from https://nodejs.org/
    pause
    exit /b 1
)

where npx >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npx is not found in your PATH.
    echo Please check your Node.js installation.
    pause
    exit /b 1
)

npx tsx scripts/setup.ts %*
set SETUP_EXIT_CODE=%ERRORLEVEL%

if %SETUP_EXIT_CODE% NEQ 0 (
    echo.
    echo ======================================================
    echo [ERROR] Setup encountered an issue (Exit Code %SETUP_EXIT_CODE%).
    echo.
    echo If this was a database timeout or volume conflict,
    echo try running a clean reinstall:
    echo     setup.bat --fresh
    echo ======================================================
    echo.
)

pause
exit /b %SETUP_EXIT_CODE%

