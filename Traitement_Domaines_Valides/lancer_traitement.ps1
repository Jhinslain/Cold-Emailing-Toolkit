Write-Host "🌐 Traitement des Domaines Valides" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lancement de l'interface principale..." -ForegroundColor Yellow
Write-Host ""

# Changer vers le répertoire du script
Set-Location $PSScriptRoot

try {
    node scripts\run_domaines.cjs
} catch {
    Write-Host "❌ Erreur lors du lancement: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Vérifiez que Node.js est installé et accessible." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 