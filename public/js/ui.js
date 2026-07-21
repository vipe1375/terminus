/* Affichage : tentatives, autocomplétion, points, écrans. */
function renderAttempts() {
  if (guesses.length == 0) {
    document.getElementById("attempts").style.display = "none";
    return;
  }
  document.getElementById("attempts").style.display = "flex";

  const container = document.getElementById("attempts");
  container.innerHTML = "";

  guesses.forEach((g) => {
    const div = document.createElement("div");
    div.textContent = g.name;
    div.style.padding = "4px";
    div.style.borderRadius = "4px";
    div.style.background = g.correct ? "#d4f7d4" : "#ffd6d6";
    container.appendChild(div);
  });
}

function autocomplete(inp, arr) {
  let currentFocus;

  inp.addEventListener("input", function () {
    let a,
      b,
      i,
      val = this.value;

    closeAllLists();
    if (!val) return;

    currentFocus = -1;

    a = document.createElement("div");
    a.className = "autocomplete-items";
    this.parentNode.appendChild(a);

    let nSuggestions = 0;

    for (i = 0; i < arr.length && nSuggestions < maxSuggestions; i++) {
      if (arr[i].substr(0, val.length).toLowerCase() === val.toLowerCase()) {
        nSuggestions += 1;
        b = document.createElement("div");
        b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>" + arr[i].substr(val.length);
        b.dataset.value = arr[i];   // stockage sûr, pas d'échappement HTML

        b.addEventListener("click", function () {
          inp.value = this.dataset.value;          closeAllLists();
        });

        a.appendChild(b);
      }
    }
  });

  function closeAllLists() {
    document
      .querySelectorAll(".autocomplete-items")
      .forEach((el) => el.remove());
  }

  document.addEventListener("click", closeAllLists);
}

function updatePoints(malus) {
  points -= malus;
  if (points < 0) points = 0;
    document.getElementById("pointsText").textContent = `Points : ${points}`;
    if (points === 0) {
      endGame = true;
      document.getElementById("guessForm").style.display = "none";
      showEndScreen();
    }
}

function setDifficultyText() {
  const levels = {
    1: ["Très facile", "#2E8FFF"],   // bleu
    2: ["Facile", "#3BB143"],        // vert
    3: ["Moyen", "#F5C518"],         // jaune
    4: ["Difficile", "#FF8C00"],     // orange
    5: ["Très difficile", "#E03131"] // rouge
  };
  const [text, color] = levels[difficulty];
  document.getElementById("difficultyText").textContent = text;
  document.getElementById("difficultyDot").style.background = color;
}

function initTutorial() {
  const overlay = document.getElementById("tutorialOverlay");
  if (localStorage.getItem("tutorialSeen")) {
    overlay.style.display = "none";
    return;
  }
  document.getElementById("tutorialClose").addEventListener("click", () => {
    overlay.style.display = "none";
    if (document.getElementById("doNotShowAgainCheckbox").checked) {
      localStorage.setItem("tutorialSeen", "1");
    }
  });
}

function renderLineBadges(lines) {
  return (lines || [])
    .map((l) => `<span style="
      display:inline-flex; align-items:center; justify-content:center;
      width:22px; height:22px; margin:0 2px; border-radius:50%;
      background:${l.color}; color:${l.text};
      font-weight:bold; font-size:13px;">${l.short}</span>`)
    .join("");
}

function showEndScreen() {
  let text = null;
  let pointsText = null;
  if (endGame == false) return;
  if (points!=0) {
    text = `Bravo ! Vous avez trouvé la station <strong>${currentStation.name}</strong> ! ${renderLineBadges(currentStation.lines)}`;
    pointsText = `Points : <strong>${points}</strong>`;
  } else {
    text = `Dommage ! La station était <strong>${currentStation.name}</strong> ! ${renderLineBadges(currentStation.lines)}`;

    pointsText = `Essais : <strong>${guesses.length}</strong>`;
  }
  
  document.getElementById("endText").innerHTML = text;
  document.getElementById("endPoints").innerHTML = pointsText;

  const overlay = document.getElementById("endOverlay");
  overlay.style.display = "flex";
  document.getElementById("options").style.display = "none";

  document.getElementById("closeEndDisplay").addEventListener("click", () => {
    overlay.style.display = "none";
  });
}
