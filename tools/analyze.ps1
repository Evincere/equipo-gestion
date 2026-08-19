# PowerShell script to analyze the CSV data
$csvPath = Join-Path -Path $PSScriptRoot -ChildPath "atenciones.csv"

# Load the CSV
$data = Import-Csv -Path $csvPath

# Date range analysis
$dates = $data | ForEach-Object { $_."108487/25" } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$parsedDates = New-Object System.Collections.Generic.List[DateTime]
$failedDates = New-Object System.Collections.Generic.List[string]

$formats = @(
    "dd/MM/yyyy", "dd/MM/yy", "d/M/yyyy", "d/M/yy",
    "yyyy/MM/dd", "yyyy-MM-dd", "yyyy/M/d", "yyyy-M-d",
    "dd-MM-yyyy", "dd-MM-yy"
)

foreach ($d in $dates) {
    $cleanD = $d.Trim()
    $success = $false
    $parsed = $null
    
    # Try parsing with explicit formats
    foreach ($fmt in $formats) {
        try {
            $parsed = [DateTime]::ParseExact($cleanD, $fmt, [System.Globalization.CultureInfo]::InvariantCulture)
            $success = $true
            break
        } catch {
            # Continue trying formats
        }
    }
    
    # Fallback to general parsing if explicit formats fail
    if (-not $success) {
        try {
            $parsed = [DateTime]::Parse($cleanD)
            $success = $true
        } catch {
            $success = $false
        }
    }
    
    if ($success) {
        $parsedDates.Add($parsed)
    } else {
        $failedDates.Add($cleanD)
    }
}

Write-Host "--- Robust Date Analysis ---"
Write-Host "Total records with date: $($dates.Count)"
Write-Host "Successfully parsed: $($parsedDates.Count)"
Write-Host "Failed to parse: $($failedDates.Count)"

if ($parsedDates.Count -gt 0) {
    $sortedDates = $parsedDates | Sort-Object
    Write-Host "Earliest Date: $($sortedDates[0].ToString('yyyy-MM-dd'))"
    Write-Host "Latest Date: $($sortedDates[-1].ToString('yyyy-MM-dd'))"
    
    Write-Host "`n--- Records by Year/Month ---"
    $sortedDates | Group-Object { $_.ToString("yyyy-MM") } | Sort-Object Name | Select-Object Name, Count | Format-Table -AutoSize
}

if ($failedDates.Count -gt 0) {
    Write-Host "`n--- Sample Failed Dates (first 15) ---"
    $failedDates | Select-Object -Unique | Select-Object -First 15
}
