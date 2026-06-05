<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import LobbyPanel from "./components/LobbyPanel.vue";

const MAX_NEGATIVE_CHOICES = 3;
const MAX_POSITIVE_CHOICES = 2;

const playerNameOptions = ref([]);

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

const roundTemplates = [
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

function detectInitialGameId() {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  return (url.searchParams.get("game") || "").trim().toLowerCase();
}

const STORAGE_KEY = `kingscore-state-v1:${detectInitialGameId()}`;
const LOBBY_PLAYERS_KEY = "kingscore-lobby-players-v1";
const SYNC_POLL_INTERVAL_MS = 1500;

function createPlayerId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultPlayers() {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LOBBY_PLAYERS_KEY);
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

function createDefaultState() {
  const defaultPlayers = createDefaultPlayers();
  return {
    players: defaultPlayers,
    rounds: createRoundsForPlayers(defaultPlayers),
    turnStartPlayerId: null,
  };
}

function loadPersistedState() {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  const defaultState = createDefaultState();

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return defaultState;
    }

    const parsedState = JSON.parse(rawState);
    const loadedPlayers = Array.isArray(parsedState?.players)
      ? parsedState.players
      : [];
    const validPlayers = loadedPlayers.filter(
      (player) =>
        typeof player?.id === "string" && typeof player?.name === "string",
    );

    if (validPlayers.length !== defaultState.players.length) {
      return defaultState;
    }

    const loadedRoundsByKey = new Map(
      Array.isArray(parsedState?.rounds)
        ? parsedState.rounds.map((round) => [round?.key, round])
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
          const integerValue = Number.isFinite(numeric)
            ? Math.floor(numeric)
            : 0;
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
      (player) => player.id === parsedState?.turnStartPlayerId,
    )
      ? parsedState.turnStartPlayerId
      : null;

    return {
      players: validPlayers,
      rounds: hydratedRounds,
      turnStartPlayerId: validTurnStartPlayerId,
    };
  } catch (error) {
    console.warn(
      "Kon opgeslagen scorestate niet laden, default state gebruikt.",
      error,
    );
    return defaultState;
  }
}

const initialState = loadPersistedState();

const players = ref(initialState.players);
const turnStartPlayerId = ref(initialState.turnStartPlayerId);
const activeCellKey = ref(null);
const rounds = ref(initialState.rounds);
const gameId = ref(detectInitialGameId());
const isViewerMode = ref(false);
const syncStatus = ref("Lokaal");
const lobbyGameCode = ref(gameId.value || randomGameId());
const hasActiveGame = computed(() => gameId.value.length > 0);

const isEditingDisabled = computed(() => isViewerMode.value);
const selectablePlayerNames = computed(() => {
  const names = new Set(playerNameOptions.value);

  for (const player of players.value) {
    if (player?.name) {
      names.add(player.name);
    }
  }

  return Array.from(names);
});
const shareViewerUrl = computed(() => {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("game", gameId.value);
  url.searchParams.set("viewer", "1");
  return url.toString();
});
const viewerQrCodeDataUrl = ref("");
const showViewerQrCode = ref(false);
const recentGames = ref([]);
const recentGamesLoading = ref(false);
const recentGamesError = ref("");
const lobbyHostLocked = ref(false);
const lobbyHostCheckLoading = ref(false);
const lobbyNewPlayerName = ref("");
const lobbyDeletePlayerName = ref("");
const lobbyPlayerMessage = ref("");
const lobbyPlayerError = ref("");
const lobbyDeletePlayerMessage = ref("");
const lobbyDeletePlayerError = ref("");
const isAddingLobbyPlayer = ref(false);
const isDeletingLobbyPlayer = ref(false);
const lobbySelectedPlayers = ref(["", "", "", ""]);
const lobbySelectionError = ref("");
const hostClientId = ref("");
const toastMessage = ref("");
const isStartHostDisabled = computed(
  () => lobbyHostLocked.value || lobbyHostCheckLoading.value,
);

let syncTimerId = null;
let syncPushTimeoutId = null;
let hostLockTimerId = null;
let gameEvents = null;
let isApplyingRemoteState = false;
let lastRemoteUpdatedAt = 0;
let toastTimerId = null;
const HOST_HEARTBEAT_INTERVAL_MS = 10_000;

function showToast(message) {
  toastMessage.value = String(message || "").trim();
  if (!toastMessage.value) {
    return;
  }

  if (toastTimerId) {
    clearTimeout(toastTimerId);
  }

  toastTimerId = setTimeout(() => {
    toastMessage.value = "";
    toastTimerId = null;
  }, 2200);
}

function persistState() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const state = {
      players: players.value,
      rounds: rounds.value.map((round) => ({
        key: round.key,
        selections: round.selections,
        counts: round.counts,
      })),
      turnStartPlayerId: turnStartPlayerId.value,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Kon scorestate niet opslaan.", error);
  }
}

function normalizeState(rawState) {
  const defaultState = createDefaultState();
  const loadedPlayers = Array.isArray(rawState?.players)
    ? rawState.players
    : [];
  const validPlayers = loadedPlayers.filter(
    (player) =>
      typeof player?.id === "string" && typeof player?.name === "string",
  );

  if (validPlayers.length !== defaultState.players.length) {
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

function applyState(rawState) {
  const normalized = normalizeState(rawState);
  if (!normalized) {
    return false;
  }

  isApplyingRemoteState = true;
  players.value = normalized.players;
  rounds.value = normalized.rounds;
  turnStartPlayerId.value = normalized.turnStartPlayerId;
  isApplyingRemoteState = false;
  return true;
}

function serializableState() {
  return {
    players: players.value,
    rounds: rounds.value.map((round) => ({
      key: round.key,
      selections: round.selections,
      counts: round.counts,
    })),
    turnStartPlayerId: turnStartPlayerId.value,
  };
}

function syncApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  if (import.meta.env.VITE_SYNC_API_URL) {
    return import.meta.env.VITE_SYNC_API_URL;
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalHost) {
    return `${window.location.protocol}//${window.location.hostname}:54321`;
  }

  return `${window.location.origin}/laurierboom/api`;
}

async function loadPlayerNameOptions() {
  try {
    const response = await fetch(`${syncApiBaseUrl()}/api/player-names`);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const names = Array.isArray(payload?.names)
      ? payload.names.map((name) => String(name || "").trim()).filter(Boolean)
      : [];

    playerNameOptions.value = names;
    initializeLobbySelectedPlayers();
  } catch (error) {
    console.warn("Kon spelersnamen niet laden.", error);
  }
}

function initializeLobbySelectedPlayers() {
  if (typeof window === "undefined") {
    return;
  }

  lobbySelectedPlayers.value = ["", "", "", ""];
}

function isLobbyPlayerOptionDisabled(name, currentIndex) {
  return lobbySelectedPlayers.value.some(
    (selectedName, selectedIndex) =>
      selectedIndex !== currentIndex && selectedName === name,
  );
}

function persistLobbyPlayers() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LOBBY_PLAYERS_KEY,
      JSON.stringify(lobbySelectedPlayers.value),
    );
  } catch {
    // Ignore storage errors.
  }
}

