param(
    [string] $DatabasePath,
    [string] $RawRoot,
    [string] $SqlitePath,
    [string] $StartMonth = "2026-04",
    [string[]] $Months,
    [string[]] $Regulations = @("ma", "mb"),
    [int[]] $Cutoffs = @(1760),
    [switch] $IncludeBss,
    [switch] $IncludeBo3,
    [switch] $UseOuForMissing,
    [switch] $Download
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $DatabasePath) { $DatabasePath = Join-Path $projectRoot "champions_key.db" }
if (-not $RawRoot) { $RawRoot = Join-Path $projectRoot "data\raw" }
if (-not $SqlitePath) { $SqlitePath = Join-Path $projectRoot "tools\sqlite\sqlite3.exe" }

$reportsDir = Join-Path $projectRoot "data\reports\smogon-updater-indexed"
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

Add-Type -AssemblyName System.Web.Extensions
$script:JsonSerializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$script:JsonSerializer.MaxJsonLength = [int]::MaxValue

$script:BaseUrl = "https://www.smogon.com/stats"
$script:Cutoffs = $Cutoffs
$script:ChaosFields = @(
    @{ Category = "abilities"; JsonKey = "Abilities"; Column = "abilities_json" },
    @{ Category = "items"; JsonKey = "Items"; Column = "items_json" },
    @{ Category = "moves"; JsonKey = "Moves"; Column = "moves_json" },
    @{ Category = "spreads"; JsonKey = "Spreads"; Column = "spreads_json" },
    @{ Category = "teammates"; JsonKey = "Teammates"; Column = "teammates_json" },
    @{ Category = "tera_types"; JsonKey = "Tera Types"; Column = "tera_types_json" }
)

function Quote-Sql([AllowNull()][object] $Value) {
    if ($null -eq $Value -or $Value -eq "") { return "NULL" }
    return "'" + ([string]$Value).Replace("'", "''") + "'"
}

function Add-Unique([System.Collections.Generic.List[string]] $List, [AllowNull()][string] $Value) {
    if ($Value -and -not $List.Contains($Value)) {
        [void] $List.Add($Value)
    }
}

function Convert-SlugToSmogon([string] $Slug) {
    switch ($Slug) {
        "mr.rime" { return "Mr. Rime" }
        "meowstic-f-mega" { return "Meowstic-F-Mega" }
        "meowstic-m-mega" { return "Meowstic-M-Mega" }
        "tauros-paldea-aqua" { return "Tauros-Paldea-Aqua" }
        "tauros-paldea-blaze" { return "Tauros-Paldea-Blaze" }
        "tauros-paldea-combat" { return "Tauros-Paldea-Combat" }
    }

    $parts = $Slug -split "-"
    if ($parts.Count -ge 2 -and $parts[-1] -eq "mega") {
        $base = ($parts[0..($parts.Count - 2)] | ForEach-Object {
            $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1)
        }) -join "-"
        return "$base-Mega"
    }

    return (($parts | ForEach-Object {
        if ($_.Length -eq 0) { $_ } else { $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1) }
    }) -join "-")
}

function Get-Sources([string] $Regulation) {
    $reg = $Regulation.ToLowerInvariant()

    $sources = @(
        [pscustomobject]@{ Key = "champions-vgc"; Priority = 1; Prefix = "gen9championsvgc2026reg$reg"; RegulationSpecific = $true }
    )

    if ($IncludeBo3) {
        $sources += [pscustomobject]@{ Key = "champions-bo3"; Priority = 2; Prefix = "gen9championsvgc2026reg$($reg)bo3"; RegulationSpecific = $true }
    }

    if ($IncludeBss) {
        $sources += [pscustomobject]@{ Key = "champions-bss"; Priority = 3; Prefix = "gen9championsbssreg$reg"; RegulationSpecific = $true }
    }

    foreach ($source in $sources) {
        if ($source.Prefix -notmatch "champions") {
            throw "Refusing non-Champions Smogon source prefix: $($source.Prefix)"
        }
    }

    return $sources
}

