# تست فشار هم‌زمانی: هر سناریو با چند ده پروسس جدا که در یک لحظه شروع می‌کنند
# اجرا از پوشه‌ی backend:  powershell -File tests\Stress\run.ps1 [-Workers 30]
param([int]$Workers = 30)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path "$here\..\.."
Set-Location $root
php tests/Stress/stress.php setup $Workers | Out-Null

function Run-Scenario($name, $n, $json) {
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  $at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000 + 6
  $jobs = 1..$n | ForEach-Object { Start-Job -ScriptBlock { param($r, $s, $i, $t, $p) Set-Location $r; php tests/Stress/stress.php work $s $i $t $p } -ArgumentList $root, $name, $_, $at, $b64 }
  $out = $jobs | Wait-Job | Receive-Job; $jobs | Remove-Job
  $check = php tests/Stress/stress.php check $name $b64 | ConvertFrom-Json
  [pscustomobject]@{ scenario = $name; workers = $n; results = (($out | Group-Object | ForEach-Object { "$($_.Count)x $($_.Name)" }) -join ', '); check = ($check | ConvertTo-Json -Compress) }
}

$report = @()
foreach ($s in 'slot', 'stock', 'cafe', 'event', 'join', 'wallet') {
  $json = php tests/Stress/stress.php prep $s
  $n = if ($s -eq 'wallet') { 12 } else { $Workers }
  $report += Run-Scenario $s $n $json
}
# ترکیب تصادفی: رزرو، کافه، فروشگاه، بازی باز با هم
$slot = (php tests/Stress/stress.php prep wallet | ConvertFrom-Json).slots
$stock = php tests/Stress/stress.php prep stock | ConvertFrom-Json
php tests/Stress/stress.php prep cafe | Out-Null
$mixed = @{ slots = $slot; pid = $stock.pid; size = $stock.size; color = $stock.color; sku = $stock.sku } | ConvertTo-Json -Compress -Depth 5
$report += Run-Scenario 'mixed' $Workers $mixed
$report | Format-List
