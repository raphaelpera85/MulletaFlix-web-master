@echo off
setlocal
cd /d "%~dp0"
node scripts\playwright\run-suite.mjs
endlocal
