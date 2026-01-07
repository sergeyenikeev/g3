@echo off
setlocal
set "ROOT=C:\Users\s\Documents\g2"
cd /d "%ROOT%" || call :fail "Failed to cd to %ROOT%."

set "VITE_USE_PLATFORM_MOCK=1"

for %%P in (generic crazygames poki yandex vkplay rustore newgrounds itchio) do (
  echo === Building %%P [mock] ===
  call npm run build:%%P
  if errorlevel 1 call :fail "Build %%P [mock] failed."
  powershell -NoProfile -Command "Compress-Archive -Path '%ROOT%\dist\%%P\*' -DestinationPath '%ROOT%\dist\lumelines-%%P-mock.zip' -Force"
  if errorlevel 1 call :fail "Archive %%P [mock] failed."
)

endlocal
echo All mock builds completed successfully.
pause
exit /b 0

:fail
echo ERROR: %~1
pause
exit /b 1
