import argparse
import json
import re
import shutil
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STAT_LABELS = [
    ("total", "Total"),
    ("hp", "HP"),
    ("attack", "Atk"),
    ("defense", "Def"),
    ("special_attack", "SpAtk"),
    ("special_defense", "SpDef"),
    ("speed", "Speed"),
]
MOVE_EFFECT_FLAGS = [
    "burn",
    "paralysis",
    "freeze",
    "poison",
    "badly_poison",
    "sleep",
    "confusion",
    "flinch",
    "attack_down",
    "defense_down",
    "special_attack_down",
    "special_defense_down",
    "speed_down",
    "accuracy_down",
]
STATUS_IMMUNITIES = {
    "burn": {
        "immune_types": ["fire"],
        "immune_abilities": ["water-veil", "water-bubble", "thermal-exchange", "comatose"],
    },
    "paralysis": {
        "immune_types": ["electric"],
        "immune_abilities": ["limber", "comatose"],
    },
    "freeze": {
        "immune_types": ["ice"],
        "immune_abilities": ["magma-armor", "comatose"],
    },
    "poison": {
        "immune_types": ["poison", "steel"],
        "immune_abilities": ["immunity", "pastel-veil", "comatose"],
    },
    "badly_poison": {
        "immune_types": ["poison", "steel"],
        "immune_abilities": ["immunity", "pastel-veil", "comatose"],
    },
    "sleep": {
        "immune_abilities": ["insomnia", "vital-spirit", "sweet-veil", "comatose"],
    },
    "confusion": {
        "immune_abilities": ["own-tempo"],
    },
    "flinch": {
        "immune_abilities": ["inner-focus", "shield-dust"],
    },
}


def slugify(value):
    slug = re.sub(r"[^a-z0-9]+", "-", str(value).strip().lower())
    return slug.strip("-") or "unknown"


def compact_id(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def path_slug(value):
    return slugify(value)


def display_name(value):
    return str(value or "").replace("-", " ").title().replace("'S", "'s")


def pokemon_display_name(slug):
    parts = [part for part in slugify(slug).split("-") if part]
    if not parts:
        return "Unknown"

    prefix_labels = {
        "alolan": "Alolan",
        "galarian": "Galarian",
        "hisuian": "Hisuian",
        "paldean": "Paldean",
    }
    suffix_labels = {
        "female": "Female",
        "male": "Male",
        "totem": "Totem",
        "gmax": "Gmax",
    }
    trailing_letters = {"x", "y", "z"}

    if parts[0] == "mega":
        name_parts = [display_name(part) for part in parts[1:]]
        if name_parts and parts[-1] in trailing_letters:
            name_parts[-1] = parts[-1].upper()
        return " ".join(["Mega"] + name_parts).strip()

    if parts[0] in prefix_labels and len(parts) > 1:
        return " ".join([prefix_labels[parts[0]]] + [display_name(part) for part in parts[1:]])

    if len(parts) > 1 and parts[-1] in suffix_labels:
        return " ".join([display_name(part) for part in parts[:-1]] + [suffix_labels[parts[-1]]])

    if len(parts) > 1 and parts[-1] in trailing_letters:
        return " ".join([display_name(part) for part in parts[:-1]] + [parts[-1].upper()])

    return display_name(slug)


def percent(value):
    try:
        return round(float(value) * 100, 1)
    except (TypeError, ValueError):
        return None


def read_json_map(value):
    if not value:
        return {}
    try:
        data = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def table_exists(conn, table):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def columns_for(conn, table):
    return {row["name"] for row in conn.execute(f'PRAGMA table_info("{table}")')}


def category_table_history(conn, regulation):
    monthly = f"smogon_regulation_{regulation}_monthly_table"
    tables = {}

    if table_exists(conn, monthly):
        rows = conn.execute(
            f"""
            SELECT category, stats_month, table_name
            FROM "{monthly}"
            ORDER BY stats_month DESC
            """
        ).fetchall()

        prefix = f"smogon_regulation_{regulation}_"
        for row in rows:
            candidate = prefix + row["table_name"]
            if table_exists(conn, candidate):
                tables.setdefault(row["category"], []).append({
                    "month": row["stats_month"],
                    "table": candidate,
                })
        return tables

    pattern = re.compile(
        rf"^smogon_regulation_{re.escape(regulation)}_"
        r"(abilities|items|moves|spreads|teammates|tera_types)_(\d{4})_(\d{2})$"
    )
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?",
        (f"smogon_regulation_{regulation}_%",),
    ).fetchall()

    for row in rows:
        name = row["name"]
        match = pattern.match(name)
        if not match:
            continue

        category, year, month = match.groups()
        tables.setdefault(category, []).append({
            "month": f"{year}-{month}",
            "table": name,
        })

    for entries in tables.values():
        entries.sort(key=lambda entry: entry["month"], reverse=True)

    return tables


