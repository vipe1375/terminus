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

function strNoAccent(a) { return ('' + a).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function normalizeText(text) {
  return strNoAccent(text.toLowerCase());
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
      let ind = normalizeText(arr[i]).indexOf(normalizeText(val));
      if (ind != -1) {
        nSuggestions += 1;

        const used = guesses.some((g) => g.name.toLowerCase() === arr[i].toLowerCase())
        
        b = document.createElement("div");
        b.innerHTML = arr[i].slice(0, ind) + "<strong>" + arr[i].slice(ind, ind+val.length) + "</strong>" + arr[i].slice(ind+val.length);
        b.dataset.value = arr[i];   

        if (used) {
          b.classList.add("autocomplete-used");
        } else {
          b.addEventListener("click", function () {
            inp.value = this.dataset.value;
            closeAllLists();
          });
        }

        a.appendChild(b);
      }
    }
  });

  inp.addEventListener("keydown", function (e) {
    const items = this.parentNode.querySelectorAll(".autocomplete-items div");
    if (!items.length) return;
  
    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentFocus++;
      setActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentFocus--;
      setActive(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentFocus > -1) items[currentFocus].click();
    }
  });
  
  function setActive(items) {
    items.forEach((el) => el.classList.remove("autocomplete-active"));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
  }

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

function renderStreak() {
  streak = loadStreak();
  if (streak != 0 && streak != null) {
    streakText = document.getElementById("streakText")
    streakText.textContent = `${streak}🔥`;
    streakText.style.fontWeight = 600;
  }
}

function renderArchiveSubHeader(date) {
  var header = document.getElementById("archiveSubHeader");
  const [y, m, day] = date.split("-");
  const nice = `${day}/${m}/${y}`;
  header.textContent = `Archive du ${nice}`;
  header.style = ""
}
