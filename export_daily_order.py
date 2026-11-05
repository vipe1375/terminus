"""Exporte l'ordre des stations du jour vers data/daily_order.json.

À lancer UNE FOIS, avec la même valeur de DAILY_SEED que celle du serveur en
production, et avant de résilier l'hébergement :

    DAILY_SEED=<valeur_de_prod> python3 export_daily_order.py

Le site statique lit ensuite ce fichier au lieu de refaire le mélange en
Python (le mélange de Python n'est pas reproductible en JavaScript).
"""

import json
import os
import sys
from datetime import date

import server

if not os.environ.get("DAILY_SEED"):
    sys.exit(
        "DAILY_SEED n'est pas défini. Sans lui, l'ordre est tiré au hasard à chaque "
        "lancement et ne correspondrait pas à celui du site actuel.\n"
        "Relance avec : DAILY_SEED=<valeur_de_prod> python3 export_daily_order.py"
    )

out = os.path.join(server.ROOT, "data", "daily_order.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(server._DAILY_ORDER, f)

print(f"{len(server._DAILY_ORDER)} stations -> {out}")
print(f"Station du jour ({date.today()}) : {server.target_for(date.today())['name']}")
print("Vérifie qu'elle correspond à celle de terminus-game.fr (nom dévoilé en fin de partie).")