def parse_regulations(value):
    regulations = []
    for item in str(value or "").split(","):
        regulation = item.strip().lower()
        if regulation and regulation not in regulations:
            regulations.append(regulation)
    return regulations or ["ma", "mb"]


def one_row(conn, table, slug):
    if not table or not table_exists(conn, table):
        return None
    return conn.execute(
        f'SELECT * FROM "{table}" WHERE pokemon_slug = ?',
        (slug,),
    ).fetchone()


def first_category_row(conn, history, category, slug, json_column=None):
    for entry in history.get(category, []):
        row = one_row(conn, entry["table"], slug)
        if not row:
            continue
        if json_column and not read_json_map(row[json_column]):
            continue
        return row, entry["month"]
    return None, None


def lookup_table(conn, table, key_column, value_column):
    if not table_exists(conn, table):
        return {}

    columns = columns_for(conn, table)
    if key_column not in columns or value_column not in columns:
        return {}

    rows = conn.execute(
        f'SELECT "{key_column}", "{value_column}" FROM "{table}"'
    ).fetchall()
    return {
        str(row[key_column]).lower(): row[value_column]
        for row in rows
        if row[key_column]
    }


def pokemon_image(row, kind):
    filename = row[kind] if kind in row.keys() else None
    if not filename:
        return ""

    species = row["species_slug"] if "species_slug" in row.keys() else row["pokemon_slug"]
    sprite = row["sprite_slug"] if "sprite_slug" in row.keys() else row["pokemon_slug"]
    return f"Images/pokemon_sprites/by_species/{species}/{sprite}/{filename}"


def item_image(item_slug, item_lookup):
    record = item_lookup.get(str(item_slug).lower()) or item_lookup.get(compact_id(item_slug))
    if not record:
        return ""

    category = path_slug(record.get("category") or "unknown")
    image_candidates = []
    if record.get("primary_image"):
        image_candidates.append((
            "primary_images_by_category",
            category,
            record["primary_image"],
        ))
    image_candidates.append((
        "primary_images_by_category",
        category,
        f"{item_slug}_primary_image.png",
    ))
    image_candidates.append((
        "pixel_sprites_by_category",
        category,
        f"{item_slug}_pixel_sprite.png",
    ))
    image_candidates.append((
        "by_category",
        category,
        f"{item_slug}_primary_image.png",
    ))
    image_candidates.append((
        "by_category",
        category,
        f"{item_slug}_pixel_sprite.png",
    ))

    for base, folder, filename in image_candidates:
        path = ROOT / "Images" / "item_images" / base / folder / filename
        if path.exists():
            return f"Images/item_images/{base}/{folder}/{filename}"
    return ""


def build_item_lookup(conn):
    if not table_exists(conn, "key_item"):
        return {}

    columns = columns_for(conn, "key_item")
    select = ["item_slug"]
    for column in ["display_name", "category", "description", "effect", "primary_image"]:
        if column in columns:
            select.append(column)

    rows = conn.execute(
        "SELECT {columns} FROM key_item".format(
            columns=", ".join(f'"{column}"' for column in select)
        )
    ).fetchall()

    lookup = {}
    for row in rows:
        if not row["item_slug"]:
            continue
        record = {key: row[key] for key in row.keys()}
        lookup[str(row["item_slug"]).lower()] = record
        lookup[compact_id(row["item_slug"])] = record
        if record.get("display_name"):
            lookup[compact_id(record["display_name"])] = record
    return lookup


