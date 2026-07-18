@echo off
title COLD STORAGE
cd /d "%~dp0"
echo.
echo   HALCYON DYNAMICS — COLD STORAGE
echo   Preparing your shift...
echo.
if not exist node_modules (
  echo   First run: installing dependencies...
  call npm install
)
if not exist dist (
  echo   Building the game...
  call npm run build
)
echo   Opening the game in your browser. Close this window to stop the game server.
call npx vite preview --port 4173 --strictPort --open
