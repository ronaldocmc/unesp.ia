[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$KeyPath,

    [string]$HostName = '200.145.184.28',
    [int]$Port = 2232,
    [string]$UserName = 'iafct',
    [string]$DeployPath = '/var/www/html/unesp.ia',
    [string]$ReleasesPath = '/home/iafct/deployments/unesp-ia/releases',
    [string]$KnownHostsPath = (Join-Path $PSScriptRoot '..\deploy\known_hosts')
)

$ErrorActionPreference = 'Stop'

function Assert-ExitCode {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) {
        throw "$Step falhou com o código $LASTEXITCODE."
    }
}

foreach ($path in @($KeyPath, $KnownHostsPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Arquivo não encontrado: $path"
    }
}

foreach ($value in @($HostName, $UserName, $DeployPath, $ReleasesPath)) {
    if ($value -match "['`r`n]") {
        throw 'Os parâmetros do destino não podem conter aspas simples ou quebras de linha.'
    }
}

$git = (Get-Command git.exe -ErrorAction Stop).Source
$ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
$scp = (Get-Command scp.exe -ErrorAction Stop).Source
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedKeyPath = (Resolve-Path -LiteralPath $KeyPath).Path
$resolvedKnownHostsPath = (Resolve-Path -LiteralPath $KnownHostsPath).Path

Push-Location $repositoryRoot
try {
    $commit = (& $git rev-parse HEAD).Trim()
    Assert-ExitCode 'Leitura do commit local'

    $remoteLine = & $git ls-remote --exit-code origin refs/heads/main
    Assert-ExitCode 'Consulta ao branch main no GitHub'
    $remoteCommit = ($remoteLine -split '\s+')[0]
    if ($remoteCommit -ne $commit) {
        throw "O commit local $commit ainda não é o commit publicado em origin/main ($remoteCommit). Faça o push antes do deploy."
    }

    $releaseId = "$commit-local-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $packageName = "unesp-ia-$releaseId.tar.gz"
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $tempDirectory = Join-Path $tempRoot "unesp-ia-deploy-$([Guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $tempDirectory | Out-Null
    $packagePath = Join-Path $tempDirectory $packageName

    try {
        $archivePaths = @(
            '.',
            ':(exclude).github',
            ':(exclude).agents',
            ':(exclude).codex',
            ':(exclude)deploy',
            ':(exclude)supabase',
            ':(exclude)scripts',
            ':(exclude)modulos_v3_original',
            ':(exclude)personagens_v5',
            ':(exclude)README*.md',
            ':(exclude)DEPLOY_SERVIDOR.md',
            ':(exclude)*.sql',
            ':(exclude)*.log'
        )
        & $git archive --format=tar.gz --output=$packagePath HEAD -- @archivePaths
        Assert-ExitCode 'Criação do pacote público'

        $connectionOptions = @(
            '-i', $resolvedKeyPath,
            '-p', $Port,
            '-o', 'BatchMode=yes',
            '-o', 'IdentitiesOnly=yes',
            '-o', 'StrictHostKeyChecking=yes',
            '-o', "UserKnownHostsFile=$resolvedKnownHostsPath",
            '-o', 'ConnectTimeout=15'
        )

        $scpOptions = @(
            '-i', $resolvedKeyPath,
            '-P', $Port,
            '-o', 'BatchMode=yes',
            '-o', 'IdentitiesOnly=yes',
            '-o', 'StrictHostKeyChecking=yes',
            '-o', "UserKnownHostsFile=$resolvedKnownHostsPath",
            '-o', 'ConnectTimeout=15'
        )

        & $scp @scpOptions $packagePath "${UserName}@${HostName}:$packageName"
        Assert-ExitCode 'Envio do pacote ao servidor'

        $remoteScript = @'
set -euo pipefail
base_path="$1"
releases_path="$2"
release_id="$3"
package_name="$4"
release_path="$releases_path/$release_id"

mkdir -p "$releases_path"
test ! -e "$release_path" || { echo "A versão $release_id já existe no servidor."; exit 1; }
mkdir -p "$release_path"
tar -xzf "$HOME/$package_name" -C "$release_path"
test -f "$release_path/index.html"

rsync -a --delete-delay --delay-updates \
  --exclude '.deploy-managed' \
  "$release_path/" "$base_path/"
printf '%s\n' "$release_id" > "$base_path/.deploy-managed"
rm -f "$HOME/$package_name"
printf 'Versão %s ativada em %s\n' "$release_id" "$base_path"
'@

        $remoteScript | & $ssh @connectionOptions "${UserName}@${HostName}" "bash -s -- '$DeployPath' '$ReleasesPath' '$releaseId' '$packageName'"
        Assert-ExitCode 'Ativação da versão no servidor'

        Write-Host "Deploy concluído: $releaseId"
    }
    finally {
        $resolvedTemp = [IO.Path]::GetFullPath($tempDirectory)
        if ($resolvedTemp.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and
            (Test-Path -LiteralPath $resolvedTemp)) {
            Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
        }
    }
}
finally {
    Pop-Location
}
