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

    slot.classList.toggle("has-pokemon", Boolean(pokemon));
    name.textContent = state.pokemon || "Empty";
    img.src = pokemon ? withBase(spritePath(pokemon, slot.dataset.side)) : "";
    img.alt = state.pokemon || "";
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
    state.speed = calculatedStats(pokemon, state.stats, state.nature).speed || 0;
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
      "fire fang": { mode: "multi", options: [{ key: "burn", label: "Burn" }, { key: "flinch", label: "Flinch" }] },
      "rock slide": { mode: "multi", options: [{ key: "flinch", label: "Flinch" }] },
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
    state.fullHp = pokemonModal.querySelector("[data-edit-full-hp]").checked;
    state.nature = pokemonModal.querySelector("[data-edit-nature]").value;
    Object.keys(state.stats).forEach(key => {
      state.stats[key] = Number(pokemonModal.querySelector(`[data-edit-stat="${key}"]`)?.value || 0);
    });
    state.stages = readEditorStages();
    syncDerivedSpeed(state);
    state.moves = [...defaultMoves].map((_, index) => pokemonModal.querySelector(`[data-edit-move="${index}"]`).value.trim());
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
      secondaryEffects: state.action?.secondaryEffects || {},
      sideConditions: []
    };
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

    card.className = "turn-result-card";
    meta.className = "turn-result-meta";
    targets.className = "turn-result-meta";
    title.textContent = `${index + 1}. ${action.pokemon} uses ${action.move}`;

    [
      `Priority ${action.priority}`,
      `${action.speed} effective Speed`,
      slotLabel(action.slot)
    ].forEach(text => {
      const pill = document.createElement("span");
      pill.textContent = text;
      meta.append(pill);
    });

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

  function calculateTurn() {
    const pending = visibleSlots()
      .map(actionFor)
      .filter(action => action.targets.length > 0 && action.move !== "No move selected");

    if (!pending.length) {
      clearResults("Choose at least one move and target before simulating.", true);
      return;
    }

    const sideState = { left: {}, right: {} };
    const actions = [];
    while (pending.length) {
      pending.forEach(action => {
        action.speed = effectiveSlotSpeed(action.slot, sideState);
        action.sideConditions = sideStateSummary(sideState).filter(label => label.startsWith(action.slot.dataset.side === "left" ? "Team 1" : "Team 2"));
      });
      pending.sort(compareActions);
      const action = pending.shift();
      actions.push(action);
      applyActionEffects(action, sideState);
    }

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
  calculator.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeModals);
  });
  backdrop?.addEventListener("click", closeModals);
  pokemonModal.querySelector("[data-edit-pokemon]").addEventListener("change", pokemonChangedInEditor);
  pokemonModal.querySelector("[data-edit-spread]").addEventListener("change", spreadChangedInEditor);
  pokemonModal.querySelector("[data-edit-nature]").addEventListener("change", renderEditorStats);
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
