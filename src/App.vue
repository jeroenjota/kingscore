<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import LobbyPanel from "./components/LobbyPanel.vue";
import HelpPage from "./components/HelpPage.vue";
import ScoreTable from "./components/ScoreTable.vue";
import ViewerQrModal from "./components/ViewerQrModal.vue";
import ResultsModal from "./components/ResultsModal.vue";
import {
  DEFAULT_PLAYER_NAMES,
  MAX_NEGATIVE_CHOICES,
  MAX_POSITIVE_CHOICES,
  detectInitialGameId,
  loadPersistedState,
  normalizeState,
  roundTemplates,
} from "./lib/gameState";
import { useLobbyApi } from "./composables/useLobbyApi";
import { useScoreRules } from "./composables/useScoreRules";

const playerNameOptions = ref([]);

const STORAGE_KEY = `kingscore-state-v1:${detectInitialGameId()}`;
const LOBBY_PLAYERS_KEY = "kingscore-lobby-players-v1";
const LOBBY_ADMIN_CODE_KEY = "kingscore-lobby-admin-code-v1";
const LOBBY_ADMIN_CODE_TTL_MS = 2 * 60 * 60 * 1000;
const SYNC_POLL_INTERVAL_MS = 8000;
const SYNC_PUSH_DEBOUNCE_MS = 1000;

const initialState = loadPersistedState({
  storageKey: STORAGE_KEY,
  lobbyPlayersKey: LOBBY_PLAYERS_KEY,
});

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
const lobbyApiReachable = ref(false);
const lobbyApiStatusLoading = ref(false);
const lobbyAdminCodeValid = ref(false);
const lobbyAdminCodeValidationLoading = ref(false);
const showHelpPage = ref(false);
const lobbyNewPlayerName = ref("");
const lobbyDeletePlayerName = ref("");
const lobbyAdminCode = ref("");
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
  () => lobbyHostCheckLoading.value,
);

let syncTimerId = null;
let syncPushTimeoutId = null;
let hostLockTimerId = null;
let lobbyApiStatusTimerId = null;
let lobbyAdminValidationTimeoutId = null;
let latestLobbyAdminValidationId = 0;
let gameEvents = null;
let isApplyingRemoteState = false;
let lastRemoteUpdatedAt = 0;
let toastTimerId = null;
let lastPushedStateSignature = "";
const HOST_HEARTBEAT_INTERVAL_MS = 10_000;
const SCORE_UNDO_LIMIT = 120;
const scoreUndoStack = ref([]);
const scoreRedoStack = ref([]);

function cloneScoreState(state) {
  return JSON.parse(JSON.stringify(state));
}

function captureUndoSnapshot() {
  if (isViewerMode.value || !hasActiveGame.value) {
    return;
  }

  scoreUndoStack.value.push(cloneScoreState(serializableState()));
  scoreRedoStack.value = [];
  if (scoreUndoStack.value.length > SCORE_UNDO_LIMIT) {
    scoreUndoStack.value.shift();
  }
}

function clearScoreHistory() {
  scoreUndoStack.value = [];
  scoreRedoStack.value = [];
}

function canUndoScoreInput() {
  return !isViewerMode.value && scoreUndoStack.value.length > 0;
}

function undoScoreInput() {
  if (!canUndoScoreInput()) {
    return;
  }

  scoreRedoStack.value.push(cloneScoreState(serializableState()));
  if (scoreRedoStack.value.length > SCORE_UNDO_LIMIT) {
    scoreRedoStack.value.shift();
  }

  const snapshot = scoreUndoStack.value.pop();
  if (!snapshot) {
    return;
  }

  applyState(snapshot);
  showToast("Laatste scorewijziging ongedaan gemaakt.");
}

function canRedoScoreInput() {
  return !isViewerMode.value && scoreRedoStack.value.length > 0;
}

function redoScoreInput() {
  if (!canRedoScoreInput()) {
    return;
  }

  scoreUndoStack.value.push(cloneScoreState(serializableState()));
  if (scoreUndoStack.value.length > SCORE_UNDO_LIMIT) {
    scoreUndoStack.value.shift();
  }

  const snapshot = scoreRedoStack.value.pop();
  if (!snapshot) {
    return;
  }

  applyState(snapshot);
  showToast("Scorewijziging opnieuw toegepast.");
}

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

