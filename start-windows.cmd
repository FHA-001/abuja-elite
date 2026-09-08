@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 24 LTS, then run this file again.
 pause
 exit /b 1
)
where pnpm.cmd >nul 2>nul
if errorlevel 1 (
 echo Run npm.cmd install --global pnpm@10.28.2 in PowerShell first.
 pause
 exit /b 1
)
if not exist "artifacts\abuja-elite\.env.local" (
 copy ".env.example" "artifacts\abuja-elite\.env.local" >nul
 echo Configuration template created. Add your two public Supabase values in the file that opens.
 notepad "artifacts\abuja-elite\.env.local"
)
if not exist "node_modules" (
 call pnpm.cmd install --frozen-lockfile
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
echo Opening the local development server at http://localhost:3006
call pnpm.cmd dev
pause
