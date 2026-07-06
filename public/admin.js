(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);

  async function load() {
    const cfg = await fetch("/api/config").then((r) => r.json());
    $("#radius").value = cfg.radiusMeters;
    $("#guesses").value = cfg.maxGuesses;
    $("#defStreets").checked = cfg.defaultStreetNames;
    $("#defLines").checked = cfg.defaultLines;
    $("#defNeighbours").checked = cfg.defaultNeighbours;
    $("#defRotation").checked = cfg.defaultRotation;
  }

  function setStatus(msg, ok) {
    const el = $("#status");
    el.textContent = msg;
    el.style.color = ok ? "green" : "red";
  }

  $("#save").addEventListener("click", async () => {
    const body = {
      password: $("#password").value,
      radiusMeters: Number($("#radius").value),
      maxGuesses: Number($("#guesses").value),
      defaultStreetNames: $("#defStreets").checked,
      defaultLines: $("#defLines").checked,
      defaultNeighbours: $("#defNeighbours").checked,
      defaultRotation: $("#defRotation").checked,
    };
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ error: "network" }));

    if (res.ok) setStatus("Enregistré ✓", true);
    else setStatus("Erreur : " + (res.error || "inconnue"), false);
  });

  load();
})();