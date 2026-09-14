# Gera um certificado autoassinado para o MEMÓRIA responder em HTTPS nesta
# máquina, e libera a porta HTTPS no firewall para a rede/VPN. Necessário para
# notificações de área de trabalho (Web Push): navegadores só expõem
# Service Worker / Notification / PushManager em "contexto seguro"
# (HTTPS ou localhost) — em HTTP puro por IP essas APIs simplesmente não
# existem, mesmo em navegadores que as suportam.
#
# Execute como Administrador, a partir de qualquer pasta:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-https-cert.ps1
#
# Usa certreq (não New-SelfSignedCertificate) porque o acesso é por IP, não
# por nome de domínio: navegadores modernos só validam um certificado contra
# um IP se o IP estiver no Subject Alternative Name como entrada do tipo
# "IP Address" — New-SelfSignedCertificate só sabe gerar entradas "DNS Name",
# que o Chrome/Edge rejeitam para acesso por IP mesmo com o aviso de
# autoassinado aceito. certreq com RequestType=Cert cria e instala um
# certificado self-signed igual, mas com controle total da extensão SAN.
#
# Sendo autoassinado, o navegador vai mostrar um aviso de "conexão não é
# privada" na primeira visita — clique em Avançado > Continuar (ou instale
# scripts\certs\memoria.cer como "Autoridade de Certificação Raiz Confiável"
# nas máquinas que forem acessar o app, pra não ver o aviso de novo).
#
# Reversão:
#   Remove-Item -Recurse -Force .\scripts\certs
#   Remove-NetFirewallRule -DisplayName "Memoria App HTTPS"
#   Get-ChildItem Cert:\LocalMachine\My | Where-Object Subject -eq "CN=memoria-app" | Remove-Item

$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$certsDir = Join-Path $PSScriptRoot "certs"
# Porta HTTPS padrão (443, sem precisar digitar porta na URL) — não usar uma
# porta não padrão como 3443: em pelo menos um teste real numa VPN corporativa
# isso resultou em ERR_EMPTY_RESPONSE, provavelmente um appliance de rede que
# só deixa passar tráfego nas portas web padrão (80/443).
$httpsPort = 443

if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
}

# Monta a lista de nomes/IPs cobertos pelo certificado a partir do .env.
$envPath = Join-Path $projectDir ".env"
$devOrigins = @()
if (Test-Path $envPath) {
    $line = (Get-Content $envPath | Where-Object { $_ -match "^DEV_ALLOWED_ORIGINS=" })
    if ($line) {
        $value = ($line -replace "^DEV_ALLOWED_ORIGINS=", "").Trim()
        if ($value) { $devOrigins = $value.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
    }
}

$dnsNames = @("localhost", $env:COMPUTERNAME) | Select-Object -Unique
$ipAddresses = @("127.0.0.1") + $devOrigins | Where-Object {
    ([System.Net.IPAddress]$parsed = $null); [System.Net.IPAddress]::TryParse($_, [ref]$parsed)
} | Select-Object -Unique

Write-Host "Gerando certificado autoassinado — DNS: $($dnsNames -join ', ') | IP: $($ipAddresses -join ', ')"

# Remove certificados de execuções anteriores deste script pra não acumular
# lixo no repositório de certificados da máquina a cada vez que é rodado.
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -eq "CN=memoria-app" } | Remove-Item -Force

$sanLines = @()
$dnsNames | ForEach-Object { $sanLines += ('_continue_ = "dns=' + $_ + '&"') }
$ipAddresses | ForEach-Object { $sanLines += ('_continue_ = "ipaddress=' + $_ + '&"') }

# Chrome recusa (sem opção de "continuar mesmo assim") qualquer certificado —
# mesmo autoassinado — com validade acima de ~825 dias
# (NET::ERR_CERT_VALIDITY_TOO_LONG, que aparece disfarçado de ERR_CERT_INVALID
# genérico, sem o link de avançado/prosseguir). 2 anos fica com folga desse
# limite; é preciso rodar este script de novo antes de vencer.
$sanBlock = $sanLines -join "`r`n"
$infPath = Join-Path $certsDir "memoria.inf"
$infContent = @"
[Version]
Signature = "`$Windows NT`$"