function randomGameId() {
  return Math.random().toString(36).slice(2, 8);
}

function initGameFromUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  const game = (url.searchParams.get("game") || "").trim().toLowerCase();
  const viewer = url.searchParams.get("viewer") === "1";

  gameId.value = game;
  isViewerMode.value = viewer;
  if (!game && !lobbyGameCode.value) {
    lobbyGameCode.value = randomGameId();
  }
}

function normalizeGameCode(rawCode) {
  return String(rawCode || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
}

function getOrCreateHostClientId() {
  if (typeof window === "undefined") {
    return "";
  }

  const key = "kingscore-host-id-v1";
  const existing = String(window.sessionStorage.getItem(key) || "")
    .trim()
    .toLowerCase();
  if (/^[a-z0-9_-]{8,64}$/.test(existing)) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().toLowerCase()
      : `host-${Math.random().toString(36).slice(2, 14)}`;

  const normalized = generated.replace(/[^a-z0-9_-]/g, "").slice(0, 64);
  window.sessionStorage.setItem(key, normalized);
  return normalized;
}

async function claimHostLock() {
  if (!gameId.value || !hostClientId.value) {
    return false;
  }

  try {
    const response = await fetch(
      `${syncApiBaseUrl()}/api/games/${gameId.value}/host-lock`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: hostClientId.value }),
      },
    );

    if (response.ok) {
      return true;
    }

    if (response.status === 409) {
      return false;
    }
  } catch {
    // Ignore and allow fallback behavior below.
  }

  return false;
}

function stopHostLockHeartbeat() {
  if (!hostLockTimerId) {
    return;
  }

  clearInterval(hostLockTimerId);
  hostLockTimerId = null;
}

function startHostLockHeartbeat() {
  stopHostLockHeartbeat();

  hostLockTimerId = setInterval(() => {
    void claimHostLock();
  }, HOST_HEARTBEAT_INTERVAL_MS);
}

async function releaseHostLock() {
  if (!gameId.value || !hostClientId.value) {
    return;
  }

  try {
    await fetch(`${syncApiBaseUrl()}/api/games/${gameId.value}/host-lock`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId: hostClientId.value }),
      keepalive: true,
    });
  } catch {
    // Ignore release errors.
  }
}