def build_move_lookup(conn):
    if not table_exists(conn, "key_moves"):
        return {}

    columns = columns_for(conn, "key_moves")
    select = ["move_slug"]
    for column in ["display_name", "type", "power", "class", "description", "priority"]:
        if column in columns:
            select.append(column)

    rows = conn.execute(
        "SELECT {columns} FROM key_moves".format(
            columns=", ".join(f'"{column}"' for column in select)
        )
    ).fetchall()

    lookup = {}
    for row in rows:
        if not row["move_slug"]:
            continue
        record = {key: row[key] for key in row.keys()}
        lookup[str(row["move_slug"]).lower()] = record
        lookup[compact_id(row["move_slug"])] = record
        if record.get("display_name"):
            lookup[compact_id(record["display_name"])] = record
    return lookup


def move_slug_from_record(record):
    return slugify(record.get("move_slug") or record.get("display_name") or "")


def move_description(record):
    return str(record.get("description") or "").strip()


def move_effect_row(identifier, chance):
    row = {
        "chance": int(chance),
        "identifier": identifier,
    }
    for flag in MOVE_EFFECT_FLAGS:
        row[flag] = flag == identifier
    return row


def detect_move_effects(record):
    slug = move_slug_from_record(record)
    description = move_description(record).lower()
    effects = []

    overrides = {
        "fake-out": [move_effect_row("flinch", 100)],
        "dire-claw": [
            move_effect_row("poison", 16),
            move_effect_row("paralysis", 16),
            move_effect_row("sleep", 16),
        ],
    }
    if slug in overrides:
        return overrides[slug]

    chance = 100
    chance_match = re.search(r"has an? (\d+)% chance|has a (\d+)% chance", description)
    if chance_match:
        chance = int(next(group for group in chance_match.groups() if group))

    effect_patterns = [
        ("burn", [r"burning? the target", r"inflicting a burn", r"burn the target"]),
        ("paralysis", [r"paralyzing? the target", r"paralyzes the target"]),
        ("freeze", [r"freezing? the target", r"freeze the target"]),
        ("badly_poison", [r"badly poisons the target"]),
        ("poison", [r"poisoning? the target", r"poisons the target"]),
        ("sleep", [r"puts the target to sleep", r"makes the target drowsy"]),
        ("confusion", [r"confuses the target", r"confusing the target"]),
        ("flinch", [r"making? (?:the )?targets? flinch", r"makes the target flinch"]),
        ("attack_down", [r"lowering the target's attack", r"lowers the target's attack"]),
        ("defense_down", [r"lowering the target's defense", r"lowers the target's defense"]),
        ("special_attack_down", [r"lowering (?:targets'|the target's) sp\. atk", r"lowers (?:targets'|the target's) sp\. atk"]),
        ("special_defense_down", [r"lowering (?:targets'|the target's) sp\. def", r"lowers (?:targets'|the target's) sp\. def"]),
        ("speed_down", [r"lowering (?:targets'|the target's) speed", r"lowers (?:targets'|the target's) speed"]),
        ("accuracy_down", [r"lowering (?:targets'|the target's) accuracy", r"lowers (?:targets'|the target's) accuracy"]),
    ]

    for identifier, patterns in effect_patterns:
        if identifier == "poison" and re.search(r"badly poisons the target", description):
            continue
        if any(re.search(pattern, description) for pattern in patterns):
            effects.append(move_effect_row(identifier, chance))

    return effects


