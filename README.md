# Kingscore

Eerste setup van een Vue 3 webapp om de score van Kingen bij te houden.

## Stack

- Vue 3
- Vite
- Tailwind CSS 4.0 (via `@tailwindcss/vite`)

## Scripts

- `npm install` - dependencies installeren
- `npm run dev` - lokale ontwikkelserver starten
- `npm run build` - productiebuild maken
- `npm run preview` - productiebuild lokaal previewen

## Meekijken op andere telefoons

Deze app ondersteunt nu gedeelde stand met een gamecode in de URL.

Voorbeeld:

- Score-invoer (host): `http://<jouw-ip>:5173/?game=tafel1`
- Alleen meelezen (spelers): `http://<jouw-ip>:5173/?game=tafel1&viewer=1`

Iedere telefoon met dezelfde `game` ziet dezelfde stand.

## Laurierboom API gebruiken

1. Start de centrale API:

	- Ga naar `../api`.
	- Kopieer `.env.example` naar `.env` als dat nog niet gedaan is.
	- Start de backend met `npm install` en daarna `npm start`.

2. Start de frontend:

	- `npm run dev -- --host`

Standaard zoekt Kingscore de API nu op `http://<zelfde-host>:54321`.
Wil je een andere URL gebruiken, zet `VITE_SYNC_API_URL` in een `.env` bestand in de projectroot.

Voor verwijderen van spelers en opgeslagen spellen is een beheerderscode nodig.
Zet die in de backend (`../api/.env`) als `KINGEN_DELETE_ADMIN_CODE`.

## Wat zit er in deze eerste versie?

- Spelers toevoegen, hernoemen en verwijderen
- Ronde invoeren met contracttype, notitie en score per speler
- Totaalscore en klassement automatisch berekenen
- Schakelaar voor winnaar op basis van laagste of hoogste score
- Laatste ronde ongedaan maken of volledig resetten
