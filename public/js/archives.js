/* Liste des anciens jours (date + difficulté), jouables sans spoil. */
const levels = {
  1: ["Très facile", "#2E8FFF"],
  2: ["Facile", "#3BB143"],
  3: ["Moyen", "#F5C518"],
  4: ["Difficile", "#FF8C00"],
  5: ["Très difficile", "#E03131"],
};

async function loadArchive() {
  const days = await fetch("/api/archive").then((r) => r.json());
  const container = document.getElementById("archiveList");

  days.forEach((d) => {
    const [text, color] = levels[d.difficulty];

    const row = document.createElement("a");
    row.href = `/?date=${d.date}`;
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.padding = "8px";
    row.style.textDecoration = "none";
    row.style.color = "inherit";

    const dot = document.createElement("span");
    dot.style.width = "12px";
    dot.style.height = "12px";
    dot.style.borderRadius = "50%";
    dot.style.background = color;

    const label = document.createElement("span");
    const nice = new Date(d.date).toLocaleDateString("fr-FR");
    label.textContent = `${nice} — ${text}`;

    row.appendChild(dot);
    row.appendChild(label);
    container.appendChild(row);
  });
}

loadArchive();
