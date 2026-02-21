$ErrorActionPreference = 'Stop'

$url = 'https://dte.agtisa.com/api/mh/transmitir'
$payload = @{ authOnly = $true; ambiente = '00' } | ConvertTo-Json -Compress

try {
  $res = Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body $payload
  $res | ConvertTo-Json -Depth 10
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
