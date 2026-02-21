param(
  [string]$JwsFile = (Join-Path $PSScriptRoot 'mh_jws_example.txt'),
  [string]$Jws = '',
  [ValidateSet('00', '01')][string]$Ambiente = '00'
)

$ErrorActionPreference = 'Stop'

if (-not $Jws -or $Jws.Trim().Length -eq 0) {
  if (-not (Test-Path -Path $JwsFile)) {
    throw "No se encontró el archivo de JWS: '$JwsFile'. Pasá -JwsFile <ruta> o -Jws <jws>"
  }
  $Jws = (Get-Content -Raw -Path $JwsFile).Trim()
}

$url = 'https://dte.agtisa.com/api/mh/transmitir'

$payload = @{ dte = $Jws; ambiente = $Ambiente } | ConvertTo-Json -Compress

try {
  $res = Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body $payload
  $res | ConvertTo-Json -Depth 30
} catch {
  if ($_.Exception.Response) {
    $status = [int]$_.Exception.Response.StatusCode
    Write-Host ("HTTP {0}" -f $status)
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $sr.ReadToEnd()
  } else {
    throw
  }
}
