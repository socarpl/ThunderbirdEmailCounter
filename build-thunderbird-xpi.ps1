param(
    [string]$SourceDir = ".\thunderbird-extension",
    [string]$OutputPath = ".\mailbox-sender-report.xpi"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath $SourceDir).Path
$rootWithSeparator = if ($root.EndsWith([System.IO.Path]::DirectorySeparatorChar)) { $root } else { "$root\" }
$destination = Join-Path -Path (Get-Location) -ChildPath $OutputPath

if (Test-Path -LiteralPath $destination) {
    Remove-Item -LiteralPath $destination -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$fileStream = [System.IO.File]::Open($destination, [System.IO.FileMode]::CreateNew)
try {
    $archive = New-Object System.IO.Compression.ZipArchive(
        $fileStream,
        [System.IO.Compression.ZipArchiveMode]::Create,
        $false
    )

    try {
        $files = Get-ChildItem -LiteralPath $root -Recurse -File
        foreach ($file in $files) {
            $relative = $file.FullName.Substring($rootWithSeparator.Length)
            $entryName = $relative -replace "\\", "/"
            $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)

            $entryStream = $entry.Open()
            try {
                $sourceStream = [System.IO.File]::OpenRead($file.FullName)
                try {
                    $sourceStream.CopyTo($entryStream)
                }
                finally {
                    $sourceStream.Dispose()
                }
            }
            finally {
                $entryStream.Dispose()
            }
        }
    }
    finally {
        $archive.Dispose()
    }
}
finally {
    $fileStream.Dispose()
}

Get-Item -LiteralPath $destination | Select-Object FullName, Length