function Get-MissingSources() {
    if (-not $UseOuForMissing) { return @() }
    return @(
        [pscustomobject]@{ Key = "champions-ou-missing"; Priority = 99; Prefix = "gen9championsou"; RegulationSpecific = $false; MissingOnly = $true }
    )
}

function Get-SourceKey([object] $Source, [int] $Cutoff) {
    return "$($Source.Key)$Cutoff"
}

function Get-MonthsToCheck() {
    if ($Months -and $Months.Count -gt 0) {
        return @($Months | Where-Object { $_ -ge $StartMonth } | Sort-Object -Unique)
    }

    $local = @()
    if (Test-Path -LiteralPath $RawRoot) {
        $local = Get-ChildItem -LiteralPath $RawRoot -Directory |
            Where-Object { $_.Name -match '^20\d{2}-\d{2}$' -and $_.Name -ge $StartMonth } |
            ForEach-Object { $_.Name }
    }

    if (-not $Download) {
        return @($local | Sort-Object -Unique)
    }

    $index = (Invoke-WebRequest -Uri "$script:BaseUrl/" -UseBasicParsing).Content
    $remote = [regex]::Matches($index, 'href="(20\d{2}-\d{2})/"') |
        ForEach-Object { $_.Groups[1].Value } |
        Where-Object { $_ -ge $StartMonth }
    return @($local + $remote | Sort-Object -Unique)
}

function Expand-Gzip([string] $ArchivePath, [string] $DestinationPath) {
    $inputStream = [IO.File]::OpenRead($ArchivePath)
    try {
        $gzipStream = New-Object IO.Compression.GzipStream($inputStream, [IO.Compression.CompressionMode]::Decompress)
        try {
            $outputStream = [IO.File]::Create($DestinationPath)
            try { $gzipStream.CopyTo($outputStream) }
            finally { $outputStream.Dispose() }
        }
        finally { $gzipStream.Dispose() }
    }
    finally { $inputStream.Dispose() }
}

function Ensure-RemoteFiles([string] $Month, [string] $Regulation) {
    if (-not $Download) { return }

    $monthDir = Join-Path $RawRoot $Month
    New-Item -ItemType Directory -Force -Path $monthDir | Out-Null
    $monthIndex = (Invoke-WebRequest -Uri "$script:BaseUrl/$Month/" -UseBasicParsing).Content
    $chaosIndex = (Invoke-WebRequest -Uri "$script:BaseUrl/$Month/chaos/" -UseBasicParsing).Content

    foreach ($source in @((Get-Sources $Regulation) + (Get-MissingSources))) {
        foreach ($cutoff in $script:Cutoffs) {
            $baseName = "$($source.Prefix)-$cutoff"
            $usageGzipName = "$baseName.txt.gz"
            $usageTextName = "$baseName.txt"
            $usageGzipPath = Join-Path $monthDir $usageGzipName
            $usageTextPath = Join-Path $monthDir $usageTextName
            if ($monthIndex -match [regex]::Escape($usageGzipName) -and -not (Test-Path -LiteralPath $usageGzipPath)) {
                Invoke-WebRequest -Uri "$script:BaseUrl/$Month/$usageGzipName" -OutFile $usageGzipPath -UseBasicParsing
            }
            if ($monthIndex -match [regex]::Escape($usageTextName) -and
                -not (Test-Path -LiteralPath $usageTextPath) -and
                -not (Test-Path -LiteralPath $usageGzipPath)) {
                Invoke-WebRequest -Uri "$script:BaseUrl/$Month/$usageTextName" -OutFile $usageTextPath -UseBasicParsing
            }

            $chaosName = "$baseName.json.gz"
            $jsonPath = Join-Path $monthDir "$baseName.json"
            if ($chaosIndex -match [regex]::Escape($chaosName) -and -not (Test-Path -LiteralPath $jsonPath)) {
                $downloadPath = Join-Path $monthDir $chaosName
                Invoke-WebRequest -Uri "$script:BaseUrl/$Month/chaos/$chaosName" -OutFile $downloadPath -UseBasicParsing
                Expand-Gzip $downloadPath $jsonPath
            }
        }
    }
}

