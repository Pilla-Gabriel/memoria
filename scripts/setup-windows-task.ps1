# Deixa o MEMÓRIA no ar permanentemente nesta máquina Windows: libera a porta
# 3000 no firewall para a rede/VPN e registra uma tarefa agendada que builda
# e sobe o servidor de produção (npm run start) no boot e sempre que o
# processo cair. Execute como Administrador (PowerShell -> "Executar como
# administrador"), a partir de qualquer pasta.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows-task.ps1
#
# Reversão:
#   Unregister-ScheduledTask -TaskName "MemoriaApp" -Confirm:$false
#   Remove-NetFirewallRule -DisplayName "Memoria App (TCP 3000)"

$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot

Write-Host "Liberando porta 3000 no firewall para 10.250.240.0/24 e 10.250.250.0/24..."
if (-not (Get-NetFirewallRule -DisplayName "Memoria App (TCP 3000)" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "Memoria App (TCP 3000)" `
        -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow `
        -RemoteAddress 10.250.240.0/24, 10.250.250.0/24 | Out-Null
} else {
    Write-Host "Regra de firewall já existe, pulando."
}

Write-Host "Registrando tarefa agendada 'MemoriaApp' (builda + sobe no boot, reinicia sozinha se cair)..."
# O serviço "Task Scheduler" guarda um snapshot do PATH capturado no boot/início
# do serviço — instalações feitas depois (ex.: nvm4w) não aparecem para tarefas
# rodando como SYSTEM até o próximo reboot, mesmo já estando no PATH da máquina.
# O run-service.bat já recebe a pasta do Node fixada (substituída abaixo) pra
# não depender disso.
#
# O RestartCount/RestartInterval do Task Scheduler é o mecanismo "oficial" de
# retry, mas na prática não dispara de forma confiável quando o processo do
# servidor cai sozinho (validado nesta máquina) — por isso o loop de reinício
# vive dentro do run-service.bat, que nunca termina.
#
# run-service.bat é o template versionado (com o placeholder __NODE_DIR__);
# geramos run-service.generated.bat com o caminho real desta máquina em vez de
# sobrescrever o template, pra não deixar um path específico de máquina preso
# no arquivo versionado.
$nodeDir = Split-Path -Parent (Get-Command node).Source
$batTemplate = Join-Path $PSScriptRoot "run-service.bat"
$batGenerated = Join-Path $PSScriptRoot "run-service.generated.bat"
(Get-Content $batTemplate -Raw) -replace [regex]::Escape("__NODE_DIR__"), $nodeDir | Set-Content $batGenerated -NoNewline

$action = New-ScheduledTaskAction `
    -Execute $batGenerated `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName "MemoriaApp" -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force `
    -Description "MEMORIA - servidor Next.js custom (server.ts) com agendador de check-ins/alertas/Azure DevOps" | Out-Null

Write-Host "Iniciando agora (sem esperar o próximo boot)..."
Start-ScheduledTask -TaskName "MemoriaApp"

Write-Host ""
Write-Host "Pronto. Acompanhe o log em: $projectDir\service.log"
Write-Host "Acesse em: http://10.250.240.125:3000"
Write-Host "Status da tarefa: Get-ScheduledTaskInfo -TaskName MemoriaApp"