const {
  syncApiBaseUrl,
  clearPersistedLobbyAdminCode,
  persistLobbyAdminCode,
  loadPersistedLobbyAdminCode,
  loadPlayerNameOptions,
  addLobbyPlayerName,
  deleteLobbyPlayerName,
  loadRecentGames,
  deleteSavedGame,
  refreshLobbyHostLock,
  claimHostLockForGame,
  releaseHostLockForGame,
  forceReleaseHostLock,
} = useLobbyApi({
  lobbyAdminCodeKey: LOBBY_ADMIN_CODE_KEY,
  lobbyAdminCodeTtlMs: LOBBY_ADMIN_CODE_TTL_MS,
  state: {
    playerNameOptions,
    lobbySelectedPlayers,
    lobbyNewPlayerName,
    lobbyDeletePlayerName,
    lobbyAdminCode,
    lobbyPlayerMessage,
    lobbyPlayerError,
    lobbyDeletePlayerMessage,
    lobbyDeletePlayerError,
    isAddingLobbyPlayer,
    isDeletingLobbyPlayer,
    recentGames,
    recentGamesLoading,
    recentGamesError,
    lobbyHostLocked,
    lobbyHostCheckLoading,
    lobbyGameCode,
    hostClientId,
  },
  normalizeGameCode,
  persistLobbyPlayers,
  showToast,
  getOrCreateHostClientId,
});

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

  if (!isViewerMode.value) {
    activeCellKey.value = null;
  }

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

function openHelpPage() {
  if (hasActiveGame.value) {
    return;
  }

  showHelpPage.value = true;
}