async function addLobbyPlayerName() {
  const name = String(lobbyNewPlayerName.value || "").trim();
  if (!name) {
    lobbyPlayerError.value = "Vul een spelernaam in.";
    lobbyPlayerMessage.value = "";
    return;
  }

  isAddingLobbyPlayer.value = true;
  lobbyPlayerError.value = "";
  lobbyPlayerMessage.value = "";

  try {
    const response = await fetch(`${syncApiBaseUrl()}/api/player-names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.status === 409) {
      lobbyPlayerError.value = "Deze speler bestaat al.";
      return;
    }

    if (!response.ok) {
      lobbyPlayerError.value = "Kon speler niet toevoegen.";
      return;
    }

    lobbyNewPlayerName.value = "";
    lobbyPlayerMessage.value = "Speler toegevoegd.";
    lobbyDeletePlayerMessage.value = "";
    lobbyDeletePlayerError.value = "";
    await loadPlayerNameOptions();
    persistLobbyPlayers();
  } catch {
    lobbyPlayerError.value = "Kon speler niet toevoegen.";
  } finally {
    isAddingLobbyPlayer.value = false;
  }
}

async function deleteLobbyPlayerName() {
  const name = String(lobbyDeletePlayerName.value || "").trim();
  if (!name) {
    lobbyDeletePlayerError.value = "Kies een speler om te verwijderen.";
    lobbyDeletePlayerMessage.value = "";
    return;
  }

  if (!window.confirm(`Weet je zeker dat je speler \"${name}\" wilt verwijderen?`)) {
    return;
  }

  isDeletingLobbyPlayer.value = true;
  lobbyDeletePlayerError.value = "";
  lobbyDeletePlayerMessage.value = "";
  lobbyPlayerMessage.value = "";
  lobbyPlayerError.value = "";

  try {
    const response = await fetch(`${syncApiBaseUrl()}/api/player-names/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });

    if (response.status === 409) {
      const payload = await response.json().catch(() => ({}));
      const gameIds = Array.isArray(payload?.gameIds) ? payload.gameIds.filter(Boolean) : [];
      lobbyDeletePlayerError.value = gameIds.length
        ? `Kan niet verwijderen: speler zit in bestaande spellen (${gameIds.join(", ")}).`
        : "Kan niet verwijderen: speler zit in bestaand spel.";
      return;
    }

    if (response.status === 404) {
      lobbyDeletePlayerError.value = "Speler bestaat niet (meer).";
      await loadPlayerNameOptions();
      return;
    }

    if (!response.ok) {
      lobbyDeletePlayerError.value = "Kon speler niet verwijderen.";
      return;
    }

    lobbyDeletePlayerName.value = "";
    lobbyDeletePlayerMessage.value = "Speler verwijderd.";
    await loadPlayerNameOptions();
    persistLobbyPlayers();
  } catch {
    lobbyDeletePlayerError.value = "Kon speler niet verwijderen.";
  } finally {
    isDeletingLobbyPlayer.value = false;
  }
}

function formatUpdatedAt(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(numeric));
}

async function openSavedGame(code, viewerMode) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeGameCode(code);
  if (!normalized) {
    return;
  }

  if (!viewerMode) {
    const lockClaimed = await claimHostLockForGame(normalized);
    if (!lockClaimed) {
      await loadRecentGames();
      showToast("Host is al actief voor deze gamecode.");
      return;
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.set("game", normalized);

  if (viewerMode) {
    url.searchParams.set("viewer", "1");
  } else {
    url.searchParams.delete("viewer");
  }

  window.location.assign(url.toString());
}

async function loadRecentGames() {
  if (typeof window === "undefined") {
    return;
  }

  recentGamesLoading.value = true;
  recentGamesError.value = "";

  try {
    const response = await fetch(`${syncApiBaseUrl()}/api/games`, {
      cache: "no-store",
    });
    if (!response.ok) {
      recentGamesError.value = "Kon games niet laden.";
      recentGames.value = [];
      return;
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.games) ? payload.games : [];

    recentGames.value = items
      .map((item) => ({
        gameId: normalizeGameCode(item?.gameId),
        updatedAt: Number(item?.updatedAt || 0),
        hostLocked: Boolean(item?.hostLocked),
      }))
      .filter((item) => item.gameId);
  } catch (error) {
    recentGamesError.value = "Kon games niet laden.";
    recentGames.value = [];
  } finally {
    recentGamesLoading.value = false;
  }
}

async function deleteSavedGame(gameCode) {
  const normalized = normalizeGameCode(gameCode);
  if (!normalized) {
    return;
  }

  if (!window.confirm(`Weet je zeker dat je spel \"${normalized}\" wilt verwijderen?`)) {
    return;
  }

  try {
    const response = await fetch(`${syncApiBaseUrl()}/api/games/${normalized}`, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 404) {
      showToast("Verwijderen van spel mislukt.");
      return;
    }

    showToast("Spel verwijderd.");
    await loadRecentGames();
    await refreshLobbyHostLock();
  } catch {
    showToast("Verwijderen van spel mislukt.");
  }
}

async function refreshLobbyHostLock() {
  const normalized = normalizeGameCode(lobbyGameCode.value);
  if (!normalized) {
    lobbyHostLocked.value = false;
    lobbyHostCheckLoading.value = false;
    return;
  }

  lobbyHostCheckLoading.value = true;

  try {
    const response = await fetch(
      `${syncApiBaseUrl()}/api/games/${normalized}/host-lock`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      lobbyHostLocked.value = false;
      return;
    }

    const payload = await response.json();
    lobbyHostLocked.value = Boolean(payload?.hostLocked);
  } catch {
    lobbyHostLocked.value = false;
  } finally {
    lobbyHostCheckLoading.value = false;
  }
}

async function isGameHostLocked(code) {
  const normalized = normalizeGameCode(code);
  if (!normalized) {
    return false;
  }

  try {
    const response = await fetch(
      `${syncApiBaseUrl()}/api/games/${normalized}/host-lock`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return Boolean(payload?.hostLocked);
  } catch {
    return false;
  }
}

async function claimHostLockForGame(code) {
  const normalized = normalizeGameCode(code);
  if (!normalized) {
    return false;
  }

  if (!hostClientId.value) {
    hostClientId.value = getOrCreateHostClientId();
  }

  try {
    const response = await fetch(
      `${syncApiBaseUrl()}/api/games/${normalized}/host-lock`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: hostClientId.value }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

async function goToGame(viewerMode) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeGameCode(lobbyGameCode.value || randomGameId());
  if (!normalized) {
    return;
  }

  if (!viewerMode) {
    await refreshLobbyHostLock();
    if (lobbyHostLocked.value || isStartHostDisabled.value) {
      showToast("Host is al actief voor deze gamecode.");
      return;
    }

    const lockClaimed = await claimHostLockForGame(normalized);
    if (!lockClaimed) {
      await refreshLobbyHostLock();
      await loadRecentGames();
      showToast("Host is al actief voor deze gamecode.");
      return;
    }
  }

  const selected = lobbySelectedPlayers.value
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  const uniqueSelected = [...new Set(selected)];
  if (uniqueSelected.length !== 4) {
    lobbySelectionError.value =
      "Kies vier verschillende spelers om de game te starten.";
    return;
  }

  lobbySelectionError.value = "";
  persistLobbyPlayers();

  const url = new URL(window.location.href);
  url.searchParams.set("game", normalized);

  if (viewerMode) {
    url.searchParams.set("viewer", "1");
  } else {
    url.searchParams.delete("viewer");
  }

  window.location.assign(url.toString());
}

async function openLobby() {
  if (typeof window === "undefined") {
    return;
  }

  if (!isViewerMode.value) {
    stopHostLockHeartbeat();
    await releaseHostLock();
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("game");
  url.searchParams.delete("viewer");
  window.location.assign(url.toString());
}

async function copyViewerLink() {
  if (typeof window === "undefined" || !shareViewerUrl.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(shareViewerUrl.value);
  } catch (error) {
    console.warn("Kon meeleeslink niet kopieren.", error);
  }

  showViewerQrCode.value = true;
}

async function toggleViewerQrCode() {
  if (!showViewerQrCode.value && !viewerQrCodeDataUrl.value) {
    await updateViewerQrCode();
  }

  showViewerQrCode.value = !showViewerQrCode.value;
}

function closeViewerQrCode() {
  showViewerQrCode.value = false;
}

async function updateViewerQrCode() {
  if (!shareViewerUrl.value) {
    viewerQrCodeDataUrl.value = "";
    return;
  }

  try {
    viewerQrCodeDataUrl.value = await QRCode.toDataURL(shareViewerUrl.value, {
      width: 220,
      margin: 1,
    });
  } catch (error) {
    viewerQrCodeDataUrl.value = "";
    console.warn("Kon QR-code niet genereren.", error);
  }
}

async function pullRemoteState() {
  if (!gameId.value || typeof window === "undefined") {
    return;
  }

  try {
    const response = await fetch(
      `${syncApiBaseUrl()}/api/games/${gameId.value}/state`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      syncStatus.value = "Lokaal";
      return;
    }

    const payload = await response.json();
    const updatedAt = Number(payload?.updatedAt || 0);
    if (updatedAt <= lastRemoteUpdatedAt || !payload?.state) {
      syncStatus.value = "Online";
      return;
    }

    if (applyState(payload.state)) {
      lastRemoteUpdatedAt = updatedAt;
      syncStatus.value = "Online";
    }
  } catch (error) {
    syncStatus.value = "Lokaal";
  }
}

async function pushRemoteState() {
  if (!gameId.value || isViewerMode.value || typeof window === "undefined") {
    return;
  }

  try {
    const response = await fetch(
      `${syncApiBaseUrl()}/api/games/${gameId.value}/state`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: serializableState() }),
      },
    );

    if (!response.ok) {
      syncStatus.value = "Lokaal";
      return;
    }

    const payload = await response.json();
    lastRemoteUpdatedAt = Number(payload?.updatedAt || Date.now());
    syncStatus.value = "Online";
  } catch (error) {
    syncStatus.value = "Lokaal";
  }
}

function scheduleRemotePush() {
  if (syncPushTimeoutId) {
    clearTimeout(syncPushTimeoutId);
  }

  syncPushTimeoutId = setTimeout(() => {
    void pushRemoteState();
  }, 250);
}

function startSyncPolling() {
  if (syncTimerId) {
    clearInterval(syncTimerId);
  }

  syncTimerId = setInterval(() => {
    void pullRemoteState();
  }, SYNC_POLL_INTERVAL_MS);
}

function stopRealtimeSync() {
  if (!gameEvents) {
    return;
  }

  gameEvents.close();
  gameEvents = null;
}

function startRealtimeSync() {
  if (typeof window === "undefined" || !gameId.value) {
    return;
  }

  stopRealtimeSync();

  const eventsUrl = `${syncApiBaseUrl()}/api/games/${gameId.value}/events`;
  gameEvents = new EventSource(eventsUrl);

  gameEvents.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      const updatedAt = Number(payload?.updatedAt || 0);

      if (!updatedAt || updatedAt <= lastRemoteUpdatedAt) {
        return;
      }

      void pullRemoteState();
    } catch {
      // Ignore malformed events and continue polling fallback.
    }
  };

  gameEvents.onerror = () => {
    syncStatus.value = "Lokaal";
  };
}

watch(
  [players, rounds, turnStartPlayerId],
  () => {
    if (isApplyingRemoteState) {
      return;
    }

    persistState();
    scheduleRemotePush();
  },
  { deep: true },
);

watch(shareViewerUrl, () => {
  void updateViewerQrCode();
  showViewerQrCode.value = false;
});

watch(
  lobbySelectedPlayers,
  () => {
    lobbySelectionError.value = "";
    persistLobbyPlayers();
  },
  { deep: true },
);

watch(lobbyGameCode, () => {
  void refreshLobbyHostLock();
});

watch(playerNameOptions, () => {
  const currentDeleteName = String(lobbyDeletePlayerName.value || "").trim();
  if (!currentDeleteName) {
    return;
  }

  if (!playerNameOptions.value.includes(currentDeleteName)) {
    lobbyDeletePlayerName.value = "";
  }
});

onMounted(async () => {
  initGameFromUrl();
  await loadPlayerNameOptions();

  if (!hasActiveGame.value) {
    syncStatus.value = "Lobby";
    await refreshLobbyHostLock();
    await loadRecentGames();
    return;
  }

  await updateViewerQrCode();

  if (!isViewerMode.value) {
    hostClientId.value = getOrCreateHostClientId();
    const hostClaimed = await claimHostLock();
    if (!hostClaimed) {
      isViewerMode.value = true;
      syncStatus.value = "Host bezet";
    } else {
      startHostLockHeartbeat();
    }
  }

  await pullRemoteState();
  if (!isViewerMode.value) {
    await pushRemoteState();
  }
  startRealtimeSync();
  startSyncPolling();
});

onBeforeUnmount(() => {
  if (syncTimerId) {
    clearInterval(syncTimerId);
  }

  if (syncPushTimeoutId) {
    clearTimeout(syncPushTimeoutId);
  }

  stopHostLockHeartbeat();
  if (!isViewerMode.value) {
    void releaseHostLock();
  }

  if (toastTimerId) {
    clearTimeout(toastTimerId);
    toastTimerId = null;
  }

  stopRealtimeSync();
});

const inputClass =
  "text-center w-full rounded-lg border border-sky-200 bg-white px-1 py-0.5 text-[13px] text-sky-950 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-300/60";

const selectClass =
  "w-full rounded-lg border border-sky-200 bg-white px-1 py-0.5 text-[16px] text-sky-950 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-300/60";

function isPlayerNameDisabled(name, currentPlayerId) {
  return players.value.some(
    (player) => player.id !== currentPlayerId && player.name === name,
  );
}

function getRoundChooserId(round) {
  return (
    players.value.find((player) => round.selections[player.id])?.id ?? null
  );
}

function chosenRoundCount() {
  return rounds.value.reduce(
    (sum, round) => sum + (getRoundChooserId(round) ? 1 : 0),
    0,
  );
}

function getNextChooserId() {
  if (!turnStartPlayerId.value) {
    return null;
  }

  const startIndex = players.value.findIndex(
    (player) => player.id === turnStartPlayerId.value,
  );
  if (startIndex < 0) {
    return null;
  }

  return players.value[(startIndex + chosenRoundCount()) % players.value.length]
    .id;
}

const currentTurnPlayerId = computed(() => {
  const chosenCount = chosenRoundCount();
  if (chosenCount === 0 || chosenCount >= rounds.value.length) {
    return null;
  }

  const allChosenRoundsFullyScored = rounds.value
    .filter((round) => chosenBySomeone(round))
    .every((round) => isRowFull(round));

  if (!allChosenRoundsFullyScored) {
    return null;
  }

  return getNextChooserId();
});

function isCurrentTurnPlayer(playerId) {
  return currentTurnPlayerId.value === playerId;
}

function isPossibleChoiceRound(round) {
  const turnPlayerId = currentTurnPlayerId.value;
  if (!turnPlayerId || chosenBySomeone(round)) {
    return false;
  }

  return canChooseRound(round, turnPlayerId);
}

function isPossibleChoiceCell(round, playerId) {
  return isCurrentTurnPlayer(playerId) && isPossibleChoiceRound(round);
}

function canChooseRound(round, playerId) {
  if (!isRoundEditable(round)) {
    return false;
  }

  if (round.selections[playerId]) {
    return true;
  }

  const allChosenRoundsFullyScored = rounds.value
    .filter((candidate) => chosenBySomeone(candidate))
    .every((candidate) => isRowFull(candidate));

  if (!allChosenRoundsFullyScored) {
    return false;
  }

  const stats = chooserStats.value[playerId];
  if (
    round.kind === "negatief" &&
    stats.negativeChosen >= MAX_NEGATIVE_CHOICES
  ) {
    return false;
  }

  if (
    round.kind === "positief" &&
    stats.positiveChosen >= MAX_POSITIVE_CHOICES
  ) {
    return false;
  }

  const nextChooserId = getNextChooserId();
  if (nextChooserId && nextChooserId !== playerId) {
    return false;
  }

  return true;
}

function setChooser(round, playerId, checked) {
  if (isEditingDisabled.value || isRowFull(round)) {
    return;
  }

  if (!checked) {
    round.selections[playerId] = false;

    if (chosenRoundCount() === 0) {
      turnStartPlayerId.value = null;
    }

    return;
  }

  if (!canChooseRound(round, playerId)) {
    return;
  }

  if (!turnStartPlayerId.value) {
    turnStartPlayerId.value = playerId;
  }

  for (const player of players.value) {
    round.selections[player.id] = player.id === playerId;
  }
}

function cellPoints(round, playerId) {
  return Number(round.counts[playerId] || 0) * round.pointsPerUnit;
}

function chosenBySomeone(round) {
  return !!getRoundChooserId(round);
}

function roundTotalCount(round) {
  return players.value.reduce(
    (sum, player) => sum + Number(round.counts[player.id] || 0),
    0,
  );
}

function remainingForPlayer(round, playerId) {
  const currentValue = Number(round.counts[playerId] || 0);
  const totalWithoutCurrent = roundTotalCount(round) - currentValue;
  return Math.max(0, round.maxUnits - totalWithoutCurrent);
}

function canEditRoundScores(round) {
  return isRoundEditable(round) && chosenBySomeone(round);
}

function normalizeCount(round, playerId, rawValue) {
  if (isEditingDisabled.value || !canEditRoundScores(round)) {
    return;
  }

  const numeric = Number(rawValue);
  const integerValue = Number.isFinite(numeric) ? Math.floor(numeric) : 0;
  const safeValue = Math.max(0, integerValue);
  round.counts[playerId] = Math.min(
    safeValue,
    remainingForPlayer(round, playerId),
  );
}

function cellKey(round, playerId) {
  return `${round.key}::${playerId}`;
}

function isCellEditing(round, playerId) {
  return activeCellKey.value === cellKey(round, playerId);
}

function openCellEditor(round, playerId) {
  if (isEditingDisabled.value || !canEditRoundScores(round)) {
    return;
  }

  activeCellKey.value = cellKey(round, playerId);
}

function closeCellEditor() {
  activeCellKey.value = null;
}

function updateCellCount(round, playerId, rawValue) {
  normalizeCount(round, playerId, rawValue);
  closeCellEditor();
}

function selectedPoints(round, playerId) {
  const count = Number(round.counts[playerId] || 0);
  if (count <= 0) {
    return 0;
  }

  return Math.abs(cellPoints(round, playerId));
}

function countOptions(round, playerId) {
  const maxForCell = remainingForPlayer(round, playerId);
  return Array.from({ length: maxForCell + 1 }, (_, index) => index);
}

function countOptionLabel(round, count) {
  const points = Math.abs(count * round.pointsPerUnit);
  return `${count}: ${points}`;
}

const negativeRounds = computed(() =>
  rounds.value.filter((round) => round.kind === "negatief"),
);
const positiveRounds = computed(() =>
  rounds.value.filter((round) => round.kind === "positief"),
);

function isRoundPlayed(round) {
  return roundTotalCount(round) > 0 || chosenBySomeone(round);
}

function isNegativeSecondRound(round) {
  return round.kind === "negatief" && round.key.endsWith("-2");
}

function canPlayNegativeSecondRound(round) {
  if (!isNegativeSecondRound(round)) {
    return true;
  }

  const firstRoundKey = round.key.replace("-2", "-1");
  const firstRound = negativeRounds.value.find(
    (candidate) => candidate.key === firstRoundKey,
  );
  return firstRound ? isRoundPlayed(firstRound) : true;
}

function canPlayPositiveRound(round) {
  if (round.kind !== "positief") {
    return true;
  }

  const positiveIndex = positiveRounds.value.findIndex(
    (candidate) => candidate.key === round.key,
  );
  if (positiveIndex <= 0) {
    return true;
  }

  const previousPositiveRound = positiveRounds.value[positiveIndex - 1];
  return previousPositiveRound ? isRoundPlayed(previousPositiveRound) : true;
}

function isRoundEditable(round) {
  if (round.kind === "negatief") {
    return canPlayNegativeSecondRound(round);
  }

  return canPlayPositiveRound(round);
}

function isRowFull(round) {
  return roundTotalCount(round) >= round.maxUnits;
}

