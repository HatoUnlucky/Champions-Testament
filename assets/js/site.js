document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("pokemon-search");
  const source = document.getElementById("pokemon-search-index");

  if (!input || !source) return;

  let rows = [];
  try {
    rows = JSON.parse(source.textContent);
  } catch {
    rows = [];
  }

  const byName = new Map(rows.map(row => [String(row.display_name).toLowerCase(), row]));

  input.addEventListener("change", () => {
    const row = byName.get(input.value.trim().toLowerCase());
    if (row && row.url) window.location.href = row.url;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const controls = document.querySelector("[data-directory-controls]");
  const list = document.querySelector("[data-directory-list]");

  if (!controls || !list) return;

  const search = controls.querySelector("[data-directory-search]");
  const regulation = controls.querySelector("[data-regulation-filter]");
  const statSort = controls.querySelector("[data-stat-sort]");
  const statDirection = controls.querySelector("[data-stat-direction]");
  const typeFilter = controls.querySelector("[data-type-filter]");
  const typeFilterSecondary = controls.querySelector("[data-type-filter-secondary]");
  const moveTypeFilter = controls.querySelector("[data-move-type-filter]");
  const moveClassFilter = controls.querySelector("[data-move-class-filter]");
  const moveSort = controls.querySelector("[data-move-sort]");
  const cards = Array.from(list.querySelectorAll(".directory-card"));

  function numericAttribute(element, name) {
    return Number(element.getAttribute(name) || 0);
  }

  function applyFilters() {
    const query = (search?.value || "").trim().toLowerCase();
    const selected = regulation?.value || "all";
    const selectedType = typeFilter?.value || "all";
    const selectedTypeSecondary = typeFilterSecondary?.value || "all";
    const selectedMoveType = moveTypeFilter?.value || "all";
    const selectedMoveClass = moveClassFilter?.value || "all";

    cards.forEach(card => {
      const name = card.dataset.name || "";
      const regulations = (card.dataset.regulations || "").split(",").filter(Boolean);
      const types = (card.dataset.types || "").split(",").filter(Boolean);
      const moveType = card.dataset.moveType || "";
      const damageClass = card.dataset.damageClass || "";
      const matchesName = !query || name.includes(query);
      const matchesRegulation = selected === "all" || regulations.includes(selected);
      const matchesType = selectedType === "all" || types.includes(selectedType);
      const matchesSecondType = selectedTypeSecondary === "all" || types.includes(selectedTypeSecondary);
      const matchesMoveType = selectedMoveType === "all" || moveType === selectedMoveType;
      const matchesMoveClass = selectedMoveClass === "all" || damageClass === selectedMoveClass;

      card.hidden = !(
        matchesName &&
        matchesRegulation &&
        matchesType &&
        matchesSecondType &&
        matchesMoveType &&
        matchesMoveClass
      );
    });

    sortCards();
  }

  function sortCards() {
    const stat = statSort?.value || "alpha";
    const direction = statDirection?.value || "desc";
    const moveSortValue = moveSort?.value || "alpha";

    const sorted = [...cards].sort((a, b) => {
      if (stat !== "alpha") {
        const attribute = `data-stat-${stat}`;
        const left = numericAttribute(a, attribute);
        const right = numericAttribute(b, attribute);
        return direction === "asc" ? left - right : right - left;
      }

      if (moveSortValue !== "alpha") {
        const [key, sortDirection] = moveSortValue.split("-");
        const left = numericAttribute(a, `data-${key}`);
        const right = numericAttribute(b, `data-${key}`);
        const numericSort = sortDirection === "asc" ? left - right : right - left;
        return (
          numericSort ||
          (a.dataset.damageClass || "").localeCompare(b.dataset.damageClass || "") ||
          (a.dataset.moveType || "").localeCompare(b.dataset.moveType || "") ||
          (a.dataset.name || "").localeCompare(b.dataset.name || "")
        );
      }

      return (a.dataset.name || "").localeCompare(b.dataset.name || "");
    });

    sorted.forEach(card => list.appendChild(card));
  }

  search?.addEventListener("input", applyFilters);
  regulation?.addEventListener("change", applyFilters);
  statSort?.addEventListener("change", applyFilters);
  statDirection?.addEventListener("change", applyFilters);
  typeFilter?.addEventListener("change", applyFilters);
  typeFilterSecondary?.addEventListener("change", applyFilters);
  moveTypeFilter?.addEventListener("change", applyFilters);
  moveClassFilter?.addEventListener("change", applyFilters);
  moveSort?.addEventListener("change", applyFilters);
  applyFilters();
});

document.addEventListener("DOMContentLoaded", () => {
  const controls = document.querySelector("[data-pokemon-move-controls]");
  const list = document.querySelector("[data-pokemon-move-list]");

  if (!controls || !list) return;

  const sort = controls.querySelector("[data-pokemon-move-sort]");
  const classToggles = Array.from(controls.querySelectorAll("[data-pokemon-move-class-toggles] input[type='checkbox']"));
  const rows = Array.from(list.querySelectorAll(".move-row"));

  function rowValue(row, key) {
    if (key === "class") return row.getAttribute("data-damage-class") || "";
    return row.getAttribute(`data-${key}`) || "";
  }

  function compareText(left, right, direction) {
    const result = left.localeCompare(right, undefined, { sensitivity: "base" });
    return direction === "asc" ? result : -result;
  }

  function compareNumber(left, right, direction) {
    const leftNumber = Number(left || 0);
    const rightNumber = Number(right || 0);
    return direction === "asc" ? leftNumber - rightNumber : rightNumber - leftNumber;
  }

  function compareName(left, right) {
    return (left.querySelector("strong")?.textContent || "").localeCompare(
      right.querySelector("strong")?.textContent || "",
      undefined,
      { sensitivity: "base" }
    );
  }

  function updateMoves() {
    const activeClasses = new Set(
      classToggles
        .filter(toggle => toggle.checked)
        .map(toggle => toggle.value)
    );

    rows.forEach(row => {
      const rowClass = rowValue(row, "class");
      row.hidden = !activeClasses.has(rowClass);
    });

    const sortValue = sort?.value || "usage";
    [...rows]
      .sort((a, b) => {
        if (sortValue === "alpha") {
          return compareName(a, b) || compareNumber(rowValue(a, "usage"), rowValue(b, "usage"), "desc");
        }

        if (sortValue === "type") {
          return (
            compareText(rowValue(a, "type"), rowValue(b, "type"), "asc") ||
            compareNumber(rowValue(a, "usage"), rowValue(b, "usage"), "desc") ||
            compareName(a, b)
          );
        }

        if (sortValue === "usage") {
          return compareNumber(rowValue(a, "usage"), rowValue(b, "usage"), "desc") || compareName(a, b);
        }

        return (
          compareNumber(rowValue(a, sortValue), rowValue(b, sortValue), "desc") ||
          compareNumber(rowValue(a, "usage"), rowValue(b, "usage"), "desc") ||
          compareName(a, b)
        );
      })
      .forEach(row => list.appendChild(row));
  }

  classToggles.forEach(toggle => toggle.addEventListener("change", updateMoves));
  sort?.addEventListener("change", updateMoves);
  updateMoves();
});