function closeHelpPage() {
  showHelpPage.value = false;
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

async function refreshLobbyApiStatus() {
  if (!lobbyAdminCodeValid.value) {
    lobbyApiReachable.value = false;
    lobbyApiStatusLoading.value = false;
    return;
  }

  lobbyApiStatusLoading.value = true;

  try {
    const response = await fetch(`${syncApiBaseUrl()}/api/player-names`, {
      cache: "no-store",
    });
    lobbyApiReachable.value = response.ok;
  } catch {
    lobbyApiReachable.value = false;
  } finally {
    lobbyApiStatusLoading.value = false;
  }
}

async function refreshLobbyAdminCodeValidity() {
  const code = String(lobbyAdminCode.value || "").trim();
  const requestId = ++latestLobbyAdminValidationId;

  if (!code) {
    lobbyAdminCodeValidationLoading.value = false;
    lobbyAdminCodeValid.value = false;
    stopLobbyApiStatusPolling();
    lobbyApiReachable.value = false;
    lobbyApiStatusLoading.value = false;
    return;
  }

  lobbyAdminCodeValidationLoading.value = true;

  try {
    // Use an invalid game id to validate admin code without deleting anything.
    const response = await fetch(`${syncApiBaseUrl()}/api/games/ab`, {
      method: "DELETE",
      headers: {
        "X-Admin-Code": code,
      },
    });

    if (requestId !== latestLobbyAdminValidationId) {
      return;
    }

    lobbyAdminCodeValid.value = response.status === 400;
  } catch {
    if (requestId !== latestLobbyAdminValidationId) {
      return;
    }

    lobbyAdminCodeValid.value = false;
  } finally {
    if (requestId !== latestLobbyAdminValidationId) {
      return;
    }

    lobbyAdminCodeValidationLoading.value = false;

    if (!lobbyAdminCodeValid.value) {
      stopLobbyApiStatusPolling();
      lobbyApiReachable.value = false;
      lobbyApiStatusLoading.value = false;
      return;
    }

    startLobbyApiStatusPolling();
  }
}

function stopLobbyApiStatusPolling() {
  if (!lobbyApiStatusTimerId) {
    return;
  }

  clearInterval(lobbyApiStatusTimerId);
  lobbyApiStatusTimerId = null;
}

function startLobbyApiStatusPolling() {
  stopLobbyApiStatusPolling();
  void refreshLobbyApiStatus();

  lobbyApiStatusTimerId = setInterval(() => {
    void refreshLobbyApiStatus();
  }, 10_000);
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

function resolveLobbyPlayersForStart() {
  const selected = lobbySelectedPlayers.value.map((name) => String(name || "").trim());
  const filledNames = selected.filter(Boolean);

  if (filledNames.length === 0) {
    const shouldUseDefaults = window.confirm(
      `Er zijn nog geen spelers gekozen. Wil je ${DEFAULT_PLAYER_NAMES.join(", ")} gebruiken?`,
    );

    if (!shouldUseDefaults) {
      lobbySelectionError.value = "Game starten geannuleerd. Kies vier spelers om verder te gaan.";
      return null;
    }

    return [...DEFAULT_PLAYER_NAMES];
  }

  const uniqueSelected = [...new Set(filledNames)];
  if (uniqueSelected.length !== 4) {
    lobbySelectionError.value =
      "Kies vier verschillende spelers om de game te starten.";
    return null;
  }

  return uniqueSelected;
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
    clearScoreHistory();
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


async function goToGame(viewerMode) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeGameCode(lobbyGameCode.value || randomGameId());
  if (!normalized) {
    return;
  }

  const selectedPlayers = resolveLobbyPlayersForStart();
  if (!selectedPlayers) {
    if (!viewerMode) {
      lobbyHostLocked.value = false;
    }
    return;
  }

  lobbySelectionError.value = "";

  if (!viewerMode) {
    clearScoreHistory();
    const lockClaimed = await claimHostLockForGame(normalized);
    if (!lockClaimed) {
      await refreshLobbyHostLock();
      await loadRecentGames();
      showToast("Host is al actief voor deze gamecode.");
      return;
    }
  }

  lobbySelectedPlayers.value = [...selectedPlayers];
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

async function resetHostSessionFromLobby() {
  if (typeof window === "undefined") {
    return;
  }

  const key = "kingscore-host-id-v1";
  const existingHostId = String(window.sessionStorage.getItem(key) || "")
    .trim()
    .toLowerCase();
  const normalizedCode = normalizeGameCode(lobbyGameCode.value);

  if (existingHostId) {
    hostClientId.value = existingHostId;
  }

  if (normalizedCode && existingHostId) {
    await releaseHostLockForGame(normalizedCode);
  }

  window.sessionStorage.removeItem(key);
  hostClientId.value = "";
  lobbyHostLocked.value = false;
  await refreshLobbyHostLock();
  showToast("Lokale host-instelling gereset.");
}

async function forceReleaseHostLockFromLobby() {
  const normalizedCode = normalizeGameCode(lobbyGameCode.value);
  if (!normalizedCode) {
    showToast("Kies eerst een gamecode.");
    return;
  }

  if (!lobbyAdminCode.value) {
    showToast("Vul eerst je beheerderscode in.");
    return;
  }

  if (!window.confirm(`Weet je zeker dat je de host lock voor gamecode "${normalizedCode}" wilt forceren?`)) {
    return;
  }

  const success = await forceReleaseHostLock(normalizedCode);
  if (success) {
    window.sessionStorage.removeItem("kingscore-host-id-v1");
    hostClientId.value = "";
    await refreshLobbyHostLock();
    await loadRecentGames();
  }
}

async function openLobby() {
  if (typeof window === "undefined") {
    return;
  }

  if (!isViewerMode.value) {
    clearScoreHistory();
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

  const statePayload = serializableState();
  const stateSignature = JSON.stringify(statePayload);
  if (stateSignature === lastPushedStateSignature) {
    return;
  }

  try {
    const response = await fetch(
      `${syncApiBaseUrl()}/api/games/${gameId.value}/state`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: statePayload }),
      },
    );

    if (!response.ok) {
      syncStatus.value = "Lokaal";
      return;
    }

    const payload = await response.json();
    lastRemoteUpdatedAt = Number(payload?.updatedAt || Date.now());
    lastPushedStateSignature = stateSignature;
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
  }, SYNC_PUSH_DEBOUNCE_MS);
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

  gameEvents.onopen = () => {
    // Realtime active: disable polling to avoid duplicate network traffic.
    if (syncTimerId) {
      clearInterval(syncTimerId);
      syncTimerId = null;
    }
  };

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
    startSyncPolling();
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

watch(gameId, () => {
  clearScoreHistory();
});

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
  lobbyHostLocked.value = false;
  void refreshLobbyHostLock();
});

