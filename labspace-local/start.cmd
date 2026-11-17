@echo off
rem Starts the Labspace on Windows: runs start.ps1 with PowerShell, whatever the execution policy.
rem Windows doesn't run unsigned PowerShell scripts by default ("running scripts is disabled on this
rem system"); -ExecutionPolicy Bypass applies to this run only, and changes no setting.
rem
rem   labspace-local\start.cmd      (from cmd or PowerShell, or double-click it)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
rem Keep the window open on an error, when it was opened by a double-click
if errorlevel 1 pause