[NewRequest]
Subject = "CN=memoria-app"
KeySpec = 1
KeyLength = 2048
Exportable = TRUE
MachineKeySet = TRUE
SMIME = FALSE
PrivateKeyArchive = FALSE
UserProtected = FALSE
UseExistingKeySet = FALSE
ProviderName = "Microsoft RSA SChannel Cryptographic Provider"
ProviderType = 12
RequestType = Cert
KeyUsage = 0xa0
ValidityPeriod = Years
ValidityPeriodUnits = 2

[Extensions]
2.5.29.17 = "{text}"
$sanBlock

2.5.29.19 = "{text}ca=0"

2.5.29.37 = "{text}"
_continue_ = "1.3.6.1.5.5.7.3.1"
"@

Set-Content -Path $infPath -Value $infContent -Encoding ASCII

$certreqOutPath = Join-Path $certsDir "memoria-certreq-output.cer"
if (Test-Path $certreqOutPath) { Remove-Item $certreqOutPath -Force }
certreq -q -new $infPath $certreqOutPath | Out-Null
Remove-Item $infPath -Force

$cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -eq "CN=memoria-app" } | Sort-Object NotBefore -Descending | Select-Object -First 1
if (-not $cert) { throw "certreq não instalou o certificado esperado em Cert:\LocalMachine\My — veja a saída do certreq acima." }

$pfxPath = Join-Path $certsDir "memoria.pfx"
$cerPath = Join-Path $certsDir "memoria.cer"
Remove-Item $pfxPath, $cerPath, $certreqOutPath -Force -ErrorAction SilentlyContinue

# Senha aleatória só para proteger o arquivo .pfx em repouso — guardada no
# .env (fora do git) para o server.ts conseguir abrir o certificado.
$chars = (48..57) + (65..90) + (97..122)
$passphrase = -join ((1..24) | ForEach-Object { [char](Get-Random -InputObject $chars) })
$securePwd = ConvertTo-SecureString -String $passphrase -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePwd | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

Write-Host "Liberando porta $httpsPort no firewall para 10.250.240.0/24 e 10.250.250.0/24..."
if (-not (Get-NetFirewallRule -DisplayName "Memoria App HTTPS" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "Memoria App HTTPS" `
        -Direction Inbound -Protocol TCP -LocalPort $httpsPort -Action Allow `
        -RemoteAddress 10.250.240.0/24, 10.250.250.0/24 | Out-Null
} else {
    Write-Host "Regra de firewall já existe, pulando."
}

# Atualiza o .env com o caminho do certificado, a senha e a porta — sem isso
# server.ts não sobe o listener HTTPS (ele só ativa quando HTTPS_PFX_PATH
# existe, pra não quebrar quem ainda não gerou certificado nenhum).
function Set-EnvVar([string]$Path, [string]$Key, [string]$Value) {
    $content = Get-Content $Path -Raw
    $pattern = "(?m)^$Key=.*$"
    if ($content -match $pattern) {
        $content = $content -replace $pattern, "$Key=$Value"
    } else {
        $content = $content.TrimEnd() + "`r`n$Key=$Value`r`n"
    }
    Set-Content -Path $Path -Value $content -NoNewline
}

Set-EnvVar -Path $envPath -Key "HTTPS_PORT" -Value $httpsPort
Set-EnvVar -Path $envPath -Key "HTTPS_PFX_PATH" -Value ($pfxPath -replace "\\", "/")
Set-EnvVar -Path $envPath -Key "HTTPS_PFX_PASSPHRASE" -Value $passphrase

Write-Host ""
Write-Host "Pronto. Certificado em $pfxPath (senha gravada em .env, não versionada)."
Write-Host "Reinicie o serviço (ou npm run start) para o HTTPS entrar no ar."
Write-Host ""
Write-Host "Acesse em: https://10.250.240.125:$httpsPort"
Write-Host "O navegador vai avisar que a conexão não é confiável (certificado autoassinado)"
Write-Host "-- isso é esperado, clique em Avançado > Continuar. Para não ver o aviso de novo,"
Write-Host "instale $cerPath como 'Autoridade de Certificação Raiz Confiável' nas máquinas que acessarem o app."