def detect_move_target(record):
    slug = move_slug_from_record(record)
    name = str(record.get("display_name") or "").lower()
    description = move_description(record).lower()

    user_side = {
        "tailwind", "reflect", "light-screen", "aurora-veil", "safeguard",
        "mist", "sunny-day", "rain-dance", "sandstorm", "snowscape", "hail",
    }
    self_moves = {
        "protect", "detect", "endure", "substitute", "swords-dance",
        "dragon-dance", "nasty-plot", "calm-mind", "bulk-up", "recover",
        "roost", "slack-off", "rest", "shell-smash", "iron-defense",
        "acid-armor", "agility", "work-up",
    }
    adjacent_opponents = {
        "dazzling-gleam", "heat-wave", "icy-wind", "muddy-water", "rock-slide",
        "snarl", "struggle-bug", "electroweb", "air-cutter",
    }
    all_adjacent = {
        "earthquake", "surf", "discharge", "lava-plume", "boomburst",
        "bulldoze", "sludge-wave", "petal-blizzard", "teeter-dance",
    }
    all_including_self = {"explosion", "self-destruct", "misty-explosion"}
    ally_single = {"helping-hand", "heal-pulse", "ally-switch", "coaching", "decorate"}

    if slug in all_including_self:
        return {
            "target_kind": "all_field",
            "allowed_sides": ["ally", "opponent", "self"],
            "min_targets": 4,
            "max_targets": 4,
            "auto_select": True,
        }
    if slug in all_adjacent or "all adjacent" in description:
        return {
            "target_kind": "all_adjacent",
            "allowed_sides": ["ally", "opponent"],
            "min_targets": 3,
            "max_targets": 3,
            "auto_select": True,
        }
    if slug in adjacent_opponents or "targets' " in description:
        return {
            "target_kind": "all_adjacent_opponents",
            "allowed_sides": ["opponent"],
            "min_targets": 2,
            "max_targets": 2,
            "auto_select": True,
        }
    if slug in user_side or "user's side" in description or "entire field" in description:
        return {
            "target_kind": "user_side",
            "allowed_sides": ["ally", "self"],
            "min_targets": 0,
            "max_targets": 0,
            "auto_select": True,
        }
    if slug in self_moves or "boosts the user's" in description or "restores 1/2 of the user's" in description:
        return {
            "target_kind": "self",
            "allowed_sides": ["self"],
            "min_targets": 1,
            "max_targets": 1,
            "auto_select": True,
        }
    if slug in ally_single or "an ally" in description:
        return {
            "target_kind": "adjacent_ally_single",
            "allowed_sides": ["ally"],
            "min_targets": 1,
            "max_targets": 1,
            "auto_select": False,
        }

    return {
        "target_kind": "adjacent_opponent_single",
        "allowed_sides": ["opponent"],
        "min_targets": 1,
        "max_targets": 1,
        "auto_select": False,
    }


def build_move_keys(move_lookup):
    canonical = {}
    for record in move_lookup.values():
        slug = move_slug_from_record(record)
        if slug:
            canonical[slug] = record

    effects = {}
    targets = {}
    report = {
        "moves_with_effects": [],
        "moves_without_detected_effects": [],
        "moves_with_multiple_effects": [],
        "moves_with_default_targets": [],
    }

    for slug, record in sorted(canonical.items()):
        detected_effects = detect_move_effects(record)
        if detected_effects:
            effects[slug] = detected_effects
            report["moves_with_effects"].append(slug)
            if len(detected_effects) > 1:
                report["moves_with_multiple_effects"].append(slug)
        else:
            report["moves_without_detected_effects"].append(slug)

        target = detect_move_target(record)
        targets[slug] = target
        if target["target_kind"] == "adjacent_opponent_single":
            report["moves_with_default_targets"].append(slug)

    return effects, targets, STATUS_IMMUNITIES, report


def build_ability_lookup(conn):
    if not table_exists(conn, "key_ability"):
        return {}

    columns = columns_for(conn, "key_ability")
    select = ["ability_slug"]
    for column in ["display_name", "description"]:
        if column in columns:
            select.append(column)

    rows = conn.execute(
        "SELECT {columns} FROM key_ability".format(
            columns=", ".join(f'"{column}"' for column in select)
        )
    ).fetchall()

    lookup = {}
    for row in rows:
        if not row["ability_slug"]:
            continue
        record = {key: row[key] for key in row.keys()}
        lookup[str(row["ability_slug"]).lower()] = record
        lookup[compact_id(row["ability_slug"])] = record
        if record.get("display_name"):
            lookup[compact_id(record["display_name"])] = record
    return lookup


def ranked_json_entries(raw_map, lookup, fallback_kind, limit=12):
    entries = []
    for key, value in raw_map.items():
        if key is None or str(key).lower() in {"", "none", "nothing"}:
            continue
        details = lookup.get(str(key).lower()) or lookup.get(compact_id(key)) or {}
        canonical_slug = (
            details.get("item_slug")
            or details.get("move_slug")
            or details.get("ability_slug")
            or str(key)
        )
        name = details.get("display_name") or display_name(key)
        entries.append({
            "slug": str(canonical_slug),
            "name": name,
            "percent": percent(value),
            "description": details.get("description") or details.get("effect") or "",
            "type": details.get("type") or "",
            "power": details.get("power"),
            "damage_class": details.get("class") or "",
            "priority": details.get("priority") or 0,
            "kind": fallback_kind,
        })

    entries.sort(key=lambda item: item["percent"] if item["percent"] is not None else -1, reverse=True)
    return entries[:limit]


