/* Liste des anciens jours (date + difficulté), jouables sans spoil. */
const levels = {
  1: ["Très facile", "#2E8FFF"],
  2: ["Facile", "#3BB143"],
  3: ["Moyen", "#F5C518"],
  4: ["Difficile", "#FF8C00"],
  5: ["Très difficile", "#E03131"],
};

const stateColors = {
  new: "transparent",   // pas commencée
  playing: "#FFF4CC",   // en cours (jaune pâle)
  done: "#D4F7D4",      // terminée (vert pâle)
};

function gameState(date) {
  const saved = JSON.parse(localStorage.getItem(`metro-du-jour:${date}`) || "null");
  if (!saved) return { state: "new", points: null };
  return { state: saved.endGame ? "done" : "playing", points: saved.points };
}

async function loadArchive() {
  const days = await fetch("/api/archive").then((r) => r.json());
  const container = document.getElementById("archiveList");

  // En-tête
  const header = document.createElement("div");
  header.style.display = "grid";
  header.style.gridTemplateColumns = "2fr 2fr 1fr";
  header.style.padding = "8px";
  header.style.fontWeight = 600;
  header.innerHTML =
    "<span>Date</span>" +
    "<span style='text-align:center'>Difficulté</span>" +
    "<span style='text-align:right'>Points</span>";
  container.appendChild(header);

  days.forEach((d) => {
    const [text, iconColor] = levels[d.difficulty];
    const { state, points: archivePoints } = gameState(d.date);

    const row = document.createElement("a");
    row.href = `/?date=${d.date}`;
    row.style.display = "grid";
    row.style.gridTemplateColumns = "2fr 2fr 1fr";
    row.style.alignItems = "center";
    row.style.padding = "8px";
    row.style.textDecoration = "none";
    row.style.color = "inherit";
    row.style.background = stateColors[state];
    row.style.borderRadius = "6px";

    // Colonne 1 : pastille + date
    const [y, m, day] = d.date.split("-");
    const label = document.createElement("span");
    label.textContent = `${day}/${m}/${y}`;

    const dateCell = document.createElement("span");
    dateCell.style.display = "flex";
    dateCell.style.alignItems = "center";
    dateCell.style.gap = "8px";
    dateCell.appendChild(label);

    // Colonne 2 : difficulté + pastille, centrées
    const diffCell = document.createElement("span");
    diffCell.style.display = "flex";
    diffCell.style.alignItems = "center";
    diffCell.style.justifyContent = "left";
    diffCell.style.gap = "8px";
    diffCell.style.width = "100%";
    
    const diffText = document.createElement("span");
    diffText.textContent = text;
    
    const dot = document.createElement("span");
    dot.style.width = "12px";
    dot.style.height = "12px";
    dot.style.borderRadius = "50%";
    dot.style.background = iconColor;
    dot.style.flexShrink = "0"; 

    diffCell.appendChild(dot);
    diffCell.appendChild(diffText);
    

    // Colonne 3 : points, à droite
    const pointsCell = document.createElement("span");
    pointsCell.style.textAlign = "right";
    if (archivePoints != null) pointsCell.textContent = archivePoints;

    row.appendChild(dateCell);
    row.appendChild(diffCell);
    row.appendChild(pointsCell);
    container.appendChild(row);
  });
}

loadArchive();
