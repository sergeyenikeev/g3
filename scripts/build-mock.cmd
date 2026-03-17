@echo off
setlocal
call npm.cmd run build:test-mock
exit /b %errorlevel%