document.addEventListener("DOMContentLoaded", () => {
  const calculator = document.querySelector("[data-turn-calculator]");
  if (!calculator) return;

  const pokemonData = parseJson("turn-pokemon-data", {});
  const moveData = parseJson("turn-move-data", {});
  const itemData = parseJson("turn-item-data", []);
  const pokemonRows = dataRows(pokemonData).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const moveRows = dataRows(moveData).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const itemRows = dataRows(itemData).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  const pokemonByName = new Map(dataRows(pokemonData)
    .map(pokemon => [displayName(pokemon).toLowerCase(), pokemon])
    .filter(([name]) => name));
  const movesByName = new Map(dataRows(moveData)
    .map(move => [displayName(move).toLowerCase(), move])
    .filter(([name]) => name));
  const formatInputs = Array.from(calculator.querySelectorAll('input[name="battle-format"]'));
  const damageModeInputs = Array.from(calculator.querySelectorAll('input[name="damage-mode"]'));
  const weather = calculator.querySelector("[data-turn-weather]");
  const stage = calculator.querySelector("[data-battle-stage]");
  const trickRoom = calculator.querySelector("[data-turn-trick-room]");
  const simulateButton = calculator.querySelector("[data-simulate-turn]");
  const results = calculator.querySelector("[data-turn-results]");
  const summary = calculator.querySelector("[data-turn-summary]");
  const fieldSlots = Array.from(calculator.querySelectorAll("[data-field-slot]"));
  const backdrop = calculator.querySelector("[data-modal-backdrop]");
  const pokemonModal = calculator.querySelector("[data-pokemon-modal]");
  const moveModal = calculator.querySelector("[data-move-modal]");
  const attackerTabs = calculator.querySelector("[data-attacker-tabs]");
  const moveChoices = calculator.querySelector("[data-move-choices]");
  const targetCards = calculator.querySelector("[data-target-cards]");
  const secondaryEffects = calculator.querySelector("[data-secondary-effects]");
  const moveNote = calculator.querySelector("[data-move-picker-note]");

  const defaultMoves = ["", "", "", ""];
  const statKeys = ["hp", "attack", "defense", "special_attack", "special_defense", "speed"];
  const typeChart = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
  };
  const natureEffects = {
    Adamant: ["attack", "special_attack"],
    Bold: ["defense", "attack"],
    Brave: ["attack", "speed"],
    Calm: ["special_defense", "attack"],
    Careful: ["special_defense", "special_attack"],
    Gentle: ["special_defense", "defense"],
    Hasty: ["speed", "defense"],
    Impish: ["defense", "special_attack"],
    Jolly: ["speed", "special_attack"],
    Lax: ["defense", "special_defense"],
    Lonely: ["attack", "defense"],
    Mild: ["special_attack", "defense"],
    Modest: ["special_attack", "attack"],
    Naive: ["speed", "special_defense"],
    Naughty: ["attack", "special_defense"],
    Quiet: ["special_attack", "speed"],
    Rash: ["special_attack", "special_defense"],
    Relaxed: ["defense", "speed"],
    Sassy: ["special_defense", "speed"],
    Timid: ["speed", "attack"]
  };
  const slotState = new Map(fieldSlots.map(slot => [slotKey(slot), {
    pokemon: "",
    item: "",
    ability: "",
    nature: "Serious",
    fullHp: true,
    speed: 100,
    maxHp: 100,
    baseHp: 100,
    hpMin: 100,
    hpMax: 100,
    stats: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
    stages: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
    moves: [...defaultMoves],
    action: null
  }]));

  let editingSlot = null;
  let choosingSide = "left";
  let selectedAttacker = null;
  let selectedMove = null;
  let selectedTargets = new Set();
  let selectedSecondaryEffects = {};

  function parseJson(id, fallback) {
    try {
      const parsed = JSON.parse(document.getElementById(id)?.textContent || "");
      if (typeof parsed === "string" && /^[\s]*[\[{]/.test(parsed)) {
        return JSON.parse(parsed);
      }
      return parsed;
    } catch {
      return fallback;
    }
  }

  function dataRows(value) {
    const rows = Array.isArray(value) ? value : Object.values(value || {});
    return rows.flatMap(row => {
      if (Array.isArray(row)) return row;
      if (row && typeof row === "object" && !row.display_name && !row.name && Object.keys(row).every(key => /^\d+$/.test(key))) {
        return Object.values(row);
      }
      return row;
    }).filter(row => row && typeof row === "object");
  }

  function displayName(row) {
    return String(row?.display_name || row?.name || "");
  }

  function percentLabel(value) {
    return value === null || value === undefined || value === "" ? "" : ` (${Number(value).toFixed(1)}%)`;
  }

  function selectedFormat() {
    return formatInputs.find(input => input.checked)?.value || "double";
  }

  function selectedDamageMode() {
    return damageModeInputs.find(input => input.checked)?.value || "preview";
  }

  function slotKey(slot) {
    return `${slot.dataset.side}-${slot.dataset.slot}`;
  }

  function slotLabel(slot) {
    return `${slot.dataset.side === "left" ? "Team 1" : "Team 2"} Slot ${slot.dataset.slot}`;
  }

  function stateFor(slot) {
    return slotState.get(slotKey(slot));
  }

  function findSlot(side, slotNumber) {
    return calculator.querySelector(`[data-field-slot][data-side="${side}"][data-slot="${slotNumber}"]`);
  }

  function visibleSlots() {
    return fieldSlots.filter(slot => !slot.hidden);
  }

  function slugFromImage(path) {
    const parts = String(path || "").split("/");
    return parts.length > 1 ? parts[parts.length - 2] : "";
  }

  function spritePath(pokemon, side) {
    if (!pokemon?.primary_image) return "";
    const folder = slugFromImage(pokemon.primary_image);
    if (!folder) return pokemon.primary_image;
    return pokemon.primary_image.replace(/[^/]+_primary_image\.png$/, `${folder}_sprite_${side === "left" ? "back" : "front"}.png`);
  }

  function clearResults(message, isError = false) {
    results.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    title.textContent = isError ? "Needs attention." : "Ready.";
    detail.textContent = message;
    empty.append(title, detail);
    results.append(empty);
    summary.textContent = isError ? "Check inputs" : "Ready";
  }

  function moveRecord(name) {
    return movesByName.get(String(name || "").toLowerCase()) || null;
  }

  function pokemonRecord(name) {
    return pokemonByName.get(String(name || "").toLowerCase()) || null;
  }

  function moveTargets(move, attackerSlot) {
    const name = String(move?.display_name || move?.name || "").toLowerCase();
    const description = String(move?.description || "").toLowerCase();
    const opponentSpread = new Set([
      "dazzling gleam", "heat wave", "icy wind", "muddy water", "rock slide", "snarl", "struggle bug", "electroweb"
    ]);
    const allAdjacent = new Set(["earthquake", "surf", "discharge", "lava plume", "boomburst", "bulldoze", "sludge wave"]);
    const allIncludingSelf = new Set(["explosion", "self-destruct", "misty explosion"]);

    if (allIncludingSelf.has(name)) return visibleSlots();
    if (allAdjacent.has(name) || description.includes("all adjacent")) {
      return visibleSlots().filter(slot => slot !== attackerSlot);
    }
    if (sideEffectForMove(name)) {
      return visibleSlots().filter(slot => slot.dataset.side === attackerSlot.dataset.side);
    }
    if (opponentSpread.has(name) || description.includes("targets'")) {
      return visibleSlots().filter(slot => slot.dataset.side !== attackerSlot.dataset.side);
    }
    return visibleSlots().filter(slot => slot.dataset.side !== attackerSlot.dataset.side).slice(0, 1);
  }

  function updateSlotDisplay(slot) {
    const state = stateFor(slot);
    const pokemon = pokemonRecord(state.pokemon);
    const img = slot.querySelector("[data-slot-sprite]");
    const name = slot.querySelector("[data-slot-name]");
    const fill = slot.querySelector("[data-hp-fill]");
    const range = slot.querySelector("[data-hp-range]");

    slot.classList.toggle("has-pokemon", Boolean(pokemon));
    name.textContent = state.pokemon || "Empty";
    img.src = pokemon ? withBase(spritePath(pokemon, slot.dataset.side)) : "";
    img.alt = state.pokemon || "";

    const maxHp = Math.max(1, Number(state.maxHp || 1));
    const minPercent = Math.max(0, Math.min(100, (Number(state.hpMin ?? 0) / maxHp) * 100));
    const maxPercent = Math.max(minPercent, Math.min(100, (Number(state.hpMax ?? maxHp) / maxHp) * 100));
    fill?.style.setProperty("--hp-min", `${minPercent}%`);
    range?.style.setProperty("--hp-min", `${minPercent}%`);
    range?.style.setProperty("--hp-max", `${maxPercent}%`);
  }

  function withBase(path) {
    if (!path) return "";
    const base = document.querySelector(".site-title")?.getAttribute("href") || "/";
    return `${base}${String(path).replace(/^\/+/, "")}`;
  }

  function commonMoveNames(pokemon) {
    const names = (pokemon?.moves || []).map(move => move.name).filter(Boolean);
    return [...names, "", "", "", ""].slice(0, 4);
  }

  function baseStat(pokemon, key) {
    const stats = pokemon?.stats;
    if (Array.isArray(stats)) {
      return Number(stats.find(stat => stat.key === key)?.value || 0);
    }
    return Number(stats?.[key] || 0);
  }

  function natureMultiplier(nature, key) {
    const effect = natureEffects[nature];
    if (!effect) return 1;
    if (effect[0] === key) return 1.1;
    if (effect[1] === key) return 0.9;
    return 1;
  }

  function calculatedStat(pokemon, key, spreadPoints, nature) {
    const base = baseStat(pokemon, key);
    const ev = Math.min(252, Math.max(0, Number(spreadPoints || 0)) * 8);
    const level = 50;
    const core = Math.floor((2 * base + 31 + Math.floor(ev / 4)) * level / 100);

    if (key === "hp") return core + level + 10;
    return Math.floor((core + 5) * natureMultiplier(nature, key));
  }

  function calculatedStats(pokemon, spread, nature) {
    const values = {};
    statKeys.forEach(key => {
      values[key] = calculatedStat(pokemon, key, spread?.[key] || 0, nature);
    });
    values.total = statKeys.reduce((sum, key) => sum + values[key], 0);
    return values;
  }

  function syncDerivedSpeed(state) {
    const pokemon = pokemonRecord(state.pokemon);
    const stats = calculatedStats(pokemon, state.stats, state.nature);
    state.speed = stats.speed || 0;
    state.maxHp = stats.hp || 1;
    state.baseHp = clampHp(state.baseHp ?? state.maxHp, state.maxHp);
    state.hpMin = clampHp(state.hpMin ?? state.maxHp, state.maxHp);
    state.hpMax = clampHp(state.hpMax ?? state.maxHp, state.maxHp);
    state.fullHp = state.hpMax >= state.maxHp;
  }

  function clampHp(value, maxHp) {
    return Math.max(0, Math.min(Number(maxHp || 1), Math.round(Number(value || 0))));
  }

  function hpPercent(raw, maxHp) {
    return Math.round((clampHp(raw, maxHp) / Math.max(1, Number(maxHp || 1))) * 100);
  }

  function boostedStat(value, stage) {
    const numeric = Number(value || 0);
    const boost = Math.max(-6, Math.min(6, Number(stage || 0)));
    if (boost >= 0) return Math.floor(numeric * (2 + boost) / 2);
    return Math.floor(numeric * 2 / (2 - boost));
  }

  function effectiveSlotSpeed(slot, sideState = {}) {
    const state = stateFor(slot);
    let speed = boostedStat(state.speed, state.stages.speed);
    if (sideState[slot.dataset.side]?.tailwind) speed *= 2;
    return Math.max(0, speed);
  }

  function typeEffectiveness(moveType, targetState) {
    const chart = typeChart[String(moveType || "").toLowerCase()] || {};
    return pokemonTypes(targetState).reduce((multiplier, type) => multiplier * (chart[type] ?? 1), 1);
  }

  function weatherModifier(move) {
    const current = weather?.value || "clear";
    const type = String(move?.type || "").toLowerCase();
    if (current === "sun" && type === "fire") return 1.5;
    if (current === "sun" && type === "water") return 0.5;
    if (current === "rain" && type === "water") return 1.5;
    if (current === "rain" && type === "fire") return 0.5;
    return 1;
  }

  function sideDefenseModifier(move, targetSlot, sideState) {
    const targetSide = sideState[targetSlot.dataset.side] || {};
    const damageClass = String(move?.damage_class || "").toLowerCase();
    if (targetSide.auroraVeil) return 0.67;
    if (damageClass === "physical" && targetSide.reflect) return 0.67;
    if (damageClass === "special" && targetSide.lightScreen) return 0.67;
    return 1;
  }

  function offensiveStatKey(move) {
    return String(move?.damage_class || "").toLowerCase() === "special" ? "special_attack" : "attack";
  }

  function defensiveStatKey(move) {
    return String(move?.damage_class || "").toLowerCase() === "special" ? "special_defense" : "defense";
  }

  function damagingMove(move) {
    return Number(move?.power || 0) > 0 && !moveIsStatus(move);
  }

  function damageRange(action, targetSlot, sideState) {
    const move = action.moveRecord;
    if (!damagingMove(move)) return null;

    const attackerState = stateFor(action.slot);
    const targetState = stateFor(targetSlot);
    const attackerPokemon = pokemonRecord(attackerState.pokemon);
    const targetPokemon = pokemonRecord(targetState.pokemon);
    const attackerStats = calculatedStats(attackerPokemon, attackerState.stats, attackerState.nature);
    const targetStats = calculatedStats(targetPokemon, targetState.stats, targetState.nature);
    const attackKey = offensiveStatKey(move);
    const defenseKey = defensiveStatKey(move);
    const attack = Math.max(1, boostedStat(attackerStats[attackKey], attackerState.stages[attackKey]));
    const defense = Math.max(1, boostedStat(targetStats[defenseKey], targetState.stages[defenseKey]));
    const level = 50;
    const base = Math.floor(Math.floor(Math.floor((2 * level / 5 + 2) * Number(move.power) * attack / defense) / 50) + 2);
    const stab = pokemonTypes(attackerState).includes(String(move.type || "").toLowerCase()) ? 1.5 : 1;
    const effectiveness = typeEffectiveness(move.type, targetState);
    const spread = action.targets.length > 1 ? 0.75 : 1;
    const modifier = stab * effectiveness * spread * weatherModifier(move) * sideDefenseModifier(move, targetSlot, sideState);
    const min = Math.max(0, Math.floor(base * modifier * 0.85));
    const max = Math.max(min, Math.floor(base * modifier));

    return { min, max, effectiveness };
  }

  function moveIsStatus(move) {
    return String(move?.damage_class || "").toLowerCase() === "status";
  }

  function pokemonTypes(state) {
    const pokemon = pokemonRecord(state.pokemon);
    return (pokemon?.types || []).map(type => String(type.slug || type).toLowerCase());
  }

  function priorityFor(slot, move) {
    const state = stateFor(slot);
    let priority = Number(move?.priority || 0);
    const ability = String(state.ability || "").toLowerCase();
    const moveType = String(move?.type || "").toLowerCase();

    if (ability === "prankster" && moveIsStatus(move)) priority += 1;
    if (ability === "gale wings" && state.fullHp && moveType === "flying") priority += 1;
    return priority;
  }

  function sideEffectForMove(moveName) {
    const name = String(moveName || "").toLowerCase();
    if (name === "tailwind") return { key: "tailwind", label: "Tailwind" };
    if (name === "reflect") return { key: "reflect", label: "Reflect" };
    if (name === "light screen") return { key: "lightScreen", label: "Light Screen" };
    if (name === "aurora veil") return { key: "auroraVeil", label: "Aurora Veil" };
    return null;
  }

  function secondaryEffectOptions(moveName) {
    const name = String(moveName || "").toLowerCase();
    const options = {
      "dire claw": {
        mode: "single",
        options: [
          { key: "poison", label: "Poison" },
          { key: "paralysis", label: "Paralysis" },
          { key: "sleep", label: "Sleep" }
        ]
      },
      "thunderbolt": { mode: "multi", options: [{ key: "paralysis", label: "Paralysis" }] },
      "discharge": { mode: "multi", options: [{ key: "paralysis", label: "Paralysis" }] },
      "ice beam": { mode: "multi", options: [{ key: "freeze", label: "Freeze" }] },
      "flamethrower": { mode: "multi", options: [{ key: "burn", label: "Burn" }] },
      "flare blitz": { mode: "multi", options: [{ key: "burn", label: "Burn" }] },
      "fake out": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "fire fang": { mode: "multi", options: [{ key: "burn", label: "Burn" }, { key: "flinch", label: "Flinch" }] },
      "rock slide": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "air slash": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "bite": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "dark pulse": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "headbutt": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "iron head": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "zen headbutt": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
      "muddy water": { mode: "multi", options: [{ key: "accuracy", label: "Accuracy drop" }] },
      "snarl": { mode: "always", options: [{ key: "special_attack_down", label: "Sp. Atk drop" }] },
      "icy wind": { mode: "always", options: [{ key: "speed_down", label: "Speed drop" }] },
      "electroweb": { mode: "always", options: [{ key: "speed_down", label: "Speed drop" }] }
    };
    return options[name] || null;
  }

  function seedSlot(slot, name) {
    const state = stateFor(slot);
    const pokemon = pokemonRecord(name);
    state.pokemon = name;
    state.moves = commonMoveNames(pokemon);
    state.ability = pokemon?.abilities?.[0]?.name || "";
    state.item = pokemon?.items?.[0]?.name || "";
    state.nature = pokemon?.spreads?.[0]?.nature || "Serious";
    if (pokemon?.spreads?.[0]) applySpreadToState(state, pokemon.spreads[0]);
    syncDerivedSpeed(state);
    state.baseHp = state.maxHp;
    state.hpMin = state.maxHp;
    state.hpMax = state.maxHp;
    state.fullHp = true;
    updateSlotDisplay(slot);
  }

  function applySpreadToState(state, spread) {
    const keys = ["hp", "attack", "defense", "special_attack", "special_defense", "speed"];
    const values = String(spread?.spread || "").split("/").map(value => Number(value || 0));
    keys.forEach((key, index) => {
      state.stats[key] = values[index] || 0;
    });
    if (spread?.nature) state.nature = spread.nature;
  }

  function updateFormat() {
    const singles = selectedFormat() === "single";

    fieldSlots.forEach(slot => {
      const secondSlot = slot.dataset.slot === "2";
      slot.hidden = singles && secondSlot;
      if (slot.hidden) {
        stateFor(slot).action = null;
      }
    });

    clearHighlights();
    clearResults(
      singles
        ? "Singles mode active. Team 1 and Team 2 each have one active Pokemon."
        : "Doubles mode active. Both active slots are available."
    );
  }

  function openModal(modal) {
    backdrop.hidden = false;
    modal.hidden = false;
  }

  function closeModals() {
    backdrop.hidden = true;
    pokemonModal.hidden = true;
    moveModal.hidden = true;
    clearHighlights();
  }

  function fillSelect(select, values, emptyLabel) {
    select.replaceChildren();
    if (emptyLabel) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = emptyLabel;
      select.append(option);
    }
    values.forEach(value => {
      const option = document.createElement("option");
      if (value && typeof value === "object") {
        option.value = value.value;
        option.textContent = value.label;
      } else {
        option.value = value;
        option.textContent = value;
      }
      select.append(option);
    });
  }

  function globalNameOptions(rows) {
    return rows.map(row => displayName(row)).filter(Boolean);
  }

  function rankedItemOptions(pokemon) {
    const used = new Set();
    const usageOptions = (pokemon?.items || []).map(item => {
      used.add(item.name);
      return {
        value: item.name,
        label: `${item.name}${percentLabel(item.percent)}`
      };
    });
    const remaining = itemRows
      .map(item => displayName(item))
      .filter(name => name && !used.has(name))
      .map(name => ({ value: name, label: name }));
    return [...usageOptions, ...remaining];
  }

  function rankedMoveOptions(pokemon) {
    const used = new Set();
    const usageOptions = (pokemon?.moves || []).map(move => {
      used.add(move.name);
      return {
        value: move.name,
        label: `${move.name}${percentLabel(move.percent)}`
      };
    });
    const remaining = moveRows
      .map(move => displayName(move))
      .filter(name => name && !used.has(name))
      .map(name => ({ value: name, label: name }));
    return [...usageOptions, ...remaining];
  }

  function openPokemonEditor(slot) {
    editingSlot = slot;
    const state = stateFor(slot);
    const pokemon = pokemonRecord(state.pokemon);
    fillSelect(pokemonModal.querySelector("[data-edit-pokemon]"), globalNameOptions(pokemonRows), "Select Pokemon");
    fillPokemonScopedOptions(pokemon, state);
    pokemonModal.querySelector("[data-edit-pokemon]").value = state.pokemon;
    pokemonModal.querySelector("[data-edit-item]").value = state.item;
    pokemonModal.querySelector("[data-edit-full-hp]").checked = state.fullHp;
    pokemonModal.querySelector("[data-edit-nature]").value = state.nature;
    pokemonModal.querySelector("[data-edit-ability]").value = state.ability;
    Object.entries(state.stats).forEach(([key, value]) => {
      const input = pokemonModal.querySelector(`[data-edit-stat="${key}"]`);
      if (input) input.value = value;
    });
    state.moves.forEach((move, index) => {
      pokemonModal.querySelector(`[data-edit-move="${index}"]`).value = move;
    });
    Object.entries(state.stages).forEach(([key, value]) => {
      const output = pokemonModal.querySelector(`[data-edit-stage="${key}"]`);
      if (output) output.textContent = value > 0 ? `+${value}` : String(value);
    });
    renderEditorStats();
    setEditorHealthFromRaw(
      selectedDamageMode() === "persistent" ? state.hpMax : (state.baseHp ?? state.hpMax ?? state.maxHp),
      state.maxHp
    );
    openModal(pokemonModal);
  }

  function fillPokemonScopedOptions(pokemon, state = null) {
    fillSelect(
      pokemonModal.querySelector("[data-edit-item]"),
      rankedItemOptions(pokemon),
      "No item"
    );
    fillSelect(
      pokemonModal.querySelector("[data-edit-ability]"),
      (pokemon?.abilities || []).map(ability => ({
        value: ability.name,
        label: `${ability.name}${percentLabel(ability.percent)}`
      })),
      "Ability"
    );
    fillSpreadOptions(pokemon);
    const moveOptions = rankedMoveOptions(pokemon);
    pokemonModal.querySelectorAll("[data-edit-move]").forEach(select => {
      fillSelect(select, moveOptions, "No move");
    });
    if (state) {
      pokemonModal.querySelector("[data-edit-item]").value = state.item;
      pokemonModal.querySelector("[data-edit-ability]").value = state.ability;
      state.moves.forEach((move, index) => {
        pokemonModal.querySelector(`[data-edit-move="${index}"]`).value = move;
      });
    }
  }

  function fillSpreadOptions(pokemon) {
    const select = pokemonModal.querySelector("[data-edit-spread]");
    select.replaceChildren();
    const custom = document.createElement("option");
    custom.value = "";
    custom.textContent = "Custom";
    select.append(custom);
    (pokemon?.spreads || []).forEach((spread, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${spread.nature} ${spread.spread}${spread.percent ? ` (${spread.percent}%)` : ""}`;
      select.append(option);
    });
  }

  function readEditorSpread() {
    const spread = {};
    statKeys.forEach(key => {
      spread[key] = Number(pokemonModal.querySelector(`[data-edit-stat="${key}"]`)?.value || 0);
    });
    return spread;
  }

  function renderEditorStats() {
    const pokemon = pokemonRecord(pokemonModal.querySelector("[data-edit-pokemon]").value.trim());
    const nature = pokemonModal.querySelector("[data-edit-nature]").value || "Serious";
    const stats = calculatedStats(pokemon, readEditorSpread(), nature);
    const stages = readEditorStages();

    ["total", ...statKeys].forEach(key => {
      const cell = pokemonModal.querySelector(`[data-edit-stat-display="${key}"]`);
      if (!cell) return;
      if (key === "total") {
        cell.textContent = stats[key] || "--";
        return;
      }
      const stage = stages[key] || 0;
      const boosted = boostedStat(stats[key], stage);
      cell.textContent = stage ? `${boosted} (${stats[key]})` : (stats[key] || "--");
    });

    syncEditorHealthAfterMax(stats.hp || 1);
  }

  function editorHealthInputs() {
    return {
      percent: pokemonModal.querySelector("[data-edit-hp-percent]"),
      raw: pokemonModal.querySelector("[data-edit-hp-raw]"),
      slider: pokemonModal.querySelector("[data-edit-hp-slider]"),
      fullHp: pokemonModal.querySelector("[data-edit-full-hp]")
    };
  }

  function setEditorHealthFromRaw(rawValue, maxHp = null) {
    const inputs = editorHealthInputs();
    const max = Number(maxHp || inputs.raw?.max || 1);
    const raw = clampHp(rawValue, max);
    const percent = hpPercent(raw, max);

    if (inputs.raw) {
      inputs.raw.max = String(max);
      inputs.raw.value = String(raw);
    }
    if (inputs.percent) inputs.percent.value = String(percent);
    if (inputs.slider) inputs.slider.value = String(percent);
    if (inputs.fullHp) inputs.fullHp.checked = raw >= max;
  }

  function setEditorHealthFromPercent(percentValue) {
    const inputs = editorHealthInputs();
    const max = Number(inputs.raw?.max || 1);
    const percent = Math.max(0, Math.min(100, Math.round(Number(percentValue || 0))));
    setEditorHealthFromRaw(Math.round(max * percent / 100), max);
  }

  function readEditorHpRaw() {
    const inputs = editorHealthInputs();
    return clampHp(inputs.raw?.value || 0, inputs.raw?.max || 1);
  }

  function syncEditorHealthAfterMax(maxHp) {
    const inputs = editorHealthInputs();
    const currentMax = Number(inputs.raw?.max || maxHp || 1);
    const currentRaw = readEditorHpRaw();
    const currentPercent = hpPercent(currentRaw, currentMax);
    setEditorHealthFromRaw(Math.round(Number(maxHp || 1) * currentPercent / 100), maxHp);
  }

  function readEditorStages() {
    const stages = {};
    statKeys.forEach(key => {
      const text = pokemonModal.querySelector(`[data-edit-stage="${key}"]`)?.textContent || "0";
      stages[key] = Number(text.replace("+", "") || 0);
    });
    return stages;
  }

  function updateStage(key, delta) {
    const output = pokemonModal.querySelector(`[data-edit-stage="${key}"]`);
    if (!output) return;
    const current = Number(output.textContent.replace("+", "") || 0);
    const next = Math.max(-6, Math.min(6, current + Number(delta || 0)));
    output.textContent = next > 0 ? `+${next}` : String(next);
    renderEditorStats();
  }

  function savePokemonEditor() {
    if (!editingSlot) return;
    const state = stateFor(editingSlot);
    const pokemonName = pokemonModal.querySelector("[data-edit-pokemon]").value.trim();
    state.pokemon = pokemonName;
    state.item = pokemonModal.querySelector("[data-edit-item]").value.trim();
    state.ability = pokemonModal.querySelector("[data-edit-ability]").value;
    state.nature = pokemonModal.querySelector("[data-edit-nature]").value;
    Object.keys(state.stats).forEach(key => {
      state.stats[key] = Number(pokemonModal.querySelector(`[data-edit-stat="${key}"]`)?.value || 0);
    });
    state.stages = readEditorStages();
    syncDerivedSpeed(state);
    state.moves = [...defaultMoves].map((_, index) => pokemonModal.querySelector(`[data-edit-move="${index}"]`).value.trim());
    const hp = readEditorHpRaw();
    state.baseHp = hp;
    state.hpMin = hp;
    state.hpMax = hp;
    state.fullHp = hp >= state.maxHp;
    updateSlotDisplay(editingSlot);
    closeModals();
    clearResults(`${slotLabel(editingSlot)} updated.`);
  }

  function compareActions(first, second) {
    if (first.priority !== second.priority) return second.priority - first.priority;
    if (trickRoom?.checked) return first.speed - second.speed;
    return second.speed - first.speed;
  }

  function effectiveSpeed(slot) {
    return effectiveSlotSpeed(slot);
  }

  function actionFor(slot) {
    const state = stateFor(slot);
    const move = moveRecord(state.action?.move);
    return {
      slot,
      pokemon: state.pokemon || slotLabel(slot),
      move: state.action?.move || "No move selected",
      moveRecord: move,
      priority: priorityFor(slot, move),
      speed: effectiveSpeed(slot),
      targets: (state.action?.targets || []).map(key => fieldSlots.find(candidate => slotKey(candidate) === key)).filter(Boolean),
      damage: [],
      secondaryEffects: state.action?.secondaryEffects || {},
      sideConditions: [],
      skipped: false,
      skipReason: ""
    };
  }

  function selectedEffectEntries(action) {
    return Object.entries(action.secondaryEffects || {}).map(([id, label]) => {
      const [targetKey, effectKey] = id.split(":");
      return { targetKey, effectKey, label };
    });
  }

  function actionStopReason(action, hpRanges, flinchedSlots) {
    const key = slotKey(action.slot);
    const hp = hpRanges.get(key);
    if (flinchedSlots.has(key)) return "Flinched before it could move.";
    if (hp?.max <= 0) return "Fainted before it could move.";
    if (hp?.min <= 0) return "May faint before it can move.";
    return "";
  }

  function sideStateSummary(sideState) {
    const labels = [];
    Object.entries(sideState).forEach(([side, state]) => {
      Object.entries(state).forEach(([key, active]) => {
        if (!active) return;
        const label = {
          tailwind: "Tailwind",
          reflect: "Reflect",
          lightScreen: "Light Screen",
          auroraVeil: "Aurora Veil"
        }[key] || key;
        labels.push(`${side === "left" ? "Team 1" : "Team 2"} ${label}`);
      });
    });
    return labels;
  }

  function renderAction(action, index) {
    const card = document.createElement("article");
    const title = document.createElement("strong");
    const meta = document.createElement("div");
    const targets = document.createElement("div");

    card.className = `turn-result-card${action.skipped ? " is-skipped" : ""}`;
    meta.className = "turn-result-meta";
    targets.className = "turn-result-meta";
    title.textContent = action.skipped
      ? `${index + 1}. ${action.pokemon} cannot use ${action.move}`
      : `${index + 1}. ${action.pokemon} uses ${action.move}`;

    [
      `Priority ${action.priority}`,
      `${action.speed} effective Speed`,
      slotLabel(action.slot)
    ].forEach(text => {
      const pill = document.createElement("span");
      pill.textContent = text;
      meta.append(pill);
    });

    if (action.skipped) {
      const pill = document.createElement("span");
      pill.textContent = action.skipReason || "Action skipped";
      targets.append(pill);
      card.append(title, meta, targets);
      return card;
    }

    const targetNames = action.targets.length
      ? action.targets.map(target => {
          const name = stateFor(target)?.pokemon;
          return name || slotLabel(target);
        })
      : ["No target selected"];

    targetNames.forEach(name => {
      const pill = document.createElement("span");
      pill.textContent = `Target: ${name}`;
      targets.append(pill);
    });

    (action.damage || []).forEach(result => {
      const pill = document.createElement("span");
      const note = result.effectiveness === 0 ? "no effect" : `${result.min}-${result.max} HP`;
      pill.textContent = `Damage to ${result.target}: ${note}`;
      targets.append(pill);
    });

    Object.values(action.secondaryEffects || {}).forEach(effect => {
      const pill = document.createElement("span");
      pill.textContent = `Effect: ${effect}`;
      targets.append(pill);
    });

    (action.sideConditions || []).forEach(effect => {
      const pill = document.createElement("span");
      pill.textContent = effect;
      targets.append(pill);
    });

    card.append(title, meta, targets);
    return card;
  }

  function applyActionEffects(action, sideState) {
    const sideEffect = sideEffectForMove(action.move);
    if (sideEffect) sideState[action.slot.dataset.side][sideEffect.key] = true;

    const secondary = secondaryEffectOptions(action.move);
    if (!secondary || secondary.mode !== "always") return;
    secondary.options.forEach(option => {
      action.targets.forEach(target => {
        const targetState = stateFor(target);
        if (option.key === "speed_down") {
          targetState.stages.speed = Math.max(-6, (targetState.stages.speed || 0) - 1);
        }
        if (option.key === "special_attack_down") {
          targetState.stages.special_attack = Math.max(-6, (targetState.stages.special_attack || 0) - 1);
        }
      });
    });
  }

  function applySelectedEffects(action, flinchedSlots) {
    selectedEffectEntries(action).forEach(effect => {
      if (effect.effectKey === "flinch" && effect.targetKey) {
        flinchedSlots.add(effect.targetKey);
      }
    });
  }

  function applyActionDamage(action, sideState, hpRanges) {
    action.damage = action.targets.map(target => {
      const range = damageRange(action, target, sideState);
      const key = slotKey(target);
      const targetState = stateFor(target);
      const hp = hpRanges.get(key) || { min: targetState.maxHp, max: targetState.maxHp };

      if (range) {
        hp.min = Math.max(0, hp.min - range.max);
        hp.max = Math.max(0, hp.max - range.min);
        hpRanges.set(key, hp);
      }

      return {
        target: targetState.pokemon || slotLabel(target),
        min: range?.min || 0,
        max: range?.max || 0,
        effectiveness: range?.effectiveness ?? 1
      };
    });
  }

  function calculateTurn() {
    const previewMode = selectedDamageMode() === "preview";
    if (previewMode) {
      visibleSlots().forEach(slot => {
        const state = stateFor(slot);
        const startHp = clampHp(state.baseHp ?? state.maxHp, state.maxHp);
        state.hpMin = startHp;
        state.hpMax = startHp;
        state.fullHp = startHp >= state.maxHp;
        updateSlotDisplay(slot);
      });
    }

    const pending = visibleSlots()
      .map(actionFor)
      .filter(action => action.targets.length > 0 && action.move !== "No move selected");

    if (!pending.length) {
      clearResults("Choose at least one move and target before simulating.", true);
      return;
    }

    const sideState = { left: {}, right: {} };
    const flinchedSlots = new Set();
    const hpRanges = new Map(visibleSlots().map(slot => {
      const state = stateFor(slot);
      updateSlotDisplay(slot);
      return [slotKey(slot), { min: state.hpMin, max: state.hpMax }];
    }));
    const actions = [];
    while (pending.length) {
      pending.forEach(action => {
        action.speed = effectiveSlotSpeed(action.slot, sideState);
        action.sideConditions = sideStateSummary(sideState).filter(label => label.startsWith(action.slot.dataset.side === "left" ? "Team 1" : "Team 2"));
      });
      pending.sort(compareActions);
      const action = pending.shift();
      const stopReason = actionStopReason(action, hpRanges, flinchedSlots);
      if (stopReason) {
        action.skipped = true;
        action.skipReason = stopReason;
        actions.push(action);
        continue;
      }
      actions.push(action);
      applyActionDamage(action, sideState, hpRanges);
      applySelectedEffects(action, flinchedSlots);
      applyActionEffects(action, sideState);
    }

    hpRanges.forEach((hp, key) => {
      const slot = fieldSlots.find(candidate => slotKey(candidate) === key);
      if (!slot) return;
      const state = stateFor(slot);
      state.hpMin = hp.min;
      state.hpMax = hp.max;
      state.fullHp = state.hpMax >= state.maxHp;
      updateSlotDisplay(slot);
    });

    const cards = actions.map(renderAction);
    const sideLabels = sideStateSummary(sideState);
    if (sideLabels.length) {
      const summaryCard = document.createElement("article");
      summaryCard.className = "turn-result-card";
      summaryCard.innerHTML = `<strong>Field effects after this turn</strong><div class="turn-result-meta">${sideLabels.map(label => `<span>${label}</span>`).join("")}</div>`;
      cards.push(summaryCard);
    }
    results.replaceChildren(...cards);
    summary.textContent = `${actions.length} action${actions.length === 1 ? "" : "s"} ordered`;
  }

  function clearHighlights() {
    fieldSlots.forEach(slot => {
      slot.classList.remove("is-highlighted", "is-selected-target");
    });
  }

  function openMovePicker(side) {
    choosingSide = side;
    selectedAttacker = visibleSlots().find(slot => slot.dataset.side === side) || null;
    selectedMove = null;
    selectedTargets = new Set();
    renderMovePicker();
    openModal(moveModal);
  }

  function renderMovePicker() {
    const attackers = visibleSlots().filter(slot => slot.dataset.side === choosingSide);
    attackerTabs.replaceChildren(...attackers.map(slot => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `attacker-tab${slot === selectedAttacker ? " is-selected" : ""}`;
      button.textContent = stateFor(slot).pokemon || slotLabel(slot);
      button.addEventListener("click", () => {
        selectedAttacker = slot;
        selectedMove = null;
        selectedTargets = new Set();
        selectedSecondaryEffects = {};
        clearHighlights();
        renderMovePicker();
      });
      return button;
    }));

    const attackerState = selectedAttacker ? stateFor(selectedAttacker) : null;
    moveNote.textContent = selectedAttacker
      ? `${attackerState.pokemon || slotLabel(selectedAttacker)} is the attacker.`
      : "Select an attacker first.";

    moveChoices.replaceChildren(...(attackerState?.moves || []).filter(Boolean).map(name => {
      const move = moveRecord(name);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `move-choice-card${selectedMove === name ? " is-selected" : ""}`;
      button.innerHTML = `<strong>${name}</strong><div class="turn-result-meta"><span>Priority ${move?.priority ?? 0}</span><span>${move?.type || "unknown"}</span><span>${move?.damage_class || "move"}</span></div>`;
      button.addEventListener("click", () => chooseMove(name));
      return button;
    }));

    renderTargetCards();
    renderSecondaryEffects();
  }

  function chooseMove(name) {
    selectedMove = name;
    const recommended = moveTargets(moveRecord(name), selectedAttacker).map(slotKey);
    selectedTargets = new Set(recommended);
    selectedSecondaryEffects = {};
    renderMovePicker();
    highlightTargets();
  }

  function renderTargetCards() {
    targetCards.replaceChildren(...visibleSlots().map(slot => {
      const state = stateFor(slot);
      const pokemon = pokemonRecord(state.pokemon);
      const key = slotKey(slot);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `target-card${selectedTargets.has(key) ? " is-selected" : ""}`;
      card.innerHTML = `${pokemon ? `<img src="${withBase(spritePath(pokemon, slot.dataset.side))}" alt="">` : ""}<strong>${state.pokemon || slotLabel(slot)}</strong><div class="turn-result-meta"><span>${slotLabel(slot)}</span></div>`;
      card.addEventListener("click", () => {
        if (selectedTargets.has(key)) selectedTargets.delete(key);
        else selectedTargets.add(key);
        Object.keys(selectedSecondaryEffects)
          .filter(effectKey => effectKey.startsWith(`${key}:`))
          .forEach(effectKey => delete selectedSecondaryEffects[effectKey]);
        renderTargetCards();
        renderSecondaryEffects();
        highlightTargets();
      });
      return card;
    }));
    highlightTargets();
  }

  function renderSecondaryEffects() {
    const effect = secondaryEffectOptions(selectedMove);
    secondaryEffects.replaceChildren();
    if (!effect || !selectedTargets.size) return;

    [...selectedTargets]
      .map(key => fieldSlots.find(slot => slotKey(slot) === key))
      .filter(Boolean)
      .forEach(slot => {
        const targetName = stateFor(slot).pokemon || slotLabel(slot);
        effect.options.forEach(option => {
          const id = `${slotKey(slot)}:${option.key}`;
          const label = document.createElement("label");
          const input = document.createElement("input");
          label.className = "secondary-effect-option";
          label.innerHTML = `<span><strong>${targetName}</strong> ${option.label}</span>`;
          input.type = effect.mode === "single" ? "radio" : "checkbox";
          input.name = effect.mode === "single" ? `secondary-${slotKey(slot)}` : id;
          input.checked = Boolean(selectedSecondaryEffects[id]);
          input.addEventListener("change", () => {
            if (effect.mode === "single") {
              Object.keys(selectedSecondaryEffects)
                .filter(key => key.startsWith(`${slotKey(slot)}:`))
                .forEach(key => delete selectedSecondaryEffects[key]);
            }
            if (input.checked) selectedSecondaryEffects[id] = option.label;
            else delete selectedSecondaryEffects[id];
          });
          label.append(input);
          secondaryEffects.append(label);
        });
      });
  }

  function highlightTargets() {
    clearHighlights();
    if (selectedAttacker) selectedAttacker.classList.add("is-highlighted");
    selectedTargets.forEach(key => {
      const slot = fieldSlots.find(candidate => slotKey(candidate) === key);
      slot?.classList.add("is-selected-target");
    });
  }

  function confirmMove() {
    if (!selectedAttacker || !selectedMove) {
      clearResults("Select an attacker and move before confirming.", true);
      return;
    }
    const state = stateFor(selectedAttacker);
    state.action = {
      move: selectedMove,
      targets: [...selectedTargets],
      secondaryEffects: { ...selectedSecondaryEffects }
    };
    closeModals();
    clearResults(`${state.pokemon || slotLabel(selectedAttacker)} is set to use ${selectedMove}.`);
  }

  function pokemonChangedInEditor() {
    const pokemon = pokemonRecord(pokemonModal.querySelector("[data-edit-pokemon]").value.trim());
    if (!pokemon) return;
    fillPokemonScopedOptions(pokemon);
    commonMoveNames(pokemon).forEach((move, index) => {
      pokemonModal.querySelector(`[data-edit-move="${index}"]`).value = move;
    });
    pokemonModal.querySelector("[data-edit-item]").value = pokemon.items?.[0]?.name || "";
    pokemonModal.querySelector("[data-edit-ability]").value = pokemon.abilities?.[0]?.name || "";
    pokemonModal.querySelector("[data-edit-nature]").value = pokemon.spreads?.[0]?.nature || "Serious";
    if (pokemon.spreads?.[0]) {
      const temp = { stats: {} };
      applySpreadToState(temp, pokemon.spreads[0]);
      Object.entries(temp.stats).forEach(([key, value]) => {
        const input = pokemonModal.querySelector(`[data-edit-stat="${key}"]`);
        if (input) input.value = value;
      });
    } else {
      statKeys.forEach(key => {
        const input = pokemonModal.querySelector(`[data-edit-stat="${key}"]`);
        if (input) input.value = 0;
      });
    }
    renderEditorStats();
    setEditorHealthFromRaw(editorHealthInputs().raw?.max || 1);
  }

  function spreadChangedInEditor() {
    const pokemon = pokemonRecord(pokemonModal.querySelector("[data-edit-pokemon]").value.trim());
    const selected = pokemonModal.querySelector("[data-edit-spread]").value;
    if (selected === "") {
      renderEditorStats();
      return;
    }
    const index = Number(selected);
    const spread = pokemon?.spreads?.[index];
    if (!spread) return;
    const temp = { stats: {}, nature: spread.nature };
    applySpreadToState(temp, spread);
    pokemonModal.querySelector("[data-edit-nature]").value = temp.nature;
    Object.entries(temp.stats).forEach(([key, value]) => {
      pokemonModal.querySelector(`[data-edit-stat="${key}"]`).value = value;
    });
    renderEditorStats();
  }

  fieldSlots.forEach(slot => {
    slot.addEventListener("click", () => openPokemonEditor(slot));
  });
  calculator.querySelectorAll("[data-open-move-picker]").forEach(button => {
    button.addEventListener("click", () => openMovePicker(button.dataset.openMovePicker));
  });
  formatInputs.forEach(input => input.addEventListener("change", updateFormat));
  weather?.addEventListener("change", () => {
    stage.dataset.weather = weather.value || "clear";
  });
  trickRoom?.addEventListener("change", () => clearResults("Field condition changed. Recalculate turn order."));
  damageModeInputs.forEach(input => {
    input.addEventListener("change", () => {
      clearResults(
        selectedDamageMode() === "persistent"
          ? "Per-turn mode active. Damage will carry forward between simulations."
          : "Preview mode active. Simulations start from each Pokemon's saved HP."
      );
    });
  });
  calculator.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeModals);
  });
  backdrop?.addEventListener("click", closeModals);
  pokemonModal.querySelector("[data-edit-pokemon]").addEventListener("change", pokemonChangedInEditor);
  pokemonModal.querySelector("[data-edit-spread]").addEventListener("change", spreadChangedInEditor);
  pokemonModal.querySelector("[data-edit-nature]").addEventListener("change", renderEditorStats);
  pokemonModal.querySelector("[data-edit-hp-raw]").addEventListener("input", event => {
    setEditorHealthFromRaw(event.currentTarget.value);
  });
  pokemonModal.querySelector("[data-edit-hp-percent]").addEventListener("input", event => {
    setEditorHealthFromPercent(event.currentTarget.value);
  });
  pokemonModal.querySelector("[data-edit-hp-slider]").addEventListener("input", event => {
    setEditorHealthFromPercent(event.currentTarget.value);
  });
  pokemonModal.querySelector("[data-edit-full-hp]").addEventListener("change", event => {
    if (event.currentTarget.checked) setEditorHealthFromRaw(editorHealthInputs().raw?.max || 1);
  });
  pokemonModal.querySelectorAll("[data-edit-stat]").forEach(input => {
    input.addEventListener("input", () => {
      pokemonModal.querySelector("[data-edit-spread]").value = "";
      renderEditorStats();
    });
  });
  pokemonModal.querySelectorAll("[data-stage-step]").forEach(button => {
    button.addEventListener("click", () => updateStage(button.dataset.stageStep, button.dataset.stageDelta));
  });
  pokemonModal.querySelector("[data-save-pokemon]").addEventListener("click", savePokemonEditor);
  moveModal.querySelector("[data-confirm-move]").addEventListener("click", confirmMove);
  simulateButton?.addEventListener("click", calculateTurn);

  seedSlot(findSlot("left", "1"), "Incineroar");
  seedSlot(findSlot("left", "2"), "Garchomp");
  seedSlot(findSlot("right", "1"), "Torkoal");
  seedSlot(findSlot("right", "2"), "Corviknight");
  updateFormat();
});
