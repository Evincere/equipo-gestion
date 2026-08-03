# PowerShell script to run a full analysis on atenciones.csv
$csvPath = Join-Path -Path $PSScriptRoot -ChildPath "atenciones.csv"
$data = Import-Csv -Path $csvPath

# Helper to clean strings
function Clean-String($str) {
    if ([string]::IsNullOrWhiteSpace($str)) { return "N/A" }
    return $str.Trim()
}

Write-Host "=============================================="
Write-Host "      ANALISIS COMPLETO DE LA PLANILLA        "
Write-Host "=============================================="
Write-Host "Total de registros analizados: $($data.Count)"

# Dates
$dates = $data | ForEach-Object { $_."108487/25" } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
$parsedDates = New-Object System.Collections.Generic.List[DateTime]
$formats = @("dd/MM/yyyy", "dd/MM/yy", "d/M/yyyy", "d/M/yy", "yyyy/MM/dd", "yyyy-MM-dd", "yyyy/M/d", "yyyy-M-d", "dd-MM-yyyy", "dd-MM-yy")

foreach ($d in $dates) {
    $cleanD = $d.Trim()
    $parsed = $null
    $success = $false
    foreach ($fmt in $formats) {
        try {
            $parsed = [DateTime]::ParseExact($cleanD, $fmt, [System.Globalization.CultureInfo]::InvariantCulture)
            $success = $true
            break
        } catch {}
    }
    if (-not $success) {
        try {
            $parsed = [DateTime]::Parse($cleanD)
            $success = $true
        } catch {}
    }
    if ($success) { $parsedDates.Add($parsed) }
}

if ($parsedDates.Count -gt 0) {
    $sorted = $parsedDates | Sort-Object
    Write-Host "Rango de fechas: desde $($sorted[0].ToString('dd/MM/yyyy')) hasta $($sorted[-1].ToString('dd/MM/yyyy'))"
}

# 1. Actividades
Write-Host "`n[1] Distribucion por Tipo de Actividad:"
$data | Group-Object -Property "Actividad" | Sort-Object Count -Descending | ForEach-Object {
    $percent = [math]::Round(($_.Count / $data.Count) * 100, 2)
    $name = Clean-String $_.Name
    Write-Host " - $($name): $($_.Count) ($percent%)"
}

# 2. Defensorias
Write-Host "`n[2] Distribucion por Defensoria / Area (Top 10):"
$data | Group-Object -Property "Defensoria" | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object {
    $percent = [math]::Round(($_.Count / $data.Count) * 100, 2)
    $name = Clean-String $_.Name
    Write-Host " - $($name): $($_.Count) ($percent%)"
}

# 3. Personal
Write-Host "`n[3] Personal que Atiende (Top 10):"
$data | Group-Object -Property "Atendido por:" | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object {
    $percent = [math]::Round(($_.Count / $data.Count) * 100, 2)
    $name = Clean-String $_.Name
    Write-Host " - $($name): $($_.Count) ($percent%)"
}

# 4. Resultados
Write-Host "`n[4] Resolucion / Resultado de la Atencion:"
$data | Group-Object -Property "Resultado" | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object {
    $percent = [math]::Round(($_.Count / $data.Count) * 100, 2)
    $name = Clean-String $_.Name
    Write-Host " - $($name): $($_.Count) ($percent%)"
}

# 5. Escritos
$escritos = $data | Where-Object { -not [string]::IsNullOrWhiteSpace($_."Escritos realizados") }
Write-Host "`n[5] Registro de Escritos Realizados:"
$escritosPercent = [math]::Round(($escritos.Count / $data.Count) * 100, 2)
Write-Host " - Atenciones con escritos registrados: $($escritos.Count) ($escritosPercent%)"
if ($escritos.Count -gt 0) {
    Write-Host " - Muestra de algunos escritos:"
    $escritos | Select-Object -First 5 | ForEach-Object {
        $escVal = Clean-String $_."Escritos realizados"
        Write-Host "   * [DNI: $($_.DNI)] [Apellidos: $($_.Apellidos)] Escrito: $escVal"
    }
}
