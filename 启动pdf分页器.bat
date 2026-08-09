@echo off
chcp 65001 >nul
title 粉色 PDF 分页器
cd /d "%~dp0"

if not exist node_modules (
  echo [首次运行] 正在安装依赖，请稍候...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重新运行本脚本。
    pause
    exit /b 1
  )
)

echo 正在启动粉色 PDF 分页器...
call npm start
pause
