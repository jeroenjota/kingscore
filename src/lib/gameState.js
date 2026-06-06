export const MAX_NEGATIVE_CHOICES = 3;
export const MAX_POSITIVE_CHOICES = 2;

const negativeGames = [
  {
    key: "harten",
    name: "♥♥",
    pointsPerUnit: -30,
    unit: "harten",
    maxUnits: 13,
  },
  {
    key: "slagen",
    name: "Slagen",
    pointsPerUnit: -50,
    unit: "slag",
    maxUnits: 13,
  },
  {
    key: "laatste-twee",
    name: "Laatste 2",
    pointsPerUnit: -140,
    unit: "slag",
    maxUnits: 2,
  },
  {
    key: "mannen",
    name: "Mannen",
    pointsPerUnit: -60,
    unit: "kaart",
    maxUnits: 8,
  },
  {
    key: "vrouwen",
    name: "Vrouwen",
    pointsPerUnit: -100,
    unit: "kaart",
    maxUnits: 4,
  },
  {
    key: "hartenheer",
    name: "♥ Heer",
    pointsPerUnit: -400,
    unit: "keer",
    maxUnits: 1,
  },
];

const positiveGames = Array.from({ length: 8 }, (_, index) => ({
  key: `troef-${index + 1}`,
  name: `Troef ${index + 1}`,
  pointsPerUnit: 50,
  unit: "slag",
  maxUnits: 13,
}));

export const roundTemplates = [
  ...negativeGames.flatMap((game) => [
    { ...game, key: `${game.key}-1`, kind: "negatief", copyLabel: "A" },
    { ...game, key: `${game.key}-2`, kind: "negatief", copyLabel: "B" },
  ]),
  ...positiveGames.map((game) => ({
    ...game,
    kind: "positief",
    copyLabel: "",
  })),
];

export function detectInitialGameId() {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  return (url.searchParams.get("game") || "").trim().toLowerCase();
}

function createPlayerId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultPlayers(lobbyPlayersKey) {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(lobbyPlayersKey);
      const parsed = JSON.parse(raw || "[]");
      const names = Array.isArray(parsed)
        ? parsed.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const uniqueNames = [...new Set(names)];

      if (uniqueNames.length === 4) {
        return uniqueNames.map((name) => ({ id: createPlayerId(), name }));
      }
    } catch {
      // Ignore malformed lobby-player preferences.
    }
  }

  return [
    { id: createPlayerId(), name: "Jan" },
    { id: createPlayerId(), name: "Willem" },
    { id: createPlayerId(), name: "Gerard" },
    { id: createPlayerId(), name: "Jeroen" },
  ];
}

function createRoundsForPlayers(playerList) {
  return roundTemplates.map((template, index) => ({
    ...template,
    roundNumber: index + 1,
    selections: Object.fromEntries(
      playerList.map((player) => [player.id, false]),
    ),
    counts: Object.fromEntries(playerList.map((player) => [player.id, 0])),
  }));
}

function createDefaultState(lobbyPlayersKey) {
  const defaultPlayers = createDefaultPlayers(lobbyPlayersKey);
  return {
    players: defaultPlayers,
    rounds: createRoundsForPlayers(defaultPlayers),
    turnStartPlayerId: null,
  };
}

export function normalizeState(rawState) {
  const loadedPlayers = Array.isArray(rawState?.players)
    ? rawState.players
    : [];
  const validPlayers = loadedPlayers.filter(
    (player) =>
      typeof player?.id === "string" && typeof player?.name === "string",
  );

  if (validPlayers.length !== 4) {
    return null;
  }

  const loadedRoundsByKey = new Map(
    Array.isArray(rawState?.rounds)
      ? rawState.rounds.map((round) => [round?.key, round])
      : [],
  );

  const hydratedRounds = roundTemplates.map((template, index) => {
    const loadedRound = loadedRoundsByKey.get(template.key);

    const selections = Object.fromEntries(
      validPlayers.map((player) => [
        player.id,
        Boolean(loadedRound?.selections?.[player.id]),
      ]),
    );

    const counts = Object.fromEntries(
      validPlayers.map((player) => {
        const numeric = Number(loadedRound?.counts?.[player.id]);
        const integerValue = Number.isFinite(numeric) ? Math.floor(numeric) : 0;
        const safeValue = Math.max(0, integerValue);
        return [player.id, Math.min(safeValue, template.maxUnits)];
      }),
    );

    return {
      ...template,
      roundNumber: index + 1,
      selections,
      counts,
    };
  });

  const validTurnStartPlayerId = validPlayers.some(
    (player) => player.id === rawState?.turnStartPlayerId,
  )
    ? rawState.turnStartPlayerId
    : null;

  return {
    players: validPlayers,
    rounds: hydratedRounds,
    turnStartPlayerId: validTurnStartPlayerId,
  };
}

export function loadPersistedState({ storageKey, lobbyPlayersKey }) {
  const defaultState = createDefaultState(lobbyPlayersKey);

  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const rawState = window.localStorage.getItem(storageKey);
    if (!rawState) {
      return defaultState;
    }

    const parsedState = JSON.parse(rawState);
    const normalized = normalizeState(parsedState);
    return normalized || defaultState;
  } catch (error) {
    console.warn(
      "Kon opgeslagen scorestate niet laden, default state gebruikt.",
      error,
    );
    return defaultState;
  }
}
