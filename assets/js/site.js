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
  const pokemonByName = new Map(dataRows(pokemonData)
    .map(pokemon => [String(pokemon.display_name || pokemon.name || "").toLowerCase(), pokemon])
    .filter(([name]) => name));
  const movesByName = new Map(dataRows(moveData)
    .map(move => [String(move.display_name || move.name || "").toLowerCase(), move])
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
  const moveNote = calculator.querySelector("[data-move-picker-note]");

  const defaultMoves = ["", "", "", ""];
  const slotState = new Map(fieldSlots.map(slot => [slotKey(slot), {
    pokemon: "",
    item: "",
    ability: "",
    nature: "Serious",
    speed: 100,
    stats: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
    moves: [...defaultMoves],
    action: null
  }]));

  let editingSlot = null;
  let choosingSide = "left";
  let selectedAttacker = null;
  let selectedMove = null;
  let selectedTargets = new Set();

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

  function seedSlot(slot, name) {
    const state = stateFor(slot);
    const pokemon = pokemonRecord(name);
    state.pokemon = name;
    state.speed = pokemon?.stats?.find(stat => stat.key === "speed")?.value || pokemon?.stats?.speed || 100;
    state.moves = commonMoveNames(pokemon);
    state.ability = pokemon?.abilities?.[0]?.name || "";
    state.item = pokemon?.items?.[0]?.name || "";
    state.nature = pokemon?.spreads?.[0]?.nature || "Serious";
    if (pokemon?.spreads?.[0]) applySpreadToState(state, pokemon.spreads[0]);
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
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  }

  function openPokemonEditor(slot) {
    editingSlot = slot;
    const state = stateFor(slot);
    const pokemon = pokemonRecord(state.pokemon);
    pokemonModal.querySelector("[data-edit-pokemon]").value = state.pokemon;
    pokemonModal.querySelector("[data-edit-item]").value = state.item;
    pokemonModal.querySelector("[data-edit-speed]").value = state.speed;
    pokemonModal.querySelector("[data-edit-nature]").value = state.nature;
    fillSelect(pokemonModal.querySelector("[data-edit-ability]"), (pokemon?.abilities || []).map(ability => ability.name), "Ability");
    pokemonModal.querySelector("[data-edit-ability]").value = state.ability;
    fillSpreadOptions(pokemon);
    Object.entries(state.stats).forEach(([key, value]) => {
      const input = pokemonModal.querySelector(`[data-edit-stat="${key}"]`);
      if (input) input.value = value;
    });
    state.moves.forEach((move, index) => {
      pokemonModal.querySelector(`[data-edit-move="${index}"]`).value = move;
    });
    openModal(pokemonModal);
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

  function savePokemonEditor() {
    if (!editingSlot) return;
    const state = stateFor(editingSlot);
    const pokemonName = pokemonModal.querySelector("[data-edit-pokemon]").value.trim();
    state.pokemon = pokemonName;
    state.item = pokemonModal.querySelector("[data-edit-item]").value.trim();
    state.ability = pokemonModal.querySelector("[data-edit-ability]").value;
    state.nature = pokemonModal.querySelector("[data-edit-nature]").value;
    state.speed = Number(pokemonModal.querySelector("[data-edit-speed]").value || 0);
    Object.keys(state.stats).forEach(key => {
      state.stats[key] = Number(pokemonModal.querySelector(`[data-edit-stat="${key}"]`)?.value || 0);
    });
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
    return Math.max(0, Number(stateFor(slot).speed || 0));
  }

  function actionFor(slot) {
    const state = stateFor(slot);
    const move = moveRecord(state.action?.move);
    return {
      slot,
      pokemon: state.pokemon || slotLabel(slot),
      move: state.action?.move || "No move selected",
      priority: move?.priority ?? 0,
      speed: effectiveSpeed(slot),
      targets: (state.action?.targets || []).map(key => fieldSlots.find(candidate => slotKey(candidate) === key)).filter(Boolean)
    };
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

    card.append(title, meta, targets);
    return card;
  }

  function calculateTurn() {
    const actions = visibleSlots()
      .map(actionFor)
      .filter(action => action.targets.length > 0 && action.move !== "No move selected");

    if (!actions.length) {
      clearResults("Choose at least one move and target before simulating.", true);
      return;
    }

    actions.sort(compareActions);
    results.replaceChildren(...actions.map(renderAction));
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
  }

  function chooseMove(name) {
    selectedMove = name;
    const recommended = moveTargets(moveRecord(name), selectedAttacker).map(slotKey);
    selectedTargets = new Set(recommended);
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
        renderTargetCards();
        highlightTargets();
      });
      return card;
    }));
    highlightTargets();
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
      targets: [...selectedTargets]
    };
    closeModals();
    clearResults(`${state.pokemon || slotLabel(selectedAttacker)} is set to use ${selectedMove}.`);
  }

  function pokemonChangedInEditor() {
    const pokemon = pokemonRecord(pokemonModal.querySelector("[data-edit-pokemon]").value.trim());
    if (!pokemon) return;
    pokemonModal.querySelector("[data-edit-speed]").value = pokemon.stats?.find(stat => stat.key === "speed")?.value || 100;
    fillSelect(pokemonModal.querySelector("[data-edit-ability]"), (pokemon.abilities || []).map(ability => ability.name), "Ability");
    fillSpreadOptions(pokemon);
    commonMoveNames(pokemon).forEach((move, index) => {
      pokemonModal.querySelector(`[data-edit-move="${index}"]`).value = move;
    });
    pokemonModal.querySelector("[data-edit-item]").value = pokemon.items?.[0]?.name || "";
    pokemonModal.querySelector("[data-edit-nature]").value = pokemon.spreads?.[0]?.nature || "Serious";
    if (pokemon.spreads?.[0]) {
      const temp = { stats: {} };
      applySpreadToState(temp, pokemon.spreads[0]);
      Object.entries(temp.stats).forEach(([key, value]) => {
        const input = pokemonModal.querySelector(`[data-edit-stat="${key}"]`);
        if (input) input.value = value;
      });
    }
  }

  function spreadChangedInEditor() {
    const pokemon = pokemonRecord(pokemonModal.querySelector("[data-edit-pokemon]").value.trim());
    const index = Number(pokemonModal.querySelector("[data-edit-spread]").value);
    const spread = pokemon?.spreads?.[index];
    if (!spread) return;
    const temp = { stats: {}, nature: spread.nature };
    applySpreadToState(temp, spread);
    pokemonModal.querySelector("[data-edit-nature]").value = temp.nature;
    Object.entries(temp.stats).forEach(([key, value]) => {
      pokemonModal.querySelector(`[data-edit-stat="${key}"]`).value = value;
    });
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
  pokemonModal.querySelector("[data-save-pokemon]").addEventListener("click", savePokemonEditor);
  moveModal.querySelector("[data-confirm-move]").addEventListener("click", confirmMove);
  simulateButton?.addEventListener("click", calculateTurn);

  seedSlot(findSlot("left", "1"), "Incineroar");
  seedSlot(findSlot("left", "2"), "Garchomp");
  seedSlot(findSlot("right", "1"), "Torkoal");
  seedSlot(findSlot("right", "2"), "Corviknight");
  updateFormat();
});
