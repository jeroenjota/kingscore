# Kingscore

Eerste setup van een Vue 3 webapp om de score van Kingen bij te houden.

## Stack

- Vue 3
- Vite
- Tailwind CSS 4.0 (via `@tailwindcss/vite`)

## Scripts

- `npm install` - dependencies installeren
- `npm run dev` - lokale ontwikkelserver starten
- `npm run dev:api` - API server starten voor gedeelde stand (MariaDB)
- `npm run build` - productiebuild maken
- `npm run preview` - productiebuild lokaal previewen

## Meekijken op andere telefoons

Deze app ondersteunt nu gedeelde stand met een gamecode in de URL.

Voorbeeld:

- Score-invoer (host): `http://<jouw-ip>:5173/?game=tafel1`
- Alleen meelezen (spelers): `http://<jouw-ip>:5173/?game=tafel1&viewer=1`

Iedere telefoon met dezelfde `game` ziet dezelfde stand.

## MariaDB sync instellen

1. Maak database en tabel aan:

	- De state wordt opgeslagen in de bestaande database `laurierboom`.
	- Voer [server/schema.sql](server/schema.sql) uit in MariaDB om alleen de `kingen_game_states`-tabel aan te maken.
	- De speleropties komen uit de tabel `spelers` in dezelfde database.

2. Maak env-bestand:

	- Kopieer [server/.env.example](server/.env.example) naar `server/.env`.
	- Vul je MariaDB credentials in.

3. Start de API:

	- `npm run dev:api`

4. Start de frontend:

	- `npm run dev -- --host`

Standaard zoekt de frontend de API op `http://<zelfde-host>:3001`.
Wil je een andere URL gebruiken, zet dan `VITE_SYNC_API_URL` in een `.env` bestand in de projectroot.

## Wat zit er in deze eerste versie?

- Spelers toevoegen, hernoemen en verwijderen
- Ronde invoeren met contracttype, notitie en score per speler
- Totaalscore en klassement automatisch berekenen
- Schakelaar voor winnaar op basis van laagste of hoogste score
- Laatste ronde ongedaan maken of volledig resetten