def spread_entries(raw_map, limit=6):
    entries = []
    for key, value in raw_map.items():
        if ":" not in str(key):
            continue
        nature, spread = str(key).split(":", 1)
        entries.append({
            "nature": display_name(nature),
            "spread": spread,
            "percent": percent(value),
        })
    entries.sort(key=lambda item: item["percent"] if item["percent"] is not None else -1, reverse=True)
    return entries[:limit]


def tera_type_entries(raw_map, limit=12):
    entries = []
    for key, value in raw_map.items():
        if key is None or str(key).lower() in {"", "none", "nothing"}:
            continue
        entries.append({
            "slug": slugify(key),
            "name": display_name(key),
            "percent": percent(value),
        })
    entries.sort(key=lambda item: item["percent"] if item["percent"] is not None else -1, reverse=True)
    return entries[:limit]


def move_entries(conn, slug, regulation_table, usage_moves, move_lookup):
    moves = []
    seen = set()

    if regulation_table and table_exists(conn, regulation_table):
        row = one_row(conn, regulation_table, slug)
        if row:
            for column in row.keys():
                if not column.startswith("move_"):
                    continue
                move_slug = row[column]
                if not move_slug or move_slug in seen:
                    continue
                seen.add(move_slug)
                details = move_lookup.get(str(move_slug).lower(), {})
                moves.append({
                    "slug": str(move_slug),
                    "name": details.get("display_name") or display_name(move_slug),
                    "description": details.get("description") or "",
                    "type": details.get("type") or "",
                    "power": details.get("power"),
                    "damage_class": details.get("class") or "",
                    "priority": details.get("priority") or 0,
                    "percent": usage_moves.get(str(move_slug), {}).get("percent"),
                })

    usage_only = [
        item for item in usage_moves.values()
        if item["slug"] not in seen
    ]
    moves.extend(usage_only)
    moves.sort(key=lambda item: item["percent"] if item["percent"] is not None else -1, reverse=True)
    return moves


def teammate_entries(raw_map, pokemon_by_slug, limit=10):
    entries = []
    for key, value in raw_map.items():
        slug = slugify(key)
        target = pokemon_by_slug.get(slug)
        entries.append({
            "slug": slug,
            "display_name": target["display_name"] if target else display_name(key),
            "percent": percent(value),
            "image": target["primary_image"] if target else "",
            "url": f"pokemon/{target['page_slug']}/" if target else f"pokemon/{slug}/",
        })
    entries.sort(key=lambda item: item["percent"] if item["percent"] is not None else -1, reverse=True)
    return entries[:limit]


def pokemon_rows(conn, regulations):
    membership = {}
    all_slugs = set()

    for regulation in regulations:
        regulation_table = f"regulation_{regulation}_pokemon"
        if table_exists(conn, regulation_table):
            slugs = {
                row["pokemon_slug"]
                for row in conn.execute(f'SELECT pokemon_slug FROM "{regulation_table}"')
                if row["pokemon_slug"]
            }
        else:
            raise RuntimeError(f"Missing regulation table: {regulation_table}")
        membership[regulation] = slugs
        all_slugs.update(slugs)

    if not all_slugs:
        return []

    placeholders = ",".join("?" for _ in all_slugs)
    key_rows = conn.execute(
        f"""
        SELECT p.*
        FROM key_pokemon p
        WHERE p.pokemon_slug IN ({placeholders})
        ORDER BY COALESCE(NULLIF(p.display_name, ''), p.pokemon_slug)
        """,
        sorted(all_slugs),
    ).fetchall()
    key_by_slug = {row["pokemon_slug"]: dict(row) for row in key_rows}

    keyed_rows = []
    for slug in sorted(all_slugs, key=lambda value: (key_by_slug.get(value) or {}).get("display_name") or value):
        pokemon = key_by_slug.get(slug)
        if not pokemon:
            pokemon = {"pokemon_slug": slug}

        pokemon["pokemon_slug"] = slug
        if not pokemon.get("display_name"):
            pokemon["display_name"] = pokemon_display_name(pokemon["pokemon_slug"])
        if not pokemon.get("species_slug"):
            pokemon["species_slug"] = slug
        if not pokemon.get("sprite_slug"):
            pokemon["sprite_slug"] = slug
        if not pokemon.get("smogon_names"):
            pokemon["smogon_names"] = slug
        pokemon["regulations"] = [
            regulation
            for regulation in regulations
            if pokemon["pokemon_slug"] in membership.get(regulation, set())
        ]
        keyed_rows.append(pokemon)

    return keyed_rows


