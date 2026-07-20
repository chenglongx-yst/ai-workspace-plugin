# plugin-clean-deep.ps1 — non-interactive deep clean subset (no Read-Host)
param(
    [Parameter(Mandatory = $true)][string]$Items,
    [switch]$ReallyDelete
)

$ErrorActionPreference = "SilentlyContinue"
$SkillRoot = Split-Path -Parent $PSCommandPath
. (Join-Path $SkillRoot "_common.ps1")

$itemList = $Items -split "," | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ }
$WhatIf = -not $ReallyDelete
$freed = 0L
$actions = [System.Collections.ArrayList]::new()

function Add-Action($label, $path, $bytes, $status) {
    [void]$script:actions.Add(@{ label = $label; path = $path; bytes = [long]$bytes; status = $status })
}

if ($itemList -contains "update_cache") {
    $updatePath = "C:\Windows\SoftwareDistribution\Download"
    $ur = if (Test-Path $updatePath) { Get-FolderSizeFast $updatePath } else { @{ Found = $false; Size = 0 } }
    $bytes = if ($ur.Found) { [long]$ur.Size } else { 0L }
    if ($WhatIf) {
        $freed += $bytes
        Add-Action "Windows Update Cache" $updatePath $bytes "preview"
    } else {
        Stop-Service wuauserv -Force -ErrorAction SilentlyContinue
        $ok = Remove-Directory -Path $updatePath -ShowProgress
        $null = New-Item -ItemType Directory -Path $updatePath -Force -ErrorAction SilentlyContinue
        Start-Service wuauserv -ErrorAction SilentlyContinue
        if ($ok) { $freed += $bytes }
        Add-Action "Windows Update Cache" $updatePath $bytes $(if ($ok) { "deleted" } else { "failed" })
    }
}

if ($itemList -contains "winsxs") {
    # Preview only via DISM analyze text; execute StartComponentCleanup when ReallyDelete
    $status = "preview"
    $bytes = 0L
    try {
        $dismOutput = Dism /Online /Cleanup-Image /AnalyzeComponentStore 2>&1
        $dismText = $dismOutput -join "`n"
        $reclaimMatch = [regex]::Match($dismText, '([\d.]+)\s*(GB|MB)')
        if ($reclaimMatch.Success) {
            $n = [double]$reclaimMatch.Groups[1].Value
            $unit = $reclaimMatch.Groups[2].Value
            $bytes = if ($unit -eq "GB") { [long]($n * 1GB) } else { [long]($n * 1MB) }
        }
        if (-not $WhatIf) {
            Dism /Online /Cleanup-Image /StartComponentCleanup | Out-Null
            $status = "deleted"
            $freed += $bytes
        } else {
            $freed += $bytes
        }
    } catch {
        $status = "failed"
    }
    Add-Action "WinSxS Component Cleanup" "WinSxS" $bytes $status
}

if ($itemList -contains "hibernate") {
    $hiberPath = "C:\hiberfil.sys"
    $bytes = 0L
    if (Test-Path $hiberPath) {
        $bytes = [long](Get-Item $hiberPath -Force).Length
    }
    if ($WhatIf) {
        $freed += $bytes
        Add-Action "Hibernate File" $hiberPath $bytes "preview"
    } else {
        powercfg.exe /hibernate off | Out-Null
        $freed += $bytes
        Add-Action "Hibernate File" $hiberPath $bytes "deleted"
    }
}

# restore_limit intentionally omitted from auto path (high risk) — only report if requested as preview
if ($itemList -contains "restore_limit") {
    Add-Action "System Restore Limit" "VSS" 0 $(if ($WhatIf) { "preview_manual" } else { "skipped_policy" })
}

$payload = @{
    ok = $true
    mode = $(if ($WhatIf) { "preview" } else { "execute" })
    freedBytes = $freed
    actions = @($actions)
}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$payload | ConvertTo-Json -Depth 5 -Compress
