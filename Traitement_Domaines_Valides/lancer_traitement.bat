@echo off
echo 🌐 Traitement des Domaines Valides
echo ==================================
echo.
echo Lancement de l'interface principale...
echo.
cd /d "%~dp0"
node scripts\run_domaines.cjs
pause 