export const DEFAULT_VARIANT_KEY = "four";

export const VARIANT_OPTIONS = [
  { key: "four", label: "4 spelers", playerCount: 4 },
  { key: "three", label: "3 spelers", playerCount: 3 },
];

const FOUR_PLAYER_NEGATIVE_GAMES = [
  {
    key: "harten",
    name: "♥Harten♥",
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

const FOUR_PLAYER_POSITIVE_GAMES = Array.from({ length: 8 }, (_, index) => ({
  key: `troef-${index + 1}`,
  name: `Troef ${index + 1}`,
  pointsPerUnit: 50,
  unit: "slag",
  maxUnits: 13,
}));

const THREE_PLAYER_NEGATIVE_GAMES = [
  {
    key: "harten",
    name: "♥Harten♥",
    pointsPerUnit: -50,
    unit: "harten",
    maxUnits: 13,
  },
  {
    key: "slagen",
    name: "Slagen",
    pointsPerUnit: -40,
    unit: "slag",
    maxUnits: 17,
  },
  {
    key: "laatste-twee",
    name: "Laatste 2",
    pointsPerUnit: -145,
    unit: "slag",
    maxUnits: 2,
  },
  {
    key: "mannen",
    name: "Mannen",
    pointsPerUnit: -80,
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

const THREE_PLAYER_POSITIVE_GAMES = Array.from({ length: 9 }, (_, index) => ({
  key: `troef-${index + 1}`,
  name: `Troef ${index + 1}`,
  pointsPerUnit: 40,
  unit: "slag",
  maxUnits: 17,
}));

const VARIANT_CONFIGS = {
  four: {
    playerCount: 4,
    maxNegativeChoices: 3,
    maxPositiveChoices: 2,
    defaultPlayerNames: ["Noord", "Oost", "Zuid", "West"],
    negativeGames: FOUR_PLAYER_NEGATIVE_GAMES,
    positiveGames: FOUR_PLAYER_POSITIVE_GAMES,
  },
  three: {
    playerCount: 3,
    maxNegativeChoices: 4,
    maxPositiveChoices: 3,
    defaultPlayerNames: ["Een", "Twee", "Drie"],
    negativeGames: THREE_PLAYER_NEGATIVE_GAMES,
    positiveGames: THREE_PLAYER_POSITIVE_GAMES,
  },
};

export function getVariantConfig(variantKey) {
  return VARIANT_CONFIGS[variantKey] || VARIANT_CONFIGS[DEFAULT_VARIANT_KEY];
}

export function getDefaultPlayerNamesForVariant(variantKey) {
  return [...getVariantConfig(variantKey).defaultPlayerNames];
}

export function getMaxNegativeChoicesForVariant(variantKey) {
  return getVariantConfig(variantKey).maxNegativeChoices;
}

export function getMaxPositiveChoicesForVariant(variantKey) {
  return getVariantConfig(variantKey).maxPositiveChoices;
}

export function buildRoundTemplatesForVariant(variantKey) {
  const config = getVariantConfig(variantKey);

  return [
    ...config.negativeGames.flatMap((game) => [
      { ...game, key: `${game.key}-1`, kind: "negatief", copyLabel: "A" },
      { ...game, key: `${game.key}-2`, kind: "negatief", copyLabel: "B" },
    ]),
    ...config.positiveGames.map((game) => ({
      ...game,
      kind: "positief",
      copyLabel: "",
    })),
  ];
}

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

function getStoredVariantKey(lobbyVariantKey) {
  if (typeof window === "undefined") {
    return DEFAULT_VARIANT_KEY;
  }

  try {
    const raw = window.localStorage.getItem(lobbyVariantKey);
    const parsed = String(raw || "").trim();
    return parsed && VARIANT_CONFIGS[parsed] ? parsed : DEFAULT_VARIANT_KEY;
  } catch {
    return DEFAULT_VARIANT_KEY;
  }
}

function createDefaultPlayers(lobbyPlayersKey, variantKey) {
  const config = getVariantConfig(variantKey);

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(lobbyPlayersKey);
      const parsed = JSON.parse(raw || "[]");
      const names = Array.isArray(parsed)
        ? parsed.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const uniqueNames = [...new Set(names)];

      if (uniqueNames.length === config.playerCount) {
        return uniqueNames.map((name) => ({ id: createPlayerId(), name }));
      }
    } catch {
      // Ignore malformed lobby-player preferences.
    }
  }

  return config.defaultPlayerNames.map((name) => ({
    id: createPlayerId(),
    name,
  }));
}

function createRoundsForPlayers(playerList, variantKey) {
  const roundTemplates = buildRoundTemplatesForVariant(variantKey);

  return roundTemplates.map((template, index) => ({
    ...template,
    roundNumber: index + 1,
    selections: Object.fromEntries(
      playerList.map((player) => [player.id, false]),
    ),
    counts: Object.fromEntries(playerList.map((player) => [player.id, 0])),
  }));
}

function createDefaultState(lobbyPlayersKey, lobbyVariantKey) {
  const variant = getStoredVariantKey(lobbyVariantKey);
  const defaultPlayers = createDefaultPlayers(lobbyPlayersKey, variant);

  return {
    players: defaultPlayers,
    rounds: createRoundsForPlayers(defaultPlayers, variant),
    turnStartPlayerId: null,
    variant,
  };
}

function getVariantKeyForPlayers(players) {
  if (Array.isArray(players) && players.length === 3) {
    return "three";
  }

  if (Array.isArray(players) && players.length === 4) {
    return "four";
  }

  return DEFAULT_VARIANT_KEY;
}

export function normalizeState(rawState) {
  const loadedPlayers = Array.isArray(rawState?.players)
    ? rawState.players
    : [];
  const validPlayers = loadedPlayers.filter(
    (player) =>
      typeof player?.id === "string" && typeof player?.name === "string",
  );

  const variant =
    rawState?.variant && VARIANT_CONFIGS[rawState.variant]
      ? rawState.variant
      : getVariantKeyForPlayers(validPlayers);

  const expectedPlayerCount = getVariantConfig(variant).playerCount;
  if (validPlayers.length !== expectedPlayerCount) {
    return null;
  }

  const roundTemplates = buildRoundTemplatesForVariant(variant);
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
    variant,
  };
}

export function loadPersistedState({
  storageKey,
  lobbyPlayersKey,
  lobbyVariantKey,
}) {
  const defaultState = createDefaultState(lobbyPlayersKey, lobbyVariantKey);

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