function isGroupStart(round) {
  return round.kind === "positief" || round.key.endsWith("-1");
}

function isGroupEnd(round) {
  return round.kind === "positief" || round.key.endsWith("-2");
}

function rowGroupClass(round) {
  const classes = ["border-l border-r border-sky-200"];

  if (isGroupStart(round)) {
    classes.push("border-t border-t-sky-300");
  }

  if (isGroupEnd(round)) {
    classes.push("border-b border-b-sky-300");
  }

  return classes.join(" ");
}

function roundPrimaryLabel(round) {
  if (round.kind === "negatief" && round.key.endsWith("-1")) {
    return `${round.name}`;
  }

  if (round.kind === "negatief" && round.key.endsWith("-2")) {
    return `${round.pointsPerUnit > 0 ? "+" : ""}${round.pointsPerUnit}`;
  }

  return round.name;
}

function roundPrimaryLabelHtml(round) {
  return roundPrimaryLabel(round).replaceAll(
    "♥",
    '<span class="text-red-600">♥</span>',
  );
}

function roundSecondaryLabel(round) {
  if (round.kind === "negatief" && round.key.endsWith("-1")) {
    return `Max ${round.maxUnits} ${round.unit}`;
  }

  if (round.kind === "negatief" && round.key.endsWith("-2")) {
    return `Max ${round.maxUnits} ${round.unit}`;
  }

  return `${round.pointsPerUnit > 0 ? "+" : ""}${round.pointsPerUnit} pnt per ${
    round.unit
  } | Max ${round.maxUnits}`;
}

function totalsForRounds(roundList) {
  return Object.fromEntries(
    players.value.map((player) => {
      const total = roundList.reduce(
        (sum, round) => sum + cellPoints(round, player.id),
        0,
      );
      return [player.id, total];
    }),
  );
}

const negativeTotals = computed(() => totalsForRounds(negativeRounds.value));
const positiveTotals = computed(() => totalsForRounds(positiveRounds.value));
const grandTotals = computed(() => totalsForRounds(rounds.value));
const isGameFinished = computed(
  () =>
    rounds.value.length > 0 &&
    rounds.value.every((round) => chosenBySomeone(round) && isRowFull(round)),
);

const resultsStandings = computed(() =>
  players.value
    .map((player) => ({
      id: player.id,
      name: player.name,
      negative: negativeTotals.value[player.id] || 0,
      positive: positiveTotals.value[player.id] || 0,
      total: grandTotals.value[player.id] || 0,
    }))
    .sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total;
      }

      return left.name.localeCompare(right.name, 'nl');
    }),
);

const resultsModalOpen = ref(false);

watch(
  isGameFinished,
  (finished, wasFinished) => {
    if (finished && !wasFinished) {
      resultsModalOpen.value = true;
    }

    if (!finished) {
      resultsModalOpen.value = false;
    }
  },
  { immediate: true },
);

function openResultsModal() {
  if (!isGameFinished.value) {
    return;
  }

  resultsModalOpen.value = true;
}

function closeResultsModal() {
  resultsModalOpen.value = false;
}

function pointsClass(value) {
  return value >= 0 ? "text-emerald-700" : "text-rose-700";
}

const chooserStats = computed(() => {
  return Object.fromEntries(
    players.value.map((player) => {
      let negativeChosen = 0;
      let positiveChosen = 0;

      for (const round of rounds.value) {
        if (!round.selections[player.id]) {
          continue;
        }

        if (round.kind === "negatief") {
          negativeChosen += 1;
        } else {
          positiveChosen += 1;
        }
      }

      return [
        player.id,
        {
          negativeChosen,
          positiveChosen,
          totalChosen: negativeChosen + positiveChosen,
        },
      ];
    }),
  );
});
</script>

