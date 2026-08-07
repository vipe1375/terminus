/* Câblage : logique de jeu et initialisation. Chargé en dernier. */
const actionsByOptionId = {
  streetsNamesOption: changeStreetsNamesState,
  linesOption: changeLinesState,
  neighboursOption: changeNeighboursState,
};

async function guess() {
  const input = document.getElementById("guess");
  const value = input.value.trim();
  if (!value || endGame) return;

  input.value = "";

  const alreadyGuessed = guesses.some(
    (g) => g.name.toLowerCase() === value.toLowerCase()
  );
  if (alreadyGuessed) return;

  const res = await fetch("/api/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: dailyDate, name: value, points: points-costs.attempts }),
  }).then((r) => r.json());

  if (res.error) return; // station inconnue : on ignore simplement

  guesses.push({ name: value, correct: res.correct });

  if (res.name) {
    currentStation.name = res.name;
  }

  if (res.correct) {
    endGame = true;
    document.getElementById("guessForm").style.display = "none";
    showEndScreen();
  }

  if (!res.correct) {
    updatePoints(costs.attempts);
  }
  
  saveProgress();

  console.log("streak =", loadStreak());
  renderAttempts();
  renderStreak();
}

function useOnce(button, action, malus) {
  button.addEventListener("click", () => {
    action(malus);
    button.disabled = true;
    saveProgress();
  });
}

async function main() {
  
  document.getElementById("endOverlay").style.display = "none";
  initTutorial();

  const daily = await loadDaily();
  isArchive = daily.archive;
  dailyDate = daily.date;
  dailyNeighbours = daily.neighbours || [];
  currentStation = { lat: daily.lat, lon: daily.lon, lines: daily.lines, name: null };
  maxRadius = daily.radiusMeters;
  difficulty = daily.difficulty;
  costs = daily.points;

  await loadStationNames();
  
  await initMap();
  
  const saved = loadProgress(dailyDate);
  
  if (saved) {
    guesses.push(...(saved.guesses || []));
    endGame = !!saved.endGame;
    if (saved.revealedName) {
      currentStation.name = saved.revealedName;
      // TODO : écran de fin
    }
    points = saved.points;
    if (endGame) document.getElementById("guessForm").style.display = "none";

    (saved.usedOptions || []).forEach((id) => {
      const btn = document.getElementById(id);
      btn.disabled = true;
      actionsByOptionId[id](0);
    });
  }

  if (!isArchive) {
    renderStreak();
  }
  
  autocomplete(document.getElementById("guess"), stationsNames);

  document.getElementById("guessForm").addEventListener("submit", function (e) {
    e.preventDefault();
    guess();
  });

  renderAttempts();
  updatePoints(0);
  setDifficultyText();

  useOnce(document.getElementById("streetsNamesOption"), changeStreetsNamesState, costs.streets);
  useOnce(document.getElementById("linesOption"), changeLinesState, costs.lines);
  useOnce(document.getElementById("neighboursOption"), changeNeighboursState, costs.neighbours);

  document.getElementById("streetsPoints").textContent = `-${costs.streets}`;
  document.getElementById("linesPoints").textContent = `-${costs.lines}`;
  document.getElementById("neighboursPoints").textContent = `-${costs.neighbours}`;
  document.getElementById("guessButton").textContent = `OK (-${costs.attempts})`;
}

main();
