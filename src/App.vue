<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import LobbyPanel from "./components/LobbyPanel.vue";
import ScoreTable from "./components/ScoreTable.vue";
import ViewerQrModal from "./components/ViewerQrModal.vue";
import ResultsModal from "./components/ResultsModal.vue";
import {
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
  () => lobbyHostLocked.value || lobbyHostCheckLoading.value,
);

let syncTimerId = null;
let syncPushTimeoutId = null;
let hostLockTimerId = null;
let gameEvents = null;
let isApplyingRemoteState = false;
let lastRemoteUpdatedAt = 0;
let toastTimerId = null;
let lastPushedStateSignature = "";
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

watch(lobbyAdminCode, (value) => {
  persistLobbyAdminCode(value);
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
      v-if="!hasActiveGame"
      :admin-state="{
        lobbyAdminCode,
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