function Read-RegulationPokemon([string] $Regulation) {
    $tableName = "regulation_$($Regulation.ToLowerInvariant())_pokemon"
    $csvPath = Join-Path $reportsDir "$tableName.csv"
    & $SqlitePath $DatabasePath ".headers on" ".mode csv" "SELECT pokemon_slug FROM $tableName ORDER BY pokemon_slug;" |
        Set-Content -LiteralPath $csvPath -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { throw "Could not read $tableName." }
    return @(Import-Csv -LiteralPath $csvPath | ForEach-Object { $_.pokemon_slug })
}

function Read-KeyPokemonRows() {
    $csvPath = Join-Path $reportsDir "key-pokemon.csv"
    & $SqlitePath $DatabasePath ".headers on" ".mode csv" "SELECT pokemon_slug, display_name, smogon_names FROM key_pokemon;" |
        Set-Content -LiteralPath $csvPath -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { throw "Could not read key_pokemon." }

    $rows = @{}
    foreach ($row in Import-Csv -LiteralPath $csvPath) {
        $rows[$row.pokemon_slug] = $row
    }
    return $rows
}

function Get-CandidateNames([string] $Slug, [hashtable] $KeyRows) {
    $names = New-Object System.Collections.Generic.List[string]

    if ($KeyRows.ContainsKey($Slug)) {
        $row = $KeyRows[$Slug]
        foreach ($name in ([string]$row.smogon_names -split '\|')) {
            Add-Unique $names $name
        }
        Add-Unique $names (Convert-SlugToSmogon $Slug)
        Add-Unique $names $row.display_name
    }
    else {
        Add-Unique $names (Convert-SlugToSmogon $Slug)
    }

    $special = @{
        "basculegion-female" = @("Basculegion-F", "Basculegion-Female")
        "basculegion-male" = @("Basculegion", "Basculegion-Male")
        "meowstic-female" = @("Meowstic-F", "Meowstic-F-Mega", "Meowstic")
        "meowstic-male" = @("Meowstic", "Meowstic-M", "Meowstic-M-Mega")
        "meowstic-f-mega" = @("Meowstic-F-Mega")
        "meowstic-m-mega" = @("Meowstic-M-Mega")
        "mr.rime" = @("Mr. Rime")
        "stunfisk-galar" = @("Stunfisk-Galar")
        "samurott" = @("Samurott")
        "banette" = @("Banette")
        "chimecho" = @("Chimecho")
        "houndoom" = @("Houndoom")
        "pidgeot" = @("Pidgeot")
        "pinsir" = @("Pinsir")
        "victreebel" = @("Victreebel")
        "gourgeist" = @("Gourgeist", "Gourgeist-Small", "Gourgeist-Large", "Gourgeist-Super")
        "tauros-paldea-aqua" = @("Tauros-Paldea-Aqua")
        "tauros-paldea-blaze" = @("Tauros-Paldea-Blaze")
        "tauros-paldea-combat" = @("Tauros-Paldea-Combat")
    }
    if ($special.ContainsKey($Slug)) {
        foreach ($name in $special[$Slug]) { Add-Unique $names $name }
    }

    return @($names)
}

function Read-UsageFile([string] $Path) {
    $rows = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $rows }
    $pattern = '^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([0-9.]+)%\s*\|\s*(\d+)\s*\|'
    $lines = if ($Path.EndsWith(".gz")) {
        $inputStream = [IO.File]::OpenRead($Path)
        try {
            $gzipStream = New-Object IO.Compression.GzipStream($inputStream, [IO.Compression.CompressionMode]::Decompress)
            try {
                $reader = New-Object IO.StreamReader($gzipStream, [Text.Encoding]::UTF8)
                try { @($reader.ReadToEnd() -split "`r?`n") }
                finally { $reader.Dispose() }
            }
            finally { $gzipStream.Dispose() }
        }
        finally { $inputStream.Dispose() }
    }
    else {
        Get-Content -LiteralPath $Path -Encoding UTF8
    }

    foreach ($line in $lines) {
        if ($line -notmatch $pattern) { continue }
        $name = $Matches[2].Trim()
        $rows[$name] = [pscustomobject]@{
            SmogonName = $name
            Usage = ([double]$Matches[3]) / 100.0
            RawCount = [int]$Matches[4]
        }
    }
    return $rows
}

