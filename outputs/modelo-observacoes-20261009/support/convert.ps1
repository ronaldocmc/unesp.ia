$ErrorActionPreference = 'Stop'
$sourceFile = Join-Path $PSScriptRoot 'modelo_observacoes.xlsx'
$targetFile = Join-Path (Split-Path $PSScriptRoot -Parent) 'modelo_observacoes.xls'
$excelInstance = $null
$book = $null
$sheet = $null
try {
    $excelInstance = New-Object -ComObject Excel.Application
    $excelInstance.Visible = $false
    $excelInstance.DisplayAlerts = $false
    $excelInstance.AutomationSecurity = 3
    $book = $excelInstance.Workbooks.Open($sourceFile, 0, $false)
    $sheet = $book.Worksheets.Item(1)
    $sheet.Range('A1:X21').AutoFilter() | Out-Null
    $book.SaveAs($targetFile, 56)
    $book.Close($false)
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheet) | Out-Null
    $sheet = $null
    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) | Out-Null
    $book = $excelInstance.Workbooks.Open($targetFile, 0, $true)
    $sheet = $book.Worksheets.Item(1)
    $headerCount = $excelInstance.WorksheetFunction.CountA($sheet.Range('A1:X1'))
    $dataCount = $excelInstance.WorksheetFunction.CountA($sheet.Range('A2:X21'))
    if ($headerCount -ne 24 -or $dataCount -ne 0) { throw 'Cabeçalhos ou linhas vazias não foram preservados.' }
    Write-Output "XLS validado: $headerCount cabeçalhos, $dataCount células preenchidas nas linhas de dados."
    Write-Output $targetFile
} finally {
    if ($book) { $book.Close($false) }
    if ($sheet) { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheet) | Out-Null }
    if ($book) { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) | Out-Null }
    if ($excelInstance) { $excelInstance.Quit(); [Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelInstance) | Out-Null }
}