def usage_bundle_for(conn, category_histories, row):
    slug = row["pokemon_slug"]

    for regulation in row["regulations"]:
        history = category_histories.get(regulation, {})
        ability_row, ability_month = first_category_row(conn, history, "abilities", slug, "abilities_json")
        item_row, item_month = first_category_row(conn, history, "items", slug, "items_json")
        move_row, move_month = first_category_row(conn, history, "moves", slug, "moves_json")
        spread_row, spread_month = first_category_row(conn, history, "spreads", slug, "spreads_json")
        teammate_row, teammate_month = first_category_row(conn, history, "teammates", slug, "teammates_json")
        tera_row, tera_month = first_category_row(conn, history, "tera_types", slug, "tera_types_json")

        if any([ability_row, item_row, move_row, spread_row, teammate_row, tera_row]):
            return {
                "regulation": regulation,
                "rows": {
                    "abilities": ability_row,
                    "items": item_row,
                    "moves": move_row,
                    "spreads": spread_row,
                    "teammates": teammate_row,
                    "tera_types": tera_row,
                },
                "months": {
                    "abilities": ability_month or "",
                    "items": item_month or "",
                    "moves": move_month or "",
                    "spreads": spread_month or "",
                    "teammates": teammate_month or "",
                    "tera_types": tera_month or "",
                },
            }

    return {
        "regulation": row["regulations"][0] if row["regulations"] else "",
        "rows": {
            "abilities": None,
            "items": None,
            "moves": None,
            "spreads": None,
            "teammates": None,
            "tera_types": None,
        },
        "months": {
            "abilities": "",
            "items": "",
            "moves": "",
            "spreads": "",
            "teammates": "",
            "tera_types": "",
        },
    }


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_content(path, title, data_key, content_type="pokemon"):
    path.parent.mkdir(parents=True, exist_ok=True)
    safe_title = title.replace('"', '\\"')
    path.write_text(
        "---\n"
        f'title: "{safe_title}"\n'
        f'type: "{content_type}"\n'
        f'data_key: "{data_key}"\n'
        "---\n",
        encoding="utf-8",
    )


def clean_generated(root):
    content_dir = root / "content" / "pokemon"
    if content_dir.exists():
        for path in content_dir.glob("*.md"):
            if path.name != "_index.md":
                path.unlink()

    data_dir = root / "data" / "pokemon"
    if data_dir.exists():
        shutil.rmtree(data_dir)

    index = root / "data" / "pokemon_index.json"
    if index.exists():
        index.unlink()

    for section in ["items", "moves", "abilities"]:
        content_dir = root / "content" / section
        if content_dir.exists():
            for path in content_dir.glob("*.md"):
                if path.name != "_index.md":
                    path.unlink()

        data_dir = root / "data" / section
        if data_dir.exists():
            shutil.rmtree(data_dir)

        index = root / "data" / f"{section}_index.json"
        if index.exists():
            index.unlink()

    for path in [
        root / "data" / "move_effects.json",
        root / "data" / "move_targets.json",
        root / "data" / "status_immunities.json",
        root / "data" / "reports" / "move_keys_report.json",
    ]:
        if path.exists():
            path.unlink()


def add_common_user(collection, entry, pokemon, image=None):
    page_slug = slugify(entry["slug"])
    record = collection.setdefault(page_slug, {
        "slug": page_slug,
        "display_name": entry["name"],
        "description": entry.get("description") or "",
        "type": entry.get("type") or "",
        "power": entry.get("power"),
        "damage_class": entry.get("damage_class") or "",
        "priority": entry.get("priority", 0),
        "image": image or "",
        "regulations": set(),
        "common_users": [],
    })
    for regulation in pokemon.get("regulations") or [pokemon["regulation"]]:
        record["regulations"].add(regulation)
    user = {
        "display_name": pokemon["display_name"],
        "url": f"pokemon/{pokemon['page_slug']}/",
        "percent": entry.get("percent"),
    }
    if not any(existing["url"] == user["url"] for existing in record["common_users"]):
        record["common_users"].append(user)


