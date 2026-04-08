# Robust Git Auto-Sync Script (Version Diagnostica)
$projectPath = "c:\Users\Admin\Activo-Motors"
$gitPath = "C:\Program Files\Git\cmd\git.exe"

$watcher = New-Object IO.FileSystemWatcher
$watcher.Path = $projectPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [IO.NotifyFilters]::FileName, [IO.NotifyFilters]::LastWrite, [IO.NotifyFilters]::CreationTime

# Unregister previous events if they exist
Get-EventSubscriber | Where-Object { $_.SourceIdentifier -like "SyncEvent_*" } | Unregister-Event -ErrorAction SilentlyContinue

# Register multiple survival-critical events
$events = @("Changed", "Created", "Renamed")
foreach ($evt in $events) {
    Register-ObjectEvent $watcher $evt -SourceIdentifier "SyncEvent_$evt"
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   GIT AUTO-SYNC (DIAGNOSTICO ACTIVADO)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Proyecto: $projectPath"
Write-Host "Monitoreando: Cambios, Creaciones y Renombres"
Write-Host "Presiona Ctrl+C para detener.`n"

try {
    $lastHeartbeat = Get-Date
    while ($true) {
        # Search for any of our sync events
        $occuredEvent = Get-Event | Where-Object { $_.SourceIdentifier -like "SyncEvent_*" } | Select-Object -First 1
        
        if ($occuredEvent) {
            # Settle period to avoid duplicate pops
            Start-Sleep -Milliseconds 500
            Get-Event | Where-Object { $_.SourceIdentifier -like "SyncEvent_*" } | Remove-Event
            
            $fileName = $occuredEvent.SourceEventArgs.Name
            if ([string]::IsNullOrEmpty($fileName)) { $fileName = $occuredEvent.SourceEventArgs.OldName } # Handle rename
            
            # Exclusion list
            if ($fileName -notlike "*.git*" -and $fileName -notlike "*git-sync.ps1*" -and $fileName -notlike "*~*") {
                Write-Host "`n[!] ACTIVADO por: $fileName (Evento: $($occuredEvent.SourceIdentifier))" -ForegroundColor Yellow
                
                # Interactive Prompt
                $msg = Read-Host "(Mensaje del guardado)"
                
                if (-not [string]::IsNullOrWhiteSpace($msg)) {
                    Write-Host "Sincronizando con GitHub..." -ForegroundColor Gray
                    & $gitPath add .
                    & $gitPath commit -m "$msg"
                    $result = & $gitPath push origin main 2>&1
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "OK: Sincronizado correctamente.`n" -ForegroundColor Green
                    } else {
                        Write-Host "ERROR: Fallo el push.`n" -ForegroundColor Red
                        Write-Host $result -ForegroundColor Red
                    }
                } else {
                    Write-Host "Commit cancelado.`n" -ForegroundColor Red
                }
            }
        }
        
        # Simple Heartbeat (visible activity)
        if ((Get-Date) -gt $lastHeartbeat.AddSeconds(15)) {
            Write-Host "Esperando cambios... ($(Get-Date -Format 'HH:mm:ss'))" -ForegroundColor DarkGray
            $lastHeartbeat = Get-Date
        }
        
        Start-Sleep -Milliseconds 300
    }
} catch {
    Write-Host "`nError critico: $_" -ForegroundColor Red
} finally {
    Get-EventSubscriber | Where-Object { $_.SourceIdentifier -like "SyncEvent_*" } | Unregister-Event -ErrorAction SilentlyContinue
    $watcher.Dispose()
    Write-Host "`nMonitoreo finalizado." -ForegroundColor Cyan
}
