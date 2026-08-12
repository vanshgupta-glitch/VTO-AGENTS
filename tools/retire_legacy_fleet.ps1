<#
  Retire the 14 legacy research-fleet Hermes profiles.

    .\tools\retire_legacy_fleet.ps1 -Sweep     # list unsaved work. Changes nothing.
    .\tools\retire_legacy_fleet.ps1 -Archive   # zip to _archive. Deletes nothing.
    .\tools\retire_legacy_fleet.ps1 -Delete    # remove. Refuses without a verified archive.

  These profiles belong to the 14-agent research fleet superseded by the roster
  cut recorded in doc/trajectory.md, but never removed at the runtime layer.

  Never touches `main` (Hermes' own default profile -- removing it risks the
  CLI itself) or the four swarm profiles.

  Sweep before archive, archive before delete. Never the reverse: findings are
  known to sometimes land in profile workspaces rather than the vault, which is
  why vto-collect-findings.ps1 existed at all.
#>
param([switch]$Sweep, [switch]$Archive, [switch]$Delete)
$ErrorActionPreference = 'Stop'

$LEGACY = @('mathematics','physics','patent','medical','privacy','reconstruction',
            'device','media','competitor','fittingbox','testing','pipeline',
            'frontend','orchestrator')
$KEEP   = @('main','admin','coder','critic','researcher')
$ROOT   = Join-Path $env:LOCALAPPDATA 'hermes\profiles'
$ARCDIR = Join-Path $env:LOCALAPPDATA 'hermes\_archive'
$ZIP    = Join-Path $ARCDIR ('legacy-fleet-' + (Get-Date -Format 'yyyy-MM-dd') + '.zip')
$VAULT  = Join-Path $env:USERPROFILE 'OneDrive - NEW MEDIA GURU INDIA PVT LTD\Documents\Obsidian Vault'

function Assert-Safe {
  foreach ($k in $KEEP) {
    if ($LEGACY -contains $k) { throw "SAFETY: '$k' appears in both KEEP and LEGACY" }
  }
  $running = Get-Process -Name 'hermes','python' -ErrorAction SilentlyContinue |
             Where-Object { $_.Path -like '*hermes*' }
  if ($running) {
    throw "Hermes processes are running. Stop them before retiring profiles."
  }
}

if (-not ($Sweep -or $Archive -or $Delete)) {
  Write-Host "Specify -Sweep, -Archive or -Delete. See the header for the order."
  exit 2
}

if ($Sweep) {
  Assert-Safe
  Write-Host "`nMarkdown inside legacy profiles with no same-named file in the vault:`n"
  $vaultNames = @{}
  if (Test-Path $VAULT) {
    Get-ChildItem $VAULT -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
      ForEach-Object { $vaultNames[$_.Name] = $true }
    Write-Host ("  (vault indexed: {0} markdown files)`n" -f $vaultNames.Count)
  } else {
    Write-Host "  [!] vault not found at $VAULT"
    Write-Host "      treating every .md as unsaved`n"
  }
  # `skills/` is ~460 stock Hermes skill bundle files per profile. They are
  # shipped content, reinstalled with any profile, and would bury a real
  # finding 3000 lines deep. Generated identity files are excluded for the
  # same reason: setup.py can regenerate them, and the archive keeps them.
  $n = 0
  foreach ($p in $LEGACY) {
    $d = Join-Path $ROOT $p
    if (-not (Test-Path $d)) { continue }
    Get-ChildItem $d -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName -notmatch '\\skills\\' -and
        -not $vaultNames.ContainsKey($_.Name) -and
        $_.Name -notin @('SOUL.md', 'MEMORY.md', 'USER.md')
      } |
      ForEach-Object { $n++; "  {0,-14} {1}  [{2} bytes]" -f $p, $_.FullName.Replace($d, ''), $_.Length }
  }
  if ($n -eq 0) {
    Write-Host "  none - no finding lives only in a profile workspace"
  }

  # The directories where a stray finding would actually land.
  Write-Host "`nWork directories (all should be empty):`n"
  foreach ($sub in @('workspace', 'sandboxes', 'plans', 'sessions')) {
    $t = 0
    foreach ($p in $LEGACY) {
      $d = Join-Path (Join-Path $ROOT $p) $sub
      if (Test-Path $d) {
        $t += (Get-ChildItem $d -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
      }
    }
    $flag = if ($t -eq 0) { 'empty' } else { "$t FILES - INSPECT BEFORE DELETING" }
    "  {0,-12} {1}" -f $sub, $flag
  }
  Write-Host "`n$n unaccounted file(s).`n"
}

if ($Archive) {
  Assert-Safe
  New-Item -ItemType Directory -Force $ARCDIR | Out-Null
  $src = $LEGACY | ForEach-Object { Join-Path $ROOT $_ } | Where-Object { Test-Path $_ }
  if (-not $src) { throw "No legacy profiles found under $ROOT." }
  if (Test-Path $ZIP) { Remove-Item $ZIP -Force }
  Write-Host ("  archiving {0} profiles (this takes a minute)..." -f $src.Count)
  Compress-Archive -Path $src -DestinationPath $ZIP -CompressionLevel Optimal
  Write-Host ("  [ok] {0} ({1:N0} bytes)" -f $ZIP, (Get-Item $ZIP).Length)
}

if ($Delete) {
  Assert-Safe
  if (-not (Test-Path $ZIP)) { throw "No archive at $ZIP. Run -Archive first." }

  # Verify the archive actually holds what we are about to destroy.
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z = [IO.Compression.ZipFile]::OpenRead($ZIP)
  try {
    # Split on BOTH separators. The ZIP spec says forward slash, but
    # Compress-Archive on Windows PowerShell 5.1 writes backslashes, so a
    # '/'-only split returns the whole path and every root looks missing.
    $roots = $z.Entries | ForEach-Object { ($_.FullName -split '[/\\]')[0] } | Sort-Object -Unique
  } finally { $z.Dispose() }

  $expected = $LEGACY | Where-Object { Test-Path (Join-Path $ROOT $_) }
  $absent = $expected | Where-Object { $roots -notcontains $_ }
  if ($absent) {
    throw ("Archive is missing: {0}. Refusing to delete." -f ($absent -join ', '))
  }
  Write-Host ("  [ok] archive verified - holds {0} profile roots" -f $roots.Count)

  foreach ($p in $LEGACY) {
    $d = Join-Path $ROOT $p
    if (Test-Path $d) { Remove-Item $d -Recurse -Force; Write-Host "  [ok] removed $p" }
  }

  # Hermes records its default profile in a bare text file. If that name was
  # one of the profiles just removed, EVERY bare `hermes` call fails with
  # "Profile 'x' does not exist" -- the CLI is bricked until this is repointed.
  $activeFile = Join-Path $env:LOCALAPPDATA 'hermes\active_profile'
  if (Test-Path $activeFile) {
    $active = (Get-Content $activeFile -Raw).Trim()
    if ($LEGACY -contains $active) {
      [System.IO.File]::WriteAllText($activeFile, 'main')
      Write-Host "  [ok] active_profile was '$active' (now removed) - repointed to 'main'"
    }
  }

  Write-Host "`nRemaining profiles:"
  Get-ChildItem $ROOT -Directory | ForEach-Object { "  " + $_.Name }
}