<template>
  <main class="mx-auto grid w-full max-w-7xl gap-0.5 px-0 py-0 md:px-4 md:py-1.5">
    <div
      v-if="toastMessage"
      class="z-70 pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-sky-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      {{ toastMessage }}
    </div>

    <LobbyPanel
      v-if="!hasActiveGame"
      :lobby-selected-players="lobbySelectedPlayers"
      :player-name-options="playerNameOptions"
      :lobby-selection-error="lobbySelectionError"
      :lobby-game-code="lobbyGameCode"
      :is-start-host-disabled="isStartHostDisabled"
      :lobby-host-check-loading="lobbyHostCheckLoading"
      :lobby-host-locked="lobbyHostLocked"
      :lobby-new-player-name="lobbyNewPlayerName"
      :lobby-delete-player-name="lobbyDeletePlayerName"
      :is-adding-lobby-player="isAddingLobbyPlayer"
      :is-deleting-lobby-player="isDeletingLobbyPlayer"
      :lobby-player-message="lobbyPlayerMessage"
      :lobby-player-error="lobbyPlayerError"
      :lobby-delete-player-message="lobbyDeletePlayerMessage"
      :lobby-delete-player-error="lobbyDeletePlayerError"
      :recent-games-loading="recentGamesLoading"
      :recent-games-error="recentGamesError"
      :recent-games="recentGames"
      :is-lobby-player-option-disabled="isLobbyPlayerOptionDisabled"
      :format-updated-at="formatUpdatedAt"
      @update:lobby-player-at="({ index, value }) => (lobbySelectedPlayers[index] = value)"
      @update:lobby-game-code="(value) => (lobbyGameCode = value)"
      @update:lobby-new-player-name="(value) => (lobbyNewPlayerName = value)"
      @update:lobby-delete-player-name="(value) => (lobbyDeletePlayerName = value)"
      @start-host="goToGame(false)"
      @start-viewer="goToGame(true)"
      @add-player="addLobbyPlayerName"
      @delete-player="deleteLobbyPlayerName"
      @refresh-games="loadRecentGames"
      @open-saved-host="(gameId) => openSavedGame(gameId, false)"
      @open-saved-viewer="(gameId) => openSavedGame(gameId, true)"
      @delete-saved-game="(gameId) => deleteSavedGame(gameId)"
    />

    <section
      v-else
      class="overflow-hidden rounded-xl border border-sky-600 bg-sky-50 p-0 shadow-sm">
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 bg-sky-100/70 px-2 py-1 text-[12px] text-sky-900 md:px-3">
        <p>
          <button
            v-if="isGameFinished"
            type="button"
            class="font-semibold text-sky-900 underline decoration-dotted underline-offset-2 hover:text-sky-700"
            @click="openResultsModal">
            Uitslag
          </button>
          <span v-else>Game</span>
          : <span class="font-bold uppercase">{{ gameId }}</span> | Stat:
          <span class="font-semibold">{{ syncStatus }}</span> | Rol:
          <span class="font-semibold">{{ isViewerMode ? "Speler/Kijker" : "Gastheer" }}</span>
        </p>
        <div v-if="!isViewerMode" class="flex items-center gap-2">
          <button
            type="button"
            class="rounded border border-sky-300 bg-white px-2 py-0.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-50"
            @click="openLobby">
            Lobby
          </button>
          <button
            v-if="!isViewerMode"
            type="button"
            class="rounded border border-sky-300 bg-white px-2 py-0.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-50"
            @click="toggleViewerQrCode">
            {{ showViewerQrCode ? "Verberg QR" : "Toon QR" }}
          </button>
        </div>
        <div
          v-else
          class="flex items-center gap-2">
          <button
            type="button"
            class="rounded border border-sky-300 bg-white px-2 py-0.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-50"
            @click="openLobby">
            Lobby
          </button>
        </div>
      </div>
      <div class="mb-0 overflow-x-auto">
        <table class="w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                class="w-18 md:w-22 sticky left-0 z-20 bg-sky-100 px-1 py-0.5 text-center text-[18px] font-bold text-sky-950 md:px-1.5 md:py-1 md:text-xs">
                Kingen
              </th>
              <th
                v-for="player in players"
                :key="player.id"
                class="w-16 px-1 py-1 text-left md:w-20 md:px-1.5 md:py-1.5"
                :class="
                  isCurrentTurnPlayer(player.id) ? 'bg-amber-200' : 'bg-sky-100'
                ">
                <div class="rounded-lg border border-sky-200 bg-white px-1 py-0.5 text-center text-[13px] text-sky-950">
                  {{ player.name }}
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="round in negativeRounds"
              :key="round.key"
              class="align-center">
              <td
                class="w-18 md:w-22 sticky left-0 z-10 border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
                :class="[
                  isRowFull(round) ? 'bg-emerald-200' : 'bg-sky-50',
                  isPossibleChoiceRound(round) ? 'bg-amber-100' : '',
                  rowGroupClass(round),
                ]">
                <p
                  class="text-right text-[14px] font-semibold leading-tight text-sky-950 md:text-sm"
                  v-html="roundPrimaryLabelHtml(round)"></p>
              </td>

              <td
                v-for="player in players"
                :key="`${round.key}-${player.id}`"
                class="cursor-pointer border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
                :class="[
                  isRowFull(round) ? 'bg-emerald-100' : '',
                  isPossibleChoiceCell(round, player.id)
                    ? 'bg-amber-50 ring-1 ring-inset ring-amber-300'
                    : '',
                  rowGroupClass(round),
                ]"
                @click="openCellEditor(round, player.id)">
                <div class="flex items-center gap-1">
                  <input
                    type="checkbox"
                    class="h-3 w-3 rounded border-sky-300 text-sky-700 focus:ring-sky-400"
                    :checked="round.selections[player.id]"
                    :disabled="
                      isEditingDisabled || isRowFull(round) || !canChooseRound(round, player.id)
                    "
                    :aria-label="`Gekozen door ${
                      player.name || 'speler'
                    } voor ${round.name}`"
                    :title="`Gekozen door ${player.name || 'speler'} voor ${
                      round.name
                    }`"
                    @click.stop
                    @change="
                      setChooser(round, player.id, $event.target.checked)
                    " />
                  <select
                    v-if="isCellEditing(round, player.id)"
                    :value="round.counts[player.id]"
                    :class="selectClass"
                    :disabled="!canEditRoundScores(round)"
                    @click.stop
                    @blur="closeCellEditor"
                    @change="
                      updateCellCount(round, player.id, $event.target.value)
                    ">
                    <option
                      v-for="count in countOptions(round, player.id)"
                      :key="`${round.key}-${player.id}-neg-${count}`"
                      :value="count">
                      {{ countOptionLabel(round, count) }}
                    </option>
                  </select>
                  <p
                    v-else
                    class="min-h-3 flex-1 text-right text-[14px] font-semibold text-sky-900">
                    {{ selectedPoints(round, player.id) }}
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <th
                class="w-18 md:w-22 sticky left-0 z-10 border-b border-sky-200 bg-sky-100/70 px-1 py-0.5 text-right text-[12px] text-red-700 md:px-1.5 md:py-1 md:text-xs">
                Negatief
              </th>
              <th
                v-for="player in players"
                :key="`negative-subtotal-${player.id}`"
                class="border border-sky-200 bg-sky-100/70 px-1 py-1 text-center text-[12px] font-bold md:px-1.5 md:py-1.5 md:text-xs"
                :class="pointsClass(negativeTotals[player.id])">
                {{ negativeTotals[player.id] }}
              </th>
            </tr>

            <tr
              v-for="round in positiveRounds"
              :key="round.key"
              class="align-center">
              <td
                class="w-18 md:w-22 sticky left-0 z-10 border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
                :class="[
                  isRowFull(round) ? 'bg-emerald-200' : 'bg-sky-50',
                  isPossibleChoiceRound(round) ? 'bg-amber-100' : '',
                  rowGroupClass(round),
                ]">
                <p
                  class="text-right text-[14px] font-semibold leading-tight text-sky-950 md:text-base"
                  v-html="roundPrimaryLabelHtml(round)"></p>
                <!-- <p class="text-xs text-sky-700">
                  {{ roundSecondaryLabel(round) }}
                </p>
                <p class="mt-1 text-xs font-semibold text-sky-800">
                  Invoer: {{ roundTotalCount(round) }}/{{ round.maxUnits }} {{ round.unit }}
                </p> -->
              </td>

              <td
                v-for="player in players"
                :key="`${round.key}-${player.id}`"
                class="cursor-pointer border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
                :class="[
                  isRowFull(round) ? 'bg-emerald-100' : '',
                  isPossibleChoiceCell(round, player.id)
                    ? 'bg-amber-50 ring-1 ring-inset ring-amber-300'
                    : '',
                  rowGroupClass(round),
                ]"
                @click="openCellEditor(round, player.id)">
                <div class="flex items-center gap-1">
                  <input
                    type="checkbox"
                    class="h-3 w-3 rounded border-sky-300 text-sky-700 focus:ring-sky-400"
                    :checked="round.selections[player.id]"
                    :disabled="
                      isEditingDisabled || isRowFull(round) || !canChooseRound(round, player.id)
                    "
                    :aria-label="`Gekozen door ${
                      player.name || 'speler'
                    } voor ${round.name}`"
                    :title="`Gekozen door ${player.name || 'speler'} voor ${
                      round.name
                    }`"
                    @click.stop
                    @change="
                      setChooser(round, player.id, $event.target.checked)
                    " />
                  <select
                    v-if="isCellEditing(round, player.id)"
                    :value="round.counts[player.id]"
                    :class="selectClass"
                    :disabled="!canEditRoundScores(round)"
                    @click.stop
                    @blur="closeCellEditor"
                    @change="
                      updateCellCount(round, player.id, $event.target.value)
                    ">
                    <option
                      v-for="count in countOptions(round, player.id)"
                      :key="`${round.key}-${player.id}-pos-${count}`"
                      :value="count">
                      {{ countOptionLabel(round, count) }}
                    </option>
                  </select>
                  <p
                    v-else
                    class="min-h-3 flex-1 text-right text-[15px] font-semibold text-sky-900">
                    {{ selectedPoints(round, player.id) }}
                  </p>
                </div>
              </td>
            </tr>

            <tr>
              <th
                class="w-18 md:w-22 sticky left-0 z-10 border-b border-sky-200 bg-sky-100/70 px-1 py-0.5 text-right text-[12px] text-emerald-600 md:px-1.5 md:py-1 md:text-xs">
                Positief
              </th>
              <th
                v-for="player in players"
                :key="`positive-subtotal-${player.id}`"
                class="border border-sky-200 bg-sky-100/70 px-1 py-1 text-center text-[12px] font-bold md:px-1.5 md:py-1.5 md:text-xs"
                :class="pointsClass(positiveTotals[player.id])">
                {{ positiveTotals[player.id] }}
              </th>
            </tr>
          </tbody>

          <tfoot>
            <tr>
              <th
                class="w-18 md:w-22 sticky left-0 z-20 border-t border-sky-300 bg-sky-100 px-1 py-0.5 text-right text-[12px] font-bold text-sky-950 md:px-1.5 md:py-1 md:text-xs">
                Totaal
              </th>
              <th
                v-for="player in players"
                :key="`total-${player.id}`"
                class="border border-sky-200 bg-sky-100 px-1 py-1 text-center text-[12px] font-bold md:px-1.5 md:py-1.5 md:text-xs"
                :class="pointsClass(grandTotals[player.id])">
                {{ grandTotals[player.id] }}
              </th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        v-if="!isViewerMode && showViewerQrCode && viewerQrCodeDataUrl"
        class="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/60 px-4"
        @click.self="closeViewerQrCode">
        <div
          class="w-full max-w-sm rounded-xl border border-sky-200 bg-white p-4 shadow-xl">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-sky-900">
                Meeleeslink QR-code
              </p>
              <p class="text-xs text-sky-700">
                Scan met je telefoon om direct mee te kijken.
              </p>
            </div>
            <button
              type="button"
              class="rounded border border-sky-300 bg-white px-2 py-0.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
              @click="closeViewerQrCode">
              Sluiten
            </button>
          </div>

          <div class="flex justify-center">
            <img
              :src="viewerQrCodeDataUrl"
              alt="QR-code voor meeleeslink"
              class="h-64 w-64 rounded border border-sky-200 bg-white p-2" />
          </div>

          <p class="mt-3 truncate text-center text-[11px] text-sky-700">
            {{ shareViewerUrl }}
          </p>
        </div>
      </div>

      <div
        v-if="resultsModalOpen && isGameFinished"
        class="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/60 px-4"
        @click.self="closeResultsModal">
        <div class="w-full max-w-2xl rounded-xl border border-sky-200 bg-white p-4 shadow-xl">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-sky-900">Uitslag</p>
              <p class="text-xs text-sky-700">Totaalstand van het gespeelde spel.</p>
            </div>
            <button
              type="button"
              class="rounded border border-sky-300 bg-white px-2 py-0.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
              @click="closeResultsModal">
              Sluiten
            </button>
          </div>

          <div class="overflow-hidden rounded-lg border border-sky-200">
            <table class="w-full border-separate border-spacing-0">
              <thead>
                <tr class="bg-sky-100 text-left text-xs font-semibold text-sky-900">
                  <th class="px-3 py-2">#</th>
                  <th class="px-3 py-2">Speler</th>
                  <th class="px-3 py-2 text-right">Negatief</th>
                  <th class="px-3 py-2 text-right">Positief</th>
                  <th class="px-3 py-2 text-right">Totaal</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(entry, index) in resultsStandings"
                  :key="entry.id"
                  class="border-t border-sky-100 text-sm text-sky-950">
                  <td class="px-3 py-2 font-semibold text-sky-700">{{ index + 1 }}</td>
                  <td class="px-3 py-2 font-semibold">{{ entry.name }}</td>
                  <td class="px-3 py-2 text-right">{{ entry.negative }}</td>
                  <td class="px-3 py-2 text-right">{{ entry.positive }}</td>
                  <td class="px-3 py-2 text-right font-bold" :class="pointsClass(entry.total)">{{ entry.total }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
