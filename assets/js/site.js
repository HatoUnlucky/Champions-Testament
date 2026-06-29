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

  const formatInputs = Array.from(calculator.querySelectorAll('input[name="battle-format"]'));
  const trickRoom = calculator.querySelector("[data-turn-trick-room]");
  const calculateButton = calculator.querySelector("[data-calculate-turn]");
  const results = calculator.querySelector("[data-turn-results]");
  const summary = calculator.querySelector("[data-turn-summary]");
  const slots = Array.from(calculator.querySelectorAll("[data-battle-slot]"));

  function selectedFormat() {
    return formatInputs.find(input => input.checked)?.value || "double";
  }

  function isSlotActive(slot) {
    return !slot.hidden && slot.querySelector("[data-will-move]")?.checked;
  }

  function opposingSide(side) {
    return side === "left" ? "right" : "left";
  }

  function slotLabel(slot) {
    const sideName = slot.dataset.side === "left" ? "Team A" : "Team B";
    return `${sideName} Slot ${slot.dataset.battleSlot}`;
  }

  function findSlot(side, slotNumber) {
    return calculator.querySelector(`[data-battle-slot][data-side="${side}"][data-battle-slot="${slotNumber}"]`);
  }

  function activeSpeed(slot) {
    const baseSpeed = Number(slot.querySelector("[data-turn-speed]")?.value || 0);
    const sidePanel = slot.closest("[data-battle-side]");
    const tailwind = sidePanel?.querySelector("[data-side-tailwind]")?.checked;
    return Math.max(0, Math.floor(baseSpeed * (tailwind ? 2 : 1)));
  }

  function selectedTargets(slot) {
    return Array.from(slot.querySelectorAll(".target-picker input:checked"))
      .map(input => findSlot(input.dataset.targetSide, input.dataset.targetSlot))
      .filter(target => target && !target.hidden);
  }

  function readAction(slot) {
    const pokemon = slot.querySelector("[data-turn-pokemon]")?.value.trim() || slotLabel(slot);
    const move = slot.querySelector("[data-turn-move]")?.value.trim() || "Selected move";
    const priority = Number(slot.querySelector("[data-turn-priority]")?.value || 0);
    const speed = activeSpeed(slot);

    return {
      slot,
      pokemon,
      move,
      priority,
      speed,
      targets: selectedTargets(slot)
    };
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

  function updateFormat() {
    const singles = selectedFormat() === "single";

    slots.forEach(slot => {
      const secondSlot = slot.dataset.battleSlot === "2";
      slot.hidden = singles && secondSlot;

      if (slot.hidden) {
        slot.querySelectorAll(".target-picker input").forEach(input => {
          input.checked = false;
        });
      }
    });

    calculator.querySelectorAll("[data-double-only]").forEach(option => {
      const input = option.querySelector("input");
      const target = findSlot(input.dataset.targetSide, input.dataset.targetSlot);
      const unavailable = singles || !target || target.hidden;
      option.hidden = unavailable;
      if (unavailable) input.checked = false;
    });

    calculator.querySelectorAll("[data-active-count]").forEach(label => {
      label.textContent = singles ? "1 active Pokemon" : "2 active Pokemon";
    });

    clearResults(
      singles
        ? "Singles mode active. Only slot 1 on each side can act."
        : "Doubles mode active. Both slots on each side can act."
    );
  }

  function compareActions(first, second) {
    if (first.priority !== second.priority) return second.priority - first.priority;
    if (trickRoom?.checked) return first.speed - second.speed;
    return second.speed - first.speed;
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
          const name = target.querySelector("[data-turn-pokemon]")?.value.trim();
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
    const actions = slots
      .filter(isSlotActive)
      .map(readAction)
      .filter(action => action.targets.length > 0);

    if (!actions.length) {
      clearResults("Enable at least one active slot and select a legal target.", true);
      return;
    }

    actions.sort(compareActions);
    results.replaceChildren(...actions.map(renderAction));
    summary.textContent = `${actions.length} action${actions.length === 1 ? "" : "s"} ordered`;
  }

  formatInputs.forEach(input => input.addEventListener("change", updateFormat));
  trickRoom?.addEventListener("change", () => clearResults("Field condition changed. Recalculate turn order."));
  calculator.querySelectorAll("[data-side-tailwind], [data-will-move], .target-picker input").forEach(input => {
    input.addEventListener("change", () => clearResults("Action state changed. Recalculate turn order."));
  });
  calculator.querySelectorAll("[data-turn-pokemon], [data-turn-move], [data-turn-priority], [data-turn-speed]").forEach(input => {
    input.addEventListener("input", () => {
      summary.textContent = "Edited";
    });
  });
  calculateButton?.addEventListener("click", calculateTurn);

  updateFormat();
});
