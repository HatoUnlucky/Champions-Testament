# Champions Testament Static Site

This project uses Hugo for page rendering and small scripts for turning
`champions_key.db` into Hugo content/data files.

## Prototype locally

After Hugo is available in your shell:

```powershell
hugo server --bind 127.0.0.1 --baseURL http://127.0.0.1:1313/
```

Then open `http://127.0.0.1:1313/`.

## Build content

```powershell
python scripts/build_hugo_content.py --database champions_key.db --regulation ma
```

## Update Smogon usage tables

By default, the updater reads the primary Champions VGC 1760 source only,
for example `gen9championsvgc2026regma-1760.txt.gz`.
The intended richer pass is VGC, then VGC BO3, then BSS, with OU only filling
Pokemon/categories still missing after those sources.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-smogon-regulation-stats-indexed.ps1 -DatabasePath champions_key.db -Regulations ma,mb
```

Include BO3 deliberately:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-smogon-regulation-stats-indexed.ps1 -DatabasePath champions_key.db -Regulations ma -IncludeBo3
```

Include BSS deliberately:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-smogon-regulation-stats-indexed.ps1 -DatabasePath champions_key.db -Regulations ma -IncludeBss
```

Use OU only as a missing-data final pass:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-smogon-regulation-stats-indexed.ps1 -DatabasePath champions_key.db -Regulations ma -IncludeBo3 -IncludeBss -UseOuForMissing
```

Include lower cutoffs deliberately:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-smogon-regulation-stats-indexed.ps1 -DatabasePath champions_key.db -Regulations ma -Cutoffs 1760,1630,1500,0
```


The script writes generated Pokemon files into:

- `content/pokemon/`
- `data/pokemon/`
- `data/pokemon_index.json`

## Build static site

```powershell
hugo
```

Hugo writes the final static site to `public/`, including:

- `public/pokemon/`
- `public/moves/`
- `public/items/`
- `public/abilities/`
- `public/team-builder/`
- `public/turn-simulator/`
- `public/Images/`

The existing `Images/` directory is mounted into Hugo as `/Images/...`.