def finalize_collection(root, section, collection):
    index = []
    for slug, record in sorted(collection.items(), key=lambda item: item[1]["display_name"]):
        record["regulations"] = sorted(record["regulations"])
        record["common_users"].sort(key=lambda item: item["percent"] if item["percent"] is not None else -1, reverse=True)
        record["common_users"] = record["common_users"][:20]

        write_json(root / "data" / section / f"{slug}.json", record)
        write_content(root / "content" / section / f"{slug}.md", record["display_name"], slug, section)

        summary_parts = []
        if section == "moves":
            if record.get("description"):
                summary_parts.append(record["description"])
        else:
            if record.get("type"):
                summary_parts.append(display_name(record["type"]))
            if record.get("damage_class"):
                summary_parts.append(display_name(record["damage_class"]))
            if record.get("description"):
                summary_parts.append(record["description"])

        index.append({
            "display_name": record["display_name"],
            "slug": slug,
            "url": f"{section}/{slug}/",
            "image": record.get("image") or (f"Images/type_icons/{record['type']}.svg" if record.get("type") else ""),
            "regulations": record["regulations"],
            "summary": " | ".join(summary_parts[:2]),
            "description": record.get("description") or "",
            "type": record.get("type") or "",
            "damage_class": record.get("damage_class") or "",
            "power": record.get("power") or 0,
            "priority": record.get("priority") or 0,
        })

    write_json(root / f"data/{section}_index.json", index)


