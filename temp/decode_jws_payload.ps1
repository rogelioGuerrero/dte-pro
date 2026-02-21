param(
  [string]$JwsFile = (Join-Path $PSScriptRoot 'mh_jws_example.txt')
)

$ErrorActionPreference = 'Stop'

$jws = (Get-Content -Raw -Path $JwsFile).Trim()
$parts = $jws.Split('.')
Write-Host ("Parts: {0}" -f $parts.Length)
if ($parts.Length -lt 2) { throw 'JWS inválido: faltan partes' }

$payload = $parts[1].Replace('-', '+').Replace('_', '/')
while (($payload.Length % 4) -ne 0) { $payload += '=' }

$bytes = [System.Convert]::FromBase64String($payload)
$txt = [System.Text.Encoding]::UTF8.GetString($bytes)

Write-Host '--- payload (primeros 600 chars) ---'
Write-Host ($txt.Substring(0, [Math]::Min(600, $txt.Length)))

try {
  $obj = $txt | ConvertFrom-Json
  Write-Host '--- identificacion ---'
  $obj.identificacion | ConvertTo-Json -Depth 10
} catch {
  Write-Host 'No es JSON parseable'
}
