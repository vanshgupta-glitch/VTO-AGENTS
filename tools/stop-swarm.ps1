# Stop the VTO swarm stack (gateway + daemon + dispatcher). In-flight pgmq claims auto-recover
# via the visibility timeout (D-037); queued tasks and workflow runs persist in Postgres.
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "dist[\\/](gateway|daemon|dispatcher)\.js" }
if (-not $procs) { Write-Output "swarm not running"; exit 0 }
$procs | ForEach-Object { Write-Output ("stopping " + $_.ProcessId + "  " + ($_.CommandLine -replace '.*dist', 'dist')); Stop-Process -Id $_.ProcessId -Force -Confirm:$false }
Write-Output "swarm stopped"