watch(lobbyAdminCode, (value) => {
  persistLobbyAdminCode(value);

  lobbyAdminCodeValid.value = false;
  lobbyApiReachable.value = false;
  lobbyApiStatusLoading.value = false;

  if (lobbyAdminValidationTimeoutId) {
    clearTimeout(lobbyAdminValidationTimeoutId);
    lobbyAdminValidationTimeoutId = null;
  }

  const trimmed = String(value || "").trim();
  if (!trimmed) {
    latestLobbyAdminValidationId += 1;
    lobbyAdminCodeValidationLoading.value = false;
    stopLobbyApiStatusPolling();
    return;
  }

  lobbyAdminCodeValidationLoading.value = true;
  lobbyAdminValidationTimeoutId = setTimeout(() => {
    lobbyAdminValidationTimeoutId = null;
    void refreshLobbyAdminCodeValidity();
  }, 300);
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
  lobbyAdminCode.value = loadPersistedLobbyAdminCode();
  await loadPlayerNameOptions();

  if (!hasActiveGame.value) {
    syncStatus.value = "Lobby";
    await refreshLobbyAdminCodeValidity();
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
});

onBeforeUnmount(() => {
  if (syncTimerId) {
    clearInterval(syncTimerId);
  }

  if (syncPushTimeoutId) {
    clearTimeout(syncPushTimeoutId);
  }

  if (lobbyAdminValidationTimeoutId) {
    clearTimeout(lobbyAdminValidationTimeoutId);
    lobbyAdminValidationTimeoutId = null;
  }

  stopLobbyApiStatusPolling();

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

const selectClass =
  "w-full rounded-lg border border-sky-200 bg-white px-1 py-0.5 text-[16px] text-sky-950 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-300/60";

const {
  isCurrentTurnPlayer,
  isPossibleChoiceRound,
  isPossibleChoiceCell,
  canChooseRound,
  setChooser,
  canEditRoundScores,
  isCellEditing,
  openCellEditor,
  closeCellEditor,
  updateCellCount,
  selectedPoints,
  countOptions,
  countOptionLabel,
  negativeRounds,
  positiveRounds,
  isRowFull,
  rowGroupClass,
  roundPrimaryLabelHtml,
  negativeTotals,
  positiveTotals,
  grandTotals,
  isGameFinished,
  resultsStandings,
  resultsModalOpen,
  openResultsModal,
  closeResultsModal,
  pointsClass,
} = useScoreRules({
  players,
  rounds,
  turnStartPlayerId,
  activeCellKey,
  isEditingDisabled,
  onBeforeScoreChange: captureUndoSnapshot,
  maxNegativeChoices: MAX_NEGATIVE_CHOICES,
  maxPositiveChoices: MAX_POSITIVE_CHOICES,
});
</script>

<template>
  <main class="max-w-136 mx-auto grid w-full gap-0.5 px-2 py-1 md:px-2 md:py-1.5">
    <div
      v-if="toastMessage"
      class="z-70 pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-sky-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      {{ toastMessage }}
    </div>

    <LobbyPanel
      v-if="!hasActiveGame && !showHelpPage"
      :admin-state="{
        lobbyAdminCode,
      }"
      :api-state="{
        lobbyAdminCodeValid,
        lobbyAdminCodeValidationLoading,
        lobbyApiReachable,
        lobbyApiStatusLoading,
      }"
      :players-state="{
        playerNameOptions,
        lobbyNewPlayerName,
        isAddingLobbyPlayer,
        lobbyPlayerMessage,
        lobbyPlayerError,
        lobbyDeletePlayerName,
        isDeletingLobbyPlayer,
        lobbyDeletePlayerMessage,
        lobbyDeletePlayerError,
      }"
      :new-game-state="{
        lobbySelectedPlayers,
        lobbySelectionError,
        lobbyGameCode,
        isStartHostDisabled,
        lobbyHostCheckLoading,
        lobbyHostLocked,
        isLobbyPlayerOptionDisabled,
      }"
      :recent-games-state="{
        recentGamesLoading,
        recentGamesError,
        recentGames,
        formatUpdatedAt,
      }"
      @update:lobby-player-at="({ index, value }) => (lobbySelectedPlayers[index] = value)"
      @update:lobby-game-code="(value) => (lobbyGameCode = value)"
      @update:lobby-new-player-name="(value) => (lobbyNewPlayerName = value)"
      @update:lobby-delete-player-name="(value) => (lobbyDeletePlayerName = value)"
      @update:lobby-admin-code="(value) => (lobbyAdminCode = value)"
      @start-host="goToGame(false)"
      @start-viewer="goToGame(true)"
      @add-player="addLobbyPlayerName"
      @delete-player="deleteLobbyPlayerName"
      @refresh-games="loadRecentGames"
      @open-saved-host="(gameId) => openSavedGame(gameId, false)"
      @open-saved-viewer="(gameId) => openSavedGame(gameId, true)"
      @delete-saved-game="(gameId) => deleteSavedGame(gameId)"
      @open-help-page="openHelpPage"
      @reset-host-session="resetHostSessionFromLobby"
      @force-release-host-lock="forceReleaseHostLockFromLobby"
    />

    <HelpPage
      v-else-if="!hasActiveGame && showHelpPage"
      @close-help="closeHelpPage" />

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
          : <span class="font-bold uppercase">{{ gameId }}</span> |
          <svg
            v-if="syncStatus === 'Online'"
            class="inline h-4 w-4 text-emerald-600"
            fill="currentColor"
            viewBox="0 0 24 24"
            title="Verbonden">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
          </svg>
          <svg
            v-else
            class="inline h-4 w-4 text-rose-500"
            fill="currentColor"
            viewBox="0 0 24 24"
            title="Verbroken">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
          </svg>
          |
          <span class="font-semibold">{{ isViewerMode ? "Speler/Kijker" : "Gastheer" }}</span>
        </p>
        <div v-if="!isViewerMode" class="flex items-center gap-1">
          <button
            type="button"
            class="rounded border border-sky-300 bg-white px-1.5 py-0.5 text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canUndoScoreInput()"
            title="Ongedaan maken"
            @click="undoScoreInput">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
          <button
            type="button"
            class="rounded border border-sky-300 bg-white px-1.5 py-0.5 text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canRedoScoreInput()"
            title="Opnieuw toepassen"
            @click="redoScoreInput">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 15 21 9m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
            </svg>
          </button>
          <button
            type="button"
            class="rounded border border-sky-300 bg-white px-2 py-0.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-50"
            title="Naar startscherm"
            @click="openLobby">
            Lobby
          </button>
          <button
            v-if="!isViewerMode"
            type="button"
            class="rounded border border-sky-300 bg-white px-2 py-0.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-50"
            title="QR-code voor kijkers"
            @click="toggleViewerQrCode">
            {{ showViewerQrCode ? "<=" : "QR" }}
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
      <ScoreTable
        :players="players"
        :negative-rounds="negativeRounds"
        :positive-rounds="positiveRounds"
        :negative-totals="negativeTotals"
        :positive-totals="positiveTotals"
        :grand-totals="grandTotals"
        :is-editing-disabled="isEditingDisabled"
        :select-class="selectClass"
        :is-current-turn-player="isCurrentTurnPlayer"
        :is-row-full="isRowFull"
        :is-possible-choice-round="isPossibleChoiceRound"
        :row-group-class="rowGroupClass"
        :round-primary-label-html="roundPrimaryLabelHtml"
        :is-possible-choice-cell="isPossibleChoiceCell"
        :open-cell-editor="openCellEditor"
        :can-choose-round="canChooseRound"
        :set-chooser="setChooser"
        :is-cell-editing="isCellEditing"
        :can-edit-round-scores="canEditRoundScores"
        :close-cell-editor="closeCellEditor"
        :update-cell-count="updateCellCount"
        :count-options="countOptions"
        :count-option-label="countOptionLabel"
        :selected-points="selectedPoints"
        :points-class="pointsClass" />

      <ViewerQrModal
        :is-viewer-mode="isViewerMode"
        :show-viewer-qr-code="showViewerQrCode"
        :viewer-qr-code-data-url="viewerQrCodeDataUrl"
        :share-viewer-url="shareViewerUrl"
        @close="closeViewerQrCode" />

      <ResultsModal
        :results-modal-open="resultsModalOpen"
        :is-game-finished="isGameFinished"
        :results-standings="resultsStandings"
        :points-class="pointsClass"
        @close="closeResultsModal" />
    </section>
  </main>
</template>
