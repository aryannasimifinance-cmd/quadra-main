# تست فشار بخش‌ها (مربی، کافه، اعضا، آدینه، حسابداری) — از پوشه‌ی backend:
#   powershell -File tests\Stress\run2.ps1 [-Workers 40]
param([int]$Workers = 40)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$(Split-Path -Parent $MyInvocation.MyCommand.Path)\..\.."
Set-Location $root
php tests/Stress/stress2.php setup ($Workers + 2) | Out-Null
$report = @()
foreach ($s in 'coachSlot', 'coachApprove', 'cafeShared', 'signup', 'deskMember', 'username', 'friday', 'unreg', 'books') {
  $json = php tests/Stress/stress2.php prep $s $Workers
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  $at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000 + 7
  $jobs = 1..$Workers | ForEach-Object { Start-Job -ScriptBlock { param($r, $s, $i, $t, $p) Set-Location $r; php tests/Stress/stress2.php work $s $i $t $p } -ArgumentList $root, $s, $_, $at, $b64 }
  $out = $jobs | Wait-Job | Receive-Job; $jobs | Remove-Job
  $check = php tests/Stress/stress2.php check $s $Workers $b64
  $report += [pscustomobject]@{ scenario = $s; results = (($out | Group-Object | ForEach-Object { "$($_.Count)x $($_.Name)" }) -join ', '); check = $check }
}
$report | Format-List
