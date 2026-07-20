# plugin-clean-safe.ps1 — non-interactive safe clean for selected category ids
param(
    [Parameter(Mandatory = $true)][string]$CategoryIds,
    [switch]$ReallyDelete
)

$ErrorActionPreference = "SilentlyContinue"
$SkillRoot = Split-Path -Parent $PSCommandPath
. (Join-Path $SkillRoot "_common.ps1")

$ids = $CategoryIds -split "," | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ }
$WhatIf = -not $ReallyDelete
$freed = 0L
$actions = [System.Collections.ArrayList]::new()

function Clean-Dir {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path $Path)) {
        [void]$script:actions.Add(@{ path = $Path; label = $Label; bytes = 0; status = "skipped" })
        return
    }
    $r = Get-FolderSizeFast $Path
    $bytes = if ($r.Found) { [long]$r.Size } else { 0L }
    if ($bytes -le 0) {
        [void]$script:actions.Add(@{ path = $Path; label = $Label; bytes = 0; status = "empty" })
        return
    }
    if (-not $WhatIf) {
        $ok = Remove-Directory -Path $Path -ShowProgress
        if ($ok) { $script:freed += $bytes }
        [void]$script:actions.Add(@{ path = $Path; label = $Label; bytes = $bytes; status = $(if ($ok) { "deleted" } else { "failed" }) })
    } else {
        $script:freed += $bytes
        [void]$script:actions.Add(@{ path = $Path; label = $Label; bytes = $bytes; status = "preview" })
    }
}

if ($ids -contains "system_cache") {
    Clean-Dir "C:\Windows\Temp" "Windows Temp"
    $doPath = "C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization"
    Clean-Dir $doPath "Delivery Optimization"
    $thumbPath = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
    if (Test-Path $thumbPath) {
        $thumbFiles = Get-ChildItem $thumbPath -Filter "*.db" -ErrorAction SilentlyContinue
        $thumbSize = [long](($thumbFiles | Measure-Object Length -Sum).Sum)
        if ($thumbSize -gt 0) {
            if (-not $WhatIf) { $thumbFiles | Remove-Item -Force -ErrorAction SilentlyContinue }
            $freed += $thumbSize
            [void]$actions.Add(@{ path = $thumbPath; label = "Thumbnails"; bytes = $thumbSize; status = $(if ($WhatIf) { "preview" } else { "deleted" }) })
        }
    }
}

if ($ids -contains "temp_files") {
    Clean-Dir "$env:LOCALAPPDATA\Temp" "User Temp"
}

if ($ids -contains "log_files") {
    Clean-Dir "C:\ProgramData\Microsoft\Windows\WER" "Windows Error Reporting"
}

if ($ids -contains "recycle_bin") {
    $rbBytes = 0L
    try {
        $rb = Get-ChildItem "C:\`$Recycle.Bin" -Recurse -Force -ErrorAction SilentlyContinue
        $rbBytes = [long]((@($rb | Where-Object { -not $_.PSIsContainer }) | Measure-Object Length -Sum).Sum)
    } catch {}
    if (-not $WhatIf) {
        Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    }
    $freed += $rbBytes
    [void]$actions.Add(@{ path = "Recycle.Bin"; label = "Recycle Bin"; bytes = $rbBytes; status = $(if ($WhatIf) { "preview" } else { "deleted" }) })
}

# downloads / other_junk intentionally NOT cleaned by safe path

$payload = @{
    ok = $true
    mode = $(if ($WhatIf) { "preview" } else { "execute" })
    freedBytes = $freed
    actions = @($actions)
}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$payload | ConvertTo-Json -Depth 5 -Compress
