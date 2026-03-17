@echo off
setlocal
call npm.cmd run build:release
exit /b %errorlevel%
