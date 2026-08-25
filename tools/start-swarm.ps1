# Start the VTO swarm stack (gateway + daemon + dispatcher) as detached hidden processes.
# Logs: logs\swarm\<app>.out.log / .err.log (overwritten on each start).
# Safe to re-run: skips any component that is already running.
$v = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node).Source
# pgmq claim visibility timeout MUST exceed the longest operation (video op = 25 min) or a live
# task is redelivered mid-run and double-claimed. Read at db-module load — set it HERE, not in
# .secrets.env (loadSecrets runs after the db module initialises).
$env:SWARM_CLAIM_VT = '2400'
$map = @{ bridge = "gateway.js"; daemon = "daemon.js"; dispatcher = "dispatcher.js" }
New-Item -ItemType Directory -Force "$v\logs\swarm" | Out-Null
$running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "dist[\\/](gateway|daemon|dispatcher)\.js" }
foreach ($app in $map.Keys) {
    $entry = $map[$app]
    if ($running | Where-Object { $_.CommandLine -match [regex]::Escape($entry) }) { Write-Output "$app already running - skipped"; continue }
    Start-Process -FilePath $node -ArgumentList "dist\$entry" -WorkingDirectory "$v\apps\$app" -WindowStyle Hidden `
        -RedirectStandardOutput "$v\logs\swarm\$app.out.log" -RedirectStandardError "$v\logs\swarm\$app.err.log"
    Write-Output "$app started"
}
Start-Sleep -Seconds 8
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "dist[\\/](gateway|daemon|dispatcher)\.js" } |
    ForEach-Object { "{0}  {1}" -f $_.ProcessId, ($_.CommandLine -replace '.*dist', 'dist') }
