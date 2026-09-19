@echo off
setlocal
set "PROJECT_DIR=%~dp0.."
set "NODE_DIR=__NODE_DIR__"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "%PROJECT_DIR%"

echo [%date% %time%] iniciando: build de producao >> "%PROJECT_DIR%\service.log"
call npm run build >> "%PROJECT_DIR%\service.log" 2>&1

:loop
call npm run start >> "%PROJECT_DIR%\service.log" 2>&1
echo [%date% %time%] processo caiu (ou terminou), reiniciando em 5s... >> "%PROJECT_DIR%\service.log"
timeout /t 5 /nobreak >nul
goto loop
