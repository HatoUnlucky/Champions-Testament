import argparse
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def slugify(value):
    return str(value or "").strip().lower()


def display_name(slug):
    parts = [part for part in slugify(slug).replace("_", "-").split("-") if part]
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

    def title(part):
        return part.replace("-", " ").title().replace("'S", "'s")

    if parts[0] == "mega":
        name_parts = [title(part) for part in parts[1:]]
        if name_parts and parts[-1] in trailing_letters:
            name_parts[-1] = parts[-1].upper()
        return " ".join(["Mega"] + name_parts).strip()

    if parts[0] in prefix_labels and len(parts) > 1:
        return " ".join([prefix_labels[parts[0]]] + [title(part) for part in parts[1:]])

    if len(parts) > 1 and parts[-1] in suffix_labels:
        return " ".join([title(part) for part in parts[:-1]] + [suffix_labels[parts[-1]]])

    if len(parts) > 1 and parts[-1] in trailing_letters:
        return " ".join([title(part) for part in parts[:-1]] + [parts[-1].upper()])

    return title(slug)


def table_exists(conn, table):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def read_champions(path):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        if not table_exists(conn, "champions"):
            raise RuntimeError(f"{path} does not have a champions table.")

        rows = {}
        for row in conn.execute('SELECT * FROM champions WHERE name IS NOT NULL AND name <> ""'):
            slug = slugify(row["name"])
            rows[slug] = {
                "pokemon_slug": slug,
                "species_slug": slug,
                "sprite_slug": slug,
                "display_name": display_name(slug),
                "slug_name": slug,
                "smogon_names": slug,
                "type1": row["type_1"] or "",
                "type2": row["type_2"] or "",
                "hp": row["hp"] or 0,
                "attack": row["attack"] or 0,
                "defense": row["defense"] or 0,
                "special_attack": row["spatk"] or 0,
                "special_defense": row["spdef"] or 0,
                "speed": row["speed"] or 0,
                "total": row["total"] or 0,
                "is_mega": 1 if "-mega" in slug else 0,
                "is_dynamax": 0,
                "is_gmax": 1 if slug.endswith("-gmax") else 0,
            }
        return rows
    finally:
        conn.close()


def upsert_key_pokemon(conn, champions):
    inserted = 0
    updated = 0

    for slug, row in sorted(champions.items()):
        existing = conn.execute(
            "SELECT pokemon_slug, display_name FROM key_pokemon WHERE pokemon_slug = ?",
            (slug,),
        ).fetchone()

        if existing is None:
            conn.execute(
                """
                INSERT INTO key_pokemon (
                  pokemon_slug, species_slug, sprite_slug, display_name, slug_name, smogon_names,
                  type1, type2, hp, attack, defense, special_attack, special_defense, speed, total,
                  ability_1, ability_2, hidden_ability, is_mega, is_dynamax, is_gmax
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', ?, ?, ?)
                """,
                (
                    row["pokemon_slug"],
                    row["species_slug"],
                    row["sprite_slug"],
                    row["display_name"],
                    row["slug_name"],
                    row["smogon_names"],
                    row["type1"],
                    row["type2"],
                    row["hp"],
                    row["attack"],
                    row["defense"],
                    row["special_attack"],
                    row["special_defense"],
                    row["speed"],
                    row["total"],
                    row["is_mega"],
                    row["is_dynamax"],
                    row["is_gmax"],
                ),
            )
            inserted += 1
            continue

        cursor = conn.execute(
            """
            UPDATE key_pokemon
            SET
              display_name = COALESCE(NULLIF(display_name, ''), ?),
              species_slug = COALESCE(NULLIF(species_slug, ''), ?),
              sprite_slug = COALESCE(NULLIF(sprite_slug, ''), ?),
              slug_name = COALESCE(NULLIF(slug_name, ''), ?),
              smogon_names = COALESCE(NULLIF(smogon_names, ''), ?),
              type1 = COALESCE(NULLIF(type1, ''), ?),
              type2 = COALESCE(NULLIF(type2, ''), ?),
              hp = COALESCE(NULLIF(hp, 0), ?),
              attack = COALESCE(NULLIF(attack, 0), ?),
              defense = COALESCE(NULLIF(defense, 0), ?),
              special_attack = COALESCE(NULLIF(special_attack, 0), ?),
              special_defense = COALESCE(NULLIF(special_defense, 0), ?),
              speed = COALESCE(NULLIF(speed, 0), ?),
              total = COALESCE(NULLIF(total, 0), ?)
            WHERE pokemon_slug = ?
            """,
            (
                row["display_name"],
                row["species_slug"],
                row["sprite_slug"],
                row["slug_name"],
                row["smogon_names"],
                row["type1"],
                row["type2"],
                row["hp"],
                row["attack"],
                row["defense"],
                row["special_attack"],
                row["special_defense"],
                row["speed"],
                row["total"],
                slug,
            ),
        )
        if cursor.rowcount:
            updated += 1

    return inserted, updated


def ensure_mb_membership(conn, champions):
    inserted = 0
    for slug in sorted(champions):
        if conn.execute("SELECT 1 FROM regulation_mb_pokemon WHERE pokemon_slug = ?", (slug,)).fetchone():
            continue
        conn.execute("INSERT INTO regulation_mb_pokemon (pokemon_slug) VALUES (?)", (slug,))
        inserted += 1
    return inserted


def count(conn, sql):
    return conn.execute(sql).fetchone()[0]


def main():
    parser = argparse.ArgumentParser(description="Sync Champions Pokemon key and regulation tables.")
    parser.add_argument("--database", default=str(ROOT / "champions_key.db"))
    parser.add_argument("--champions-database", default=str(ROOT.parent / "Pokedata" / "champions_data.db"))
    parser.add_argument("--ma-target", type=int, default=270)
    args = parser.parse_args()

    champions = read_champions(Path(args.champions_database))
    conn = sqlite3.connect(args.database)
    try:
        with conn:
            key_inserted, key_updated = upsert_key_pokemon(conn, champions)
            mb_inserted = ensure_mb_membership(conn, champions)

        ma_count = count(conn, "SELECT COUNT(*) FROM regulation_ma_pokemon")
        mb_count = count(conn, "SELECT COUNT(*) FROM regulation_mb_pokemon")
        champions_count = len(champions)
        missing_key_count = count(
            conn,
            """
            SELECT COUNT(*)
            FROM (
              SELECT pokemon_slug FROM regulation_ma_pokemon
              UNION
              SELECT pokemon_slug FROM regulation_mb_pokemon
            ) r
            LEFT JOIN key_pokemon k ON k.pokemon_slug = r.pokemon_slug
            WHERE k.pokemon_slug IS NULL
            """,
        )

        print(f"Champions source rows: {champions_count}")
        print(f"key_pokemon inserted: {key_inserted}")
        print(f"key_pokemon checked/updated: {key_updated}")
        print(f"regulation_mb_pokemon inserted: {mb_inserted}")
        print(f"regulation_ma_pokemon rows: {ma_count}")
        print(f"regulation_mb_pokemon rows: {mb_count}")
        print(f"missing key rows for MA/MB: {missing_key_count}")

        if ma_count != args.ma_target:
            raise RuntimeError(f"Expected regulation_ma_pokemon to have {args.ma_target} rows, found {ma_count}.")
        if mb_count != champions_count:
            raise RuntimeError(f"Expected regulation_mb_pokemon to have {champions_count} rows, found {mb_count}.")
        if missing_key_count:
            raise RuntimeError(f"Expected every MA/MB Pokemon to have a key row, found {missing_key_count} missing.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