function Find-JsonValueStart([string] $Text, [int] $ColonIndex) {
    $i = $ColonIndex + 1
    while ($i -lt $Text.Length -and [char]::IsWhiteSpace($Text[$i])) { $i++ }
    return $i
}

function Find-MatchingEnd([string] $Text, [int] $Start) {
    $open = $Text[$Start]
    if ($open -eq "{") { $close = "}" }
    elseif ($open -eq "[") { $close = "]" }
    elseif ($open -eq '"') {
        $i = $Start + 1
        $escaped = $false
        while ($i -lt $Text.Length) {
            $ch = $Text[$i]
            if ($escaped) { $escaped = $false }
            elseif ($ch -eq "\") { $escaped = $true }
            elseif ($ch -eq '"') { return $i }
            $i++
        }
        throw "Unterminated JSON string."
    }
    else {
        $i = $Start
        while ($i -lt $Text.Length -and $Text[$i] -notin @(",", "}")) { $i++ }
        return $i - 1
    }

    $depth = 0
    $inString = $false
    $escapedStringChar = $false
    for ($i = $Start; $i -lt $Text.Length; $i++) {
        $ch = $Text[$i]
        if ($inString) {
            if ($escapedStringChar) { $escapedStringChar = $false }
            elseif ($ch -eq "\") { $escapedStringChar = $true }
            elseif ($ch -eq '"') { $inString = $false }
            continue
        }
        if ($ch -eq '"') { $inString = $true }
        elseif ($ch -eq $open) { $depth++ }
        elseif ($ch -eq $close) {
            $depth--
            if ($depth -eq 0) { return $i }
        }
    }
    throw "No matching JSON delimiter found."
}

function Extract-JsonProperty([string] $Text, [string] $PropertyName) {
    $needle = '"' + $PropertyName + '":'
    $propIndex = $Text.IndexOf($needle, [StringComparison]::Ordinal)
    if ($propIndex -lt 0) { return $null }
    $colonIndex = $propIndex + $needle.Length - 1
    $valueStart = Find-JsonValueStart $Text $colonIndex
    $valueEnd = Find-MatchingEnd $Text $valueStart
    return $Text.Substring($valueStart, $valueEnd - $valueStart + 1)
}

function Extract-ObjectProperty([string] $Text, [string] $PropertyName) {
    $needle = '"' + $PropertyName + '":{'
    $propIndex = $Text.IndexOf($needle, [StringComparison]::Ordinal)
    if ($propIndex -lt 0) { return $null }
    $valueStart = $propIndex + $needle.Length - 1
    $valueEnd = Find-MatchingEnd $Text $valueStart
    return $Text.Substring($valueStart, $valueEnd - $valueStart + 1)
}

function Extract-PokemonBlock([string] $DataText, [string[]] $CandidateNames) {
    foreach ($candidate in $CandidateNames) {
        $raw = Extract-ObjectProperty $DataText $candidate
        if ($raw) {
            return [pscustomobject]@{ SmogonName = $candidate; Raw = $raw }
        }
    }
    return $null
}

function Convert-JsonNumber([AllowNull()][object] $Value, [double] $Denominator = 0) {
    if ($null -eq $Value -or $Value -eq "") { return "0" }
    $number = [double]$Value
    if ($Denominator -gt 0) { $number = $number / $Denominator }
    return ([math]::Round($number, 6)).ToString("0.######", [Globalization.CultureInfo]::InvariantCulture)
}

function Serialize-JsonString([string] $Value) {
    return $script:JsonSerializer.Serialize($Value)
}

function Convert-NormalizedJsonMap([AllowNull()][string] $Raw, [double] $Denominator) {
    if (-not $Raw) { return "{}" }
    $map = $script:JsonSerializer.DeserializeObject($Raw)
    if (-not ($map -is [System.Collections.IDictionary])) { return "{}" }

    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($key in $map.Keys) {
        $value = $map[$key]
        if ($value -is [System.Array]) {
            $items = New-Object System.Collections.Generic.List[string]
            foreach ($entry in $value) { [void] $items.Add((Convert-JsonNumber $entry $Denominator)) }
            [void] $parts.Add("$(Serialize-JsonString ([string]$key)):[$($items -join ',')]")
        }
        else {
            [void] $parts.Add("$(Serialize-JsonString ([string]$key)):$(Convert-JsonNumber $value $Denominator)")
        }
    }
    return "{$($parts -join ',')}"
}

function Get-MapTotal([AllowNull()][object] $Map) {
    if (-not ($Map -is [System.Collections.IDictionary])) { return 0.0 }

    $total = 0.0
    foreach ($key in $Map.Keys) {
        try {
            $value = $Map[$key]
            if ($value -is [System.Array]) {
                if ($value.Count -gt 0) { $total += [double]$value[0] }
            }
            else {
                $total += [double]$value
            }
        }
        catch {
            continue
        }
    }
    return $total
}

function Get-ChaosTotal([object] $Record) {
    foreach ($key in @("Abilities", "Items", "Spreads", "Tera Types")) {
        if ($Record.ContainsKey($key)) {
            $total = Get-MapTotal $Record[$key]
            if ($total -gt 0) { return $total }
        }
    }

    if ($Record.ContainsKey("Moves")) {
        $total = Get-MapTotal $Record["Moves"]
        if ($total -gt 0) { return $total / 4.0 }
    }

    if ($Record.ContainsKey("Teammates")) {
        $total = Get-MapTotal $Record["Teammates"]
        if ($total -gt 0) { return $total / 5.0 }
    }

    return 0.0
}

function Get-DataText([hashtable] $DataCache, [string] $JsonPath) {
    if (-not $DataCache.ContainsKey($JsonPath)) {
        $rawJson = Get-Content -LiteralPath $JsonPath -Raw -Encoding UTF8
        $dataText = Extract-JsonProperty $rawJson "data"
        if (-not $dataText) { throw "No top-level data object found in $JsonPath." }
        $DataCache[$JsonPath] = $dataText
    }
    return $DataCache[$JsonPath]
}

function Build-FileIndex([string] $Regulation, [string] $Month) {
    Ensure-RemoteFiles $Month $Regulation

    $monthDir = Join-Path $RawRoot $Month
    $index = New-Object System.Collections.Generic.List[object]
    foreach ($source in @((Get-Sources $Regulation) + (Get-MissingSources))) {
        foreach ($cutoff in $script:Cutoffs) {
            $baseName = "$($source.Prefix)-$cutoff"
            $usageGzipPath = Join-Path $monthDir "$baseName.txt.gz"
            $usageTextPath = Join-Path $monthDir "$baseName.txt"
            $usagePath = if (Test-Path -LiteralPath $usageGzipPath) { $usageGzipPath } else { $usageTextPath }
            $jsonPath = Join-Path $monthDir "$baseName.json"
            if (-not (Test-Path -LiteralPath $usagePath) -and -not (Test-Path -LiteralPath $jsonPath)) { continue }

            [void] $index.Add([pscustomobject]@{
                Month = $Month
                SourceKey = $source.Key
                SourcePriority = $source.Priority
                SourceKeyWithCutoff = (Get-SourceKey $source $cutoff)
                Cutoff = $cutoff
                RegulationSpecific = $source.RegulationSpecific
                MissingOnly = [bool]$source.MissingOnly
                UsagePath = $usagePath
                ChaosPath = $jsonPath
                UsageRows = (Read-UsageFile $usagePath)
            })
        }
    }
    return $index.ToArray()
}

function Regulation-ExistsInMonth([string] $Regulation, [string] $Month) {
    $monthDir = Join-Path $RawRoot $Month
    foreach ($source in (Get-Sources $Regulation | Where-Object { $_.RegulationSpecific })) {
        foreach ($cutoff in $script:Cutoffs) {
            $baseName = "$($source.Prefix)-$cutoff"
            if ((Test-Path -LiteralPath (Join-Path $monthDir "$baseName.txt")) -or
                (Test-Path -LiteralPath (Join-Path $monthDir "$baseName.json")) -or
                (Test-Path -LiteralPath (Join-Path $monthDir "$baseName.txt.gz")) -or
                (Test-Path -LiteralPath (Join-Path $monthDir "$baseName.json.gz"))) {
                return $true
            }
        }
    }
    return $false
}

function Select-Usage([object[]] $Files, [string[]] $Candidates) {
    foreach ($file in ($Files | Where-Object { -not $_.MissingOnly } | Sort-Object SourcePriority, @{ Expression = "Cutoff"; Descending = $true })) {
        foreach ($candidate in $Candidates) {
            if ($file.UsageRows.ContainsKey($candidate)) {
                $row = $file.UsageRows[$candidate]
                return [pscustomobject]@{
                    File = $file
                    SmogonName = $row.SmogonName
                    Usage = $row.Usage
                    RawCount = $row.RawCount
                }
            }
        }
    }
    return $null
}

function Select-MissingUsage([object[]] $Files, [string[]] $Candidates) {
    foreach ($file in ($Files | Where-Object { $_.MissingOnly } | Sort-Object SourcePriority, @{ Expression = "Cutoff"; Descending = $true })) {
        foreach ($candidate in $Candidates) {
            if ($file.UsageRows.ContainsKey($candidate)) {
                $row = $file.UsageRows[$candidate]
                return [pscustomobject]@{
                    File = $file
                    SmogonName = $row.SmogonName
                    Usage = $row.Usage
                    RawCount = $row.RawCount
                }
            }
        }
    }
    return $null
}

function Select-ChaosField([object[]] $Files, [string[]] $Candidates, [string] $JsonKey, [hashtable] $DataCache, [hashtable] $BlockCache) {
    foreach ($file in ($Files | Where-Object { -not $_.MissingOnly } | Sort-Object SourcePriority, @{ Expression = "Cutoff"; Descending = $true })) {
        if (-not (Test-Path -LiteralPath $file.ChaosPath)) { continue }

        if (-not $DataCache.ContainsKey($file.ChaosPath)) {
            $payload = $script:JsonSerializer.DeserializeObject((Get-Content -Raw -LiteralPath $file.ChaosPath))
            if ($payload.ContainsKey("data")) {
                $DataCache[$file.ChaosPath] = $payload["data"]
            }
            else {
                $DataCache[$file.ChaosPath] = @{}
            }
        }

        $data = $DataCache[$file.ChaosPath]
        foreach ($candidate in $Candidates) {
            if (-not $data.ContainsKey($candidate)) { continue }
            $record = $data[$candidate]
            if (-not $record.ContainsKey($JsonKey)) { continue }
            return [pscustomobject]@{
                File = $file
                SmogonName = $candidate
                Raw = $script:JsonSerializer.Serialize($record[$JsonKey])
                Total = Get-ChaosTotal $record
            }
        }
    }
    return $null
}

function Select-MissingChaosField([object[]] $Files, [string[]] $Candidates, [string] $JsonKey, [hashtable] $DataCache) {
    foreach ($file in ($Files | Where-Object { $_.MissingOnly } | Sort-Object SourcePriority, @{ Expression = "Cutoff"; Descending = $true })) {
        if (-not (Test-Path -LiteralPath $file.ChaosPath)) { continue }

        if (-not $DataCache.ContainsKey($file.ChaosPath)) {
            $payload = $script:JsonSerializer.DeserializeObject((Get-Content -Raw -LiteralPath $file.ChaosPath))
            if ($payload.ContainsKey("data")) {
                $DataCache[$file.ChaosPath] = $payload["data"]
            }
            else {
                $DataCache[$file.ChaosPath] = @{}
            }
        }

        $data = $DataCache[$file.ChaosPath]
        foreach ($candidate in $Candidates) {
            if (-not $data.ContainsKey($candidate)) { continue }
            $record = $data[$candidate]
            if (-not $record.ContainsKey($JsonKey)) { continue }
            return [pscustomobject]@{
                File = $file
                SmogonName = $candidate
                Raw = $script:JsonSerializer.Serialize($record[$JsonKey])
                Total = Get-ChaosTotal $record
            }
        }
    }
    return $null
}

function Add-Insert([System.Collections.Generic.List[string]] $SqlLines, [string] $TableName, [string[]] $Columns, [object[]] $Values) {
    $quoted = @($Values | ForEach-Object { Quote-Sql $_ })
    [void] $SqlLines.Add("INSERT INTO $TableName ($($Columns -join ', ')) VALUES ($($quoted -join ', '));")
}

function Remove-UnneededSmogonTables([string] $Regulation) {
    $reg = $Regulation.ToLowerInvariant()
    $prefix = "smogon_regulation_$reg`_"
    $keepPattern = "^smogon_regulation_$reg`_(abilities|items|moves|spreads|teammates|tera_types)_20\d{2}_\d{2}$"
    $csvPath = Join-Path $reportsDir "smogon-$reg-tables.csv"

    & $SqlitePath $DatabasePath ".headers on" ".mode csv" "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '$prefix%';" |
        Set-Content -LiteralPath $csvPath -Encoding UTF8
    if ($LASTEXITCODE -ne 0) { throw "Could not list Smogon tables for $reg." }

    $dropLines = New-Object System.Collections.Generic.List[string]
    [void] $dropLines.Add("BEGIN TRANSACTION;")

    foreach ($row in Import-Csv -LiteralPath $csvPath) {
        $tableName = [string]$row.name
        if ($tableName -match $keepPattern) { continue }
        $escaped = $tableName.Replace('"', '""')
        [void] $dropLines.Add("DROP TABLE IF EXISTS `"$escaped`";")
    }

    [void] $dropLines.Add("COMMIT;")
    $sqlPath = Join-Path $reportsDir "cleanup-smogon-$reg.sql"
    $dropLines | Set-Content -LiteralPath $sqlPath -Encoding UTF8

    & $SqlitePath $DatabasePath ".read '$($sqlPath.Replace('\','/'))'"
    if ($LASTEXITCODE -ne 0) { throw "Failed to clean generated Smogon tables for $reg." }
}

function Update-Regulation([string] $Regulation, [string[]] $FoundMonths, [string[]] $PokemonSlugs, [hashtable] $KeyRows) {
    $reg = $Regulation.ToLowerInvariant()
    $prefix = "smogon_regulation_$reg"
    $sqlPath = Join-Path $reportsDir "$prefix.sql"
    $sqlLines = New-Object System.Collections.Generic.List[string]
    $dataCache = @{}
    $blockCache = @{}
    $sourceFileId = 1

    [void] $sqlLines.Add("BEGIN TRANSACTION;")
    [void] $sqlLines.Add("DROP TABLE IF EXISTS ${prefix}_source_file;")
    [void] $sqlLines.Add("DROP TABLE IF EXISTS ${prefix}_monthly_table;")
    [void] $sqlLines.Add("CREATE TABLE ${prefix}_source_file (id INT, stats_month TEXT, source_key TEXT, source_priority INT, usage_path TEXT, chaos_path TEXT);")
    [void] $sqlLines.Add("CREATE TABLE ${prefix}_monthly_table (stats_month TEXT, category TEXT, table_name TEXT);")

    foreach ($month in $FoundMonths) {
        $suffix = $month -replace "-", "_"
        foreach ($category in @("usage") + @($script:ChaosFields | ForEach-Object { $_.Category })) {
            [void] $sqlLines.Add("DROP TABLE IF EXISTS ${prefix}_${category}_$suffix;")
        }

        [void] $sqlLines.Add("CREATE TABLE ${prefix}_usage_$suffix (pokemon_slug TEXT, smogon_name TEXT, source_key TEXT, source_priority INT, usage REAL, raw_count INT, viability_ceiling TEXT);")
        foreach ($field in $script:ChaosFields) {
            [void] $sqlLines.Add("CREATE TABLE ${prefix}_$($field.Category)_$suffix (pokemon_slug TEXT, smogon_name TEXT, source_key TEXT, source_priority INT, $($field.Column) TEXT);")
        }

        foreach ($category in @("usage") + @($script:ChaosFields | ForEach-Object { $_.Category })) {
            Add-Insert $sqlLines "${prefix}_monthly_table" @("stats_month", "category", "table_name") @($month, $category, "$category`_$suffix")
        }

        $files = @(Build-FileIndex $reg $month)
        foreach ($file in $files) {
            Add-Insert $sqlLines "${prefix}_source_file" @("id", "stats_month", "source_key", "source_priority", "usage_path", "chaos_path") @(
                $sourceFileId,
                $month,
                $file.SourceKeyWithCutoff,
                $file.SourcePriority,
                $(if (Test-Path -LiteralPath $file.UsagePath) { $file.UsagePath } else { $null }),
                $(if (Test-Path -LiteralPath $file.ChaosPath) { $file.ChaosPath } else { $null })
            )
            $sourceFileId++
        }

        foreach ($slug in $PokemonSlugs) {
            $candidates = Get-CandidateNames $slug $KeyRows
            $usage = Select-Usage $files $candidates
            if (-not $usage) {
                $usage = Select-MissingUsage $files $candidates
            }
            $viability = "[]"
            if ($usage) {
                $viabilityField = Select-ChaosField $files $candidates "Viability Ceiling" $dataCache $blockCache
                if ($viabilityField) { $viability = $viabilityField.Raw }
                Add-Insert $sqlLines "${prefix}_usage_$suffix" @("pokemon_slug", "smogon_name", "source_key", "source_priority", "usage", "raw_count", "viability_ceiling") @(
                    $slug,
                    $usage.SmogonName,
                    $usage.File.SourceKeyWithCutoff,
                    $usage.File.SourcePriority,
                    $usage.Usage.ToString("0.#######", [Globalization.CultureInfo]::InvariantCulture),
                    $usage.RawCount,
                    $viability
                )
            }

            foreach ($field in $script:ChaosFields) {
                $selected = Select-ChaosField $files $candidates $field.JsonKey $dataCache $blockCache
                if (-not $selected) {
                    $selected = Select-MissingChaosField $files $candidates $field.JsonKey $dataCache
                }
                if ($selected) {
                    $jsonValue = Convert-NormalizedJsonMap $selected.Raw $selected.Total
                    Add-Insert $sqlLines "${prefix}_$($field.Category)_$suffix" @("pokemon_slug", "smogon_name", "source_key", "source_priority", $field.Column) @(
                        $slug,
                        $selected.SmogonName,
                        $selected.File.SourceKeyWithCutoff,
                        $selected.File.SourcePriority,
                        $jsonValue
                    )
                }
                else {
                    Add-Insert $sqlLines "${prefix}_$($field.Category)_$suffix" @("pokemon_slug", "smogon_name", "source_key", "source_priority", $field.Column) @($slug, $null, $null, $null, "{}")
                }
            }
        }
    }

    [void] $sqlLines.Add("COMMIT;")
    $sqlLines | Set-Content -LiteralPath $sqlPath -Encoding UTF8
    & $SqlitePath $DatabasePath ".read '$($sqlPath.Replace('\','/'))'"
    if ($LASTEXITCODE -ne 0) { throw "Failed to update $prefix." }

    Remove-UnneededSmogonTables $reg

    return [pscustomobject]@{
        regulation = $reg
        months = ($FoundMonths -join ",")
        pokemon = $PokemonSlugs.Count
        sql = $sqlPath
    }
}

$allMonths = @(Get-MonthsToCheck)
if ($allMonths.Count -eq 0) { throw "No local or remote Smogon months found at or after $StartMonth." }

$keyRows = Read-KeyPokemonRows
$results = New-Object System.Collections.Generic.List[object]

foreach ($regulation in $Regulations) {
    $reg = $regulation.ToLowerInvariant()
    foreach ($month in $allMonths) {
        if ($Download) { Ensure-RemoteFiles $month $reg }
    }

    $foundMonths = @($allMonths | Where-Object { Regulation-ExistsInMonth $reg $_ })
    if ($foundMonths.Count -eq 0) {
        [void] $results.Add([pscustomobject]@{
            regulation = $reg
            months = ""
            pokemon = 0
            sql = ""
            note = "No regulation-specific Smogon files found; no tables built."
        })
        continue
    }

    $pokemonSlugs = Read-RegulationPokemon $reg
    [void] $results.Add((Update-Regulation $reg $foundMonths $pokemonSlugs $keyRows))
}

$results
