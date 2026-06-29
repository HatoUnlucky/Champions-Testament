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

  const type = controls.querySelector("[data-pokemon-move-type]");
  const damageClass = controls.querySelector("[data-pokemon-move-class]");
  const sort = controls.querySelector("[data-pokemon-move-sort]");
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
    const selectedType = type?.value || "all";
    const selectedClass = damageClass?.value || "all";

    rows.forEach(row => {
      const rowType = rowValue(row, "type");
      const rowClass = rowValue(row, "class");
      const matchesType = selectedType === "all" || rowType === selectedType;
      const matchesClass = selectedClass === "all" || rowClass === selectedClass;
      row.hidden = !(matchesType && matchesClass);
    });

    const sortValue = sort?.value || "alpha";
    [...rows]
      .sort((a, b) => {
        if (sortValue === "alpha") {
          return compareName(a, b);
        }

        const [key, direction] = sortValue.split("-");
        const left = rowValue(a, key);
        const right = rowValue(b, key);
        return (
          compareNumber(left, right, direction) ||
          compareText(rowValue(a, "class"), rowValue(b, "class"), "asc") ||
          compareText(rowValue(a, "type"), rowValue(b, "type"), "asc") ||
          compareName(a, b)
        );
      })
      .forEach(row => list.appendChild(row));
  }

  type?.addEventListener("change", updateMoves);
  damageClass?.addEventListener("change", updateMoves);
  sort?.addEventListener("change", updateMoves);
  updateMoves();
});
