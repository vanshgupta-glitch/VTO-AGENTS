@echo off
REM Swarm control. Run from anywhere.
REM   swarm            init + verify + status   (safe, idempotent, recommended)
REM   swarm ping       live-test every agent
REM   swarm status     what exists and what is running
REM   swarm start      also bring up gateways (only for chat-platform access)
REM   swarm stop       stop those gateways
setlocal
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
python "%~dp0tools\bootstrap.py" %*
endlocal
