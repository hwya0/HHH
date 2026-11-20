@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PY=%~dp0venv\Scripts\python.exe"
set "CF=%~dp0..\cloudflared.exe"
if not exist "%CF%" set "CF=%~dp0cloudflared.exe"
set "ERRLOG=%~dp0tunnel.err"
set "CURRENT=%~dp0tunnel.current"

echo.
echo ============================================================
echo   马原刷题 APP - 启动
echo ============================================================
echo.

rem ------- Step 1: 后端 -------
echo [1/2] 检查后端...

curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:5000/api/config 2>nul | findstr "200" >nul
if !errorlevel!==0 (
    echo       后端已在运行，跳过
    goto :backend_done
)

echo       启动后端...
start "马原刷题-后端" cmd /k ""%PY%" app.pyc"

for /L %%i in (1,1,20) do (
    ping 127.0.0.1 -n 2 >nul
    curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:5000/api/config 2>nul | findstr "200" >nul
    if !errorlevel!==0 (
        echo       后端就绪
        goto :backend_done
    )
)
echo       警告：后端启动超时
:backend_done

rem ------- Step 2: Cloudflare Tunnel -------
echo.
echo [2/2] 检查 Cloudflare 隧道...

rem 读上次域名（必须以 https:// 开头）
set "LASTDOMAIN="
if exist "%CURRENT%" (
    for /f "tokens=*" %%d in ('type "%CURRENT%"') do set "LASTDOMAIN=%%d"
)
if not "!LASTDOMAIN:~0,8!"=="https://" set "LASTDOMAIN="

rem cloudflared 进程在吗？
set "CF_ALIVE=0"
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | findstr /I "cloudflared.exe" >nul
if !errorlevel!==0 set "CF_ALIVE=1"

rem 上次域名还能访问吗？
set "DOMAIN_OK=0"
if not "!LASTDOMAIN!"=="" (
    curl.exe -s -o nul -w "%%{http_code}" "!LASTDOMAIN!/api/config" 2>nul | findstr "200" >nul
    if !errorlevel!==0 set "DOMAIN_OK=1"
)

if "!CF_ALIVE!"=="1" if "!DOMAIN_OK!"=="1" (
    echo       隧道正常，域名: !LASTDOMAIN!
    goto :cf_ok
)

rem 重建 tunnel
echo       重建隧道...
taskkill /F /IM cloudflared.exe >nul 2>&1
ping 127.0.0.1 -n 3 >nul
if exist "%ERRLOG%" del /q "%ERRLOG%"

start "马原刷题-隧道" cmd /k ""%CF%" tunnel --url http://127.0.0.1:5000 --no-autoupdate 2> "%ERRLOG%""

set "NEWDOMAIN="
for /L %%i in (1,1,25) do (
    ping 127.0.0.1 -n 2 >nul
    if not "!NEWDOMAIN!"=="" goto :cf_new
    for /f "tokens=4" %%b in ('findstr /C:"https://" "%ERRLOG%" 2^>nul') do set "NEWDOMAIN=%%b"
)
:cf_new

if not "!NEWDOMAIN:~0,8!"=="https://" set "NEWDOMAIN="

if "!NEWDOMAIN!"=="" (
    echo       警告：未能解析新域名
    goto :cf_ok
)

echo !NEWDOMAIN!> "%CURRENT%"
echo       新域名: !NEWDOMAIN!
:cf_ok

rem ------- 显示 -------
echo.
echo ============================================================
echo   本地:  http://127.0.0.1:5000
if not "!NEWDOMAIN!"=="" (
    echo   公网:  !NEWDOMAIN!
) else if not "!LASTDOMAIN!"=="" (
    echo   公网:  !LASTDOMAIN!
)
echo ============================================================
echo.
echo   cloudflared 不关 = 域名永远不变
echo   关窗口 = 停止服务
echo.

start "" "http://127.0.0.1:5000"
if not "!NEWDOMAIN!"=="" start "" "!NEWDOMAIN!"
else if not "!LASTDOMAIN!"=="" start "" "!LASTDOMAIN!"

pause
endlocal