def build(args):
    database = Path(args.database).resolve()
    root = Path(args.root).resolve()
    regulations = parse_regulations(args.regulations or args.regulation)

    conn = sqlite3.connect(database)
    conn.row_factory = sqlite3.Row

    rows = pokemon_rows(conn, regulations)
    category_histories = {
        regulation: category_table_history(conn, regulation)
        for regulation in regulations
    }
    ability_lookup = build_ability_lookup(conn)
    item_lookup = build_item_lookup(conn)
    move_lookup = build_move_lookup(conn)
    move_effects, move_targets, status_immunities, move_keys_report = build_move_keys(move_lookup)
    item_pages = {}
    move_pages = {}
    ability_pages = {}

    base_index = []
    index_by_page_slug = {}
    pokemon_by_slug = {}
    used_page_slugs = set()

    for row in rows:
        page_slug = slugify(row["display_name"])
        if page_slug in used_page_slugs:
            page_slug = slugify(row["pokemon_slug"])
        used_page_slugs.add(page_slug)

        base = {
            "pokemon_slug": row["pokemon_slug"],
            "page_slug": page_slug,
            "display_name": row["display_name"],
            "primary_image": pokemon_image(row, "primary_image"),
        }
        pokemon_by_slug[row["pokemon_slug"]] = base
        pokemon_by_slug[slugify(row["display_name"])] = base
        index_entry = {
            "display_name": row["display_name"],
            "slug": page_slug,
            "url": f"pokemon/{page_slug}/",
            "primary_image": base["primary_image"],
            "regulations": row["regulations"],
            "types": [
                slugify(row[column])
                for column in ["type1", "type2"]
                if column in row.keys() and row[column]
            ],
            "stats": {
                key: row[key] if key in row.keys() else 0
                for key, _ in STAT_LABELS
            },
            "has_usage_data": False,
            "summary": "No usage data",
        }
        base_index.append(index_entry)
        index_by_page_slug[page_slug] = index_entry

    clean_generated(root)

    for row in rows:
        base = pokemon_by_slug[row["pokemon_slug"]]
        slug = row["pokemon_slug"]
        data_key = base["page_slug"]

        usage_bundle = usage_bundle_for(conn, category_histories, row)
        usage_regulation = usage_bundle["regulation"]
        usage_rows = usage_bundle["rows"]
        usage_months = usage_bundle["months"]
        ability_row = usage_rows["abilities"]
        item_row = usage_rows["items"]
        move_row = usage_rows["moves"]
        spread_row = usage_rows["spreads"]
        teammate_row = usage_rows["teammates"]
        tera_row = usage_rows["tera_types"]
        has_usage_data = any([ability_row, item_row, move_row, spread_row, teammate_row, tera_row])

        abilities = ranked_json_entries(
            read_json_map(ability_row["abilities_json"] if ability_row else None),
            ability_lookup,
            "ability",
            limit=3,
        )
        items = ranked_json_entries(
            read_json_map(item_row["items_json"] if item_row else None),
            item_lookup,
            "item",
            limit=12,
        )
        for item in items:
            item["image"] = item_image(item["slug"], item_lookup)

        usage_moves = {
            entry["slug"]: entry
            for entry in ranked_json_entries(
                read_json_map(move_row["moves_json"] if move_row else None),
                move_lookup,
                "move",
                limit=30,
            )
        }

        type_values = []
        for column in ["type1", "type2"]:
            if column in row.keys() and row[column]:
                type_values.append({
                    "name": display_name(row[column]),
                    "slug": slugify(row[column]),
                })

        data = {
            "pokemon_slug": slug,
            "display_name": row["display_name"],
            "regulation": usage_regulation,
            "regulations": row["regulations"],
            "usage_regulation": usage_regulation if has_usage_data else "",
            "has_usage_data": has_usage_data,
            "usage": {
                "percent": None,
                "raw_count": None,
                "source_key": "",
                "month": "",
            },
            "data_months": usage_months,
            "primary_image": base["primary_image"],
            "secondary_image": pokemon_image(row, "secondary_image"),
            "types": type_values,
            "stats": [
                {"key": key, "label": label, "value": row[key] if key in row.keys() else 0}
                for key, label in STAT_LABELS
            ],
            "abilities": abilities,
            "items": items,
            "spreads": spread_entries(read_json_map(spread_row["spreads_json"] if spread_row else None)),
            "tera_types": tera_type_entries(read_json_map(tera_row["tera_types_json"] if tera_row else None)),
            "moves": move_entries(
                conn,
                slug,
                f"regulation_{usage_regulation}_pokemon" if usage_regulation else None,
                usage_moves,
                move_lookup,
            ),
            "teammates": teammate_entries(
                read_json_map(teammate_row["teammates_json"] if teammate_row else None),
                pokemon_by_slug,
            ),
        }

        index_by_page_slug[data_key]["has_usage_data"] = data["has_usage_data"]
        if data["has_usage_data"]:
            type_summary = " / ".join(item["name"] for item in type_values)
            usage_summary = "Usage data available"
            index_by_page_slug[data_key]["summary"] = (
                f"{type_summary} | {usage_summary}" if type_summary else usage_summary
            )

        pokemon_ref = {
            "display_name": row["display_name"],
            "page_slug": data_key,
            "regulation": usage_regulation or (row["regulations"][0] if row["regulations"] else ""),
            "regulations": row["regulations"],
        }
        for ability in abilities:
            add_common_user(ability_pages, ability, pokemon_ref)
        for column in ["ability_1", "ability_2", "hidden_ability"]:
            if column in row.keys() and row[column]:
                details = ability_lookup.get(str(row[column]).lower()) or ability_lookup.get(compact_id(row[column])) or {}
                add_common_user(ability_pages, {
                    "slug": details.get("ability_slug") or row[column],
                    "name": details.get("display_name") or display_name(row[column]),
                    "description": details.get("description") or "",
                    "percent": None,
                }, pokemon_ref)
        for item in items:
            add_common_user(item_pages, item, pokemon_ref, item.get("image"))
        for move in data["moves"]:
            add_common_user(move_pages, move, pokemon_ref)

        write_json(root / "data" / "pokemon" / f"{data_key}.json", data)
        write_content(root / "content" / "pokemon" / f"{data_key}.md", row["display_name"], data_key)

    write_json(root / "data" / "pokemon_index.json", base_index)
    finalize_collection(root, "items", item_pages)
    finalize_collection(root, "moves", move_pages)
    finalize_collection(root, "abilities", ability_pages)
    write_json(root / "data" / "move_effects.json", move_effects)
    write_json(root / "data" / "move_targets.json", move_targets)
    write_json(root / "data" / "status_immunities.json", status_immunities)
    write_json(root / "data" / "reports" / "move_keys_report.json", move_keys_report)
    conn.close()
    print(f"Generated {len(rows)} Pokemon pages for regulations {', '.join(regulations)}.")


def main():
    parser = argparse.ArgumentParser(description="Build Hugo content from champions_key.db.")
    parser.add_argument("--database", default=str(ROOT / "champions_key.db"))
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--regulation", default="ma,mb")
    parser.add_argument("--regulations")
    args = parser.parse_args()
    build(args)


if __name__ == "__main__":
    main()
