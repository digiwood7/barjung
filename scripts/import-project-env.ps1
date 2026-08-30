$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentFile = Join-Path $ProjectRoot ".env.local"

if (-not (Test-Path $EnvironmentFile)) { return }

Get-Content $EnvironmentFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $parts = $line.Split("=", 2)
  if ($parts.Count -ne 2) { return }
  $name = $parts[0].Trim()
  $value = $parts[1].Trim()
  if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$') {
    Set-Item -Path "Env:$name" -Value $value
  }
}
