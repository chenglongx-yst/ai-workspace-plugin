# plugin-quick-scan.ps1 — JSON stdout for AI-Workspace plugin (ASCII-only source)
param()

$ErrorActionPreference = "SilentlyContinue"
$SkillRoot = Split-Path -Parent $PSCommandPath
. (Join-Path $SkillRoot "_common.ps1")

function Size-Path([string]$Path) {
    if (-not (Test-Path $Path)) {
        return @{ found = $false; bytes = 0L; path = $Path }
    }
    $r = Get-FolderSizeFast $Path
    $bytes = if ($r.Found) { [long]$r.Size } else { 0L }
    return @{ found = $true; bytes = $bytes; path = $Path }
}

function Size-Files([string]$Path, [string]$Filter) {
    if (-not (Test-Path $Path)) {
        return @{ found = $false; bytes = 0L; count = 0; path = $Path }
    }
    $files = Get-ChildItem $Path -Filter $Filter -Force -ErrorAction SilentlyContinue
    $sum = ($files | Measure-Object Length -Sum).Sum
    if (-not $sum) { $sum = 0 }
    return @{ found = $true; bytes = [long]$sum; count = @($files).Count; path = $Path }
}

$disk = Get-DriveSpace
$categories = [System.Collections.ArrayList]::new()

$winTemp = Size-Path "C:\Windows\Temp"
$doPath = "C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization"
$delivery = Size-Path $doPath
$thumb = Size-Files "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" "*.db"
$sysBytes = [long]$winTemp.bytes + [long]$delivery.bytes + [long]$thumb.bytes
[void]$categories.Add(@{
    id = "system_cache"
    nameKey = "system_cache"
    bytes = $sysBytes
    itemCount = 3
    risk = "safe"
    selectedDefault = $true
    paths = @($winTemp.path, $delivery.path, $thumb.path)
})

$userTemp = Size-Path "$env:LOCALAPPDATA\Temp"
[void]$categories.Add(@{
    id = "temp_files"
    nameKey = "temp_files"
    bytes = [long]$userTemp.bytes
    itemCount = 1
    risk = "safe"
    selectedDefault = $true
    paths = @($userTemp.path)
})

$dl = Size-Path "$env:USERPROFILE\Downloads"
[void]$categories.Add(@{
    id = "downloads"
    nameKey = "downloads"
    bytes = [long]$dl.bytes
    itemCount = 1
    risk = "cautious"
    selectedDefault = $false
    paths = @($dl.path)
})

$wer = Size-Path "C:\ProgramData\Microsoft\Windows\WER"
[void]$categories.Add(@{
    id = "log_files"
    nameKey = "log_files"
    bytes = [long]$wer.bytes
    itemCount = 1
    risk = "safe"
    selectedDefault = $true
    paths = @($wer.path)
})

$rbBytes = 0L
$rbCount = 0
try {
    $shell = New-Object -ComObject Shell.Application
    $rbNs = $shell.NameSpace(0xA)
    if ($rbNs) {
        foreach ($item in @($rbNs.Items())) {
            $rbCount++
            $rbBytes += [long]$item.Size
        }
    }
} catch {
    try {
        $rb = Get-ChildItem "C:\`$Recycle.Bin" -Force -ErrorAction SilentlyContinue
        foreach ($sid in @($rb)) {
            $files = Get-ChildItem $sid.FullName -Recurse -File -Force -ErrorAction SilentlyContinue
            $rbCount += @($files).Count
            $rbBytes += [long](($files | Measure-Object Length -Sum).Sum)
        }
    } catch {}
}
[void]$categories.Add(@{
    id = "recycle_bin"
    nameKey = "recycle_bin"
    bytes = $rbBytes
    itemCount = $rbCount
    risk = "safe"
    selectedDefault = $true
    paths = @("C:\`$Recycle.Bin")
})

$pf = Size-Path "C:\Windows\Prefetch"
[void]$categories.Add(@{
    id = "other_junk"
    nameKey = "other_junk"
    bytes = [long]$pf.bytes
    itemCount = 1
    risk = "cautious"
    selectedDefault = $false
    paths = @($pf.path)
})

$safeBytes = 0L
$totalJunk = 0L
foreach ($c in $categories) {
    $totalJunk += [long]$c.bytes
    if ($c.risk -eq "safe") { $safeBytes += [long]$c.bytes }
}

$payload = @{
    ok = $true
    scannedAt = (Get-Date).ToString("o")
    disk = @{
        totalBytes = [long]($disk.TotalGB * 1GB)
        usedBytes  = [long]($disk.UsedGB * 1GB)
        freeBytes  = [long]($disk.FreeGB * 1GB)
        usedPercent = $disk.UsedPercent
        totalGB = $disk.TotalGB
        usedGB = $disk.UsedGB
        freeGB = $disk.FreeGB
    }
    freeableBytes = $safeBytes
    junkBytes = $totalJunk
    categories = @($categories)
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$payload | ConvertTo-Json -Depth 6 -Compress
