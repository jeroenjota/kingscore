<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  lobbySelectedPlayers: {
    type: Array,
    required: true,
  },
  playerNameOptions: {
    type: Array,
    required: true,
  },
  lobbySelectionError: {
    type: String,
    default: "",
  },
  lobbyGameCode: {
    type: String,
    default: "",
  },
  isStartHostDisabled: {
    type: Boolean,
    default: false,
  },
  lobbyHostCheckLoading: {
    type: Boolean,
    default: false,
  },
  lobbyHostLocked: {
    type: Boolean,
    default: false,
  },
  lobbyNewPlayerName: {
    type: String,
    default: "",
  },
  isAddingLobbyPlayer: {
    type: Boolean,
    default: false,
  },
  lobbyPlayerMessage: {
    type: String,
    default: "",
  },
  lobbyPlayerError: {
    type: String,
    default: "",
  },
  recentGamesLoading: {
    type: Boolean,
    default: false,
  },
  recentGamesError: {
    type: String,
    default: "",
  },
  recentGames: {
    type: Array,
    required: true,
  },
  isLobbyPlayerOptionDisabled: {
    type: Function,
    required: true,
  },
  formatUpdatedAt: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  "update:lobbyPlayerAt",
  "update:lobbyGameCode",
  "update:lobbyNewPlayerName",
  "start-host",
  "start-viewer",
  "add-player",
  "refresh-games",
  "open-saved-host",
  "open-saved-viewer",
]);

function updateLobbyPlayerAt(index, value) {
  emit("update:lobbyPlayerAt", { index, value });
}

const selectedRecentGameId = ref("");

const selectedRecentGame = computed(() =>
  props.recentGames.find((item) => item.gameId === selectedRecentGameId.value) ||
  null,
);

watch(
  () => props.recentGames,
  (games) => {
    const hasCurrent = games.some((item) => item.gameId === selectedRecentGameId.value);
    if (hasCurrent) {
      return;
    }

    selectedRecentGameId.value = games[0]?.gameId || "";
  },
  { immediate: true },
);

function openSelectedSavedHost() {
  if (!selectedRecentGame.value || selectedRecentGame.value.hostLocked) {
    return;
  }

  emit("open-saved-host", selectedRecentGame.value.gameId);
}

function openSelectedSavedViewer() {
  if (!selectedRecentGame.value) {
    return;
  }

  emit("open-saved-viewer", selectedRecentGame.value.gameId);
}
</script>

<template>
  <section
    class="mx-auto mt-8 w-full max-w-lg rounded-xl border border-sky-600 bg-sky-50 p-4 shadow-sm">
    <h1 class="text-center text-2xl font-bold text-sky-900">
      Kingen Score Lobby
    </h1>
    <p class="mt-2 text-center text-sm text-sky-700">
      Kies 4 spelers en open de tafel als host of kijker.
    </p>

    <div class="mt-4 grid gap-3">
      <div class="rounded-lg border border-sky-200 bg-white/80 p-3">
        <h2 class="text-sm font-semibold text-sky-900">Kies 4 King spelers</h2>
        <div class="mt-2 grid grid-cols-4 gap-1 md:grid-cols-4">
          <div
            v-for="(_selectedName, index) in props.lobbySelectedPlayers"
            :key="`lobby-player-${index}`"
            class="grid gap-1">
            <span class="text-xs font-semibold text-sky-800"
              >Speler {{ index + 1 }}</span
            >
            <select
              :value="props.lobbySelectedPlayers[index]"
              class="rounded border border-sky-300 bg-white px-1 py-1 text-xs text-sky-950 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-300/70"
              @change="updateLobbyPlayerAt(index, $event.target.value)">
              <option value="">Kies speler</option>
              <option
                v-for="name in props.playerNameOptions"
                :key="`lobby-${index}-${name}`"
                :value="name"
                :disabled="props.isLobbyPlayerOptionDisabled(name, index)">
                {{ name }}
              </option>
            </select>
          </div>
        </div>
        <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-3">
          <div class="grid grid-cols-[auto_6rem_auto] items-center gap-2">
            <label class="text-sm font-semibold text-sky-900">
              Nieuwe speler
            </label>
            <input
              :value="props.lobbyNewPlayerName"
              type="text"
              maxlength="64"
              class="h-8 w-full rounded border border-sky-300 bg-white px-2 text-sm text-sky-950 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-300/70"
              placeholder="Naam"
              @input="emit('update:lobbyNewPlayerName', $event.target.value)"
            />
            <button
              type="button"
              class="h-8 rounded bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
              :disabled="props.isAddingLobbyPlayer"
              @click="emit('add-player')"
            >
              Voeg toe
            </button>
          </div>
          <p
            v-if="props.lobbyPlayerMessage"
            class="mt-1 text-xs text-emerald-700">
            {{ props.lobbyPlayerMessage }}
          </p>
          <p v-if="props.lobbyPlayerError" class="mt-1 text-xs text-rose-700">
            {{ props.lobbyPlayerError }}
          </p>
        </div>

        <p v-if="props.lobbySelectionError" class="mt-1 text-xs text-rose-700">
          {{ props.lobbySelectionError }}
        </p>
        <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-3">
          <div class="grid grid-cols-[auto_6rem_auto] items-center gap-2">
            <label class="text-sm font-semibold text-sky-900" for="game-code">
              Nieuwe spel code
            </label>
            <input
              id="game-code"
              :value="props.lobbyGameCode"
              type="text"
              maxlength="12"
              class="h-8 w-full rounded border border-sky-300 bg-white px-2 text-sm text-sky-950 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-300/70"
              placeholder="bijv. tafel1"
              @input="emit('update:lobbyGameCode', $event.target.value)"
            />
            <button
              type="button"
              class="h-8 rounded bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
              :disabled="props.isStartHostDisabled"
              @click="emit('start-host')"
            >
              Start spel
            </button>
          </div>
        </div>
      </div>
      <p v-if="props.lobbyHostCheckLoading" class="text-xs text-sky-700">
        Gastheer-status controleren...
      </p>
      <p v-if="props.lobbyHostLocked" class="text-xs text-amber-700">
        Deze gamecode heeft al een actieve host.
      </p>

      <div class="mt-4 rounded-lg border border-sky-200 bg-white/80 p-3">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-sky-900">Aangemaakte games</h2>
          <button
            type="button"
            class="rounded border border-sky-300 bg-white px-2 py-0.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-50"
            @click="emit('refresh-games')">
            Vernieuwen
          </button>
        </div>

        <p v-if="props.recentGamesLoading" class="text-xs text-sky-700">
          Games laden...
        </p>
        <p v-else-if="props.recentGamesError" class="text-xs text-rose-700">
          {{ props.recentGamesError }}
        </p>
        <p
          v-else-if="props.recentGames.length === 0"
          class="text-xs text-sky-700">
          Nog geen opgeslagen games gevonden.
        </p>

        <div v-else class="grid gap-2">
          <div class="grid grid-cols-[1fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            <span>Datum</span>
            <span>Code</span>
          </div>

          <select
            v-model="selectedRecentGameId"
            class="w-full rounded border border-sky-300 bg-white px-2 py-2 text-sm text-sky-950 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-300/70"
          >
            <option
              v-for="item in props.recentGames"
              :key="item.gameId"
              :value="item.gameId"
            >
              {{ props.formatUpdatedAt(item.updatedAt) }} | {{ item.gameId.toUpperCase() }}
            </option>
          </select>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded bg-sky-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
              :disabled="!selectedRecentGame || selectedRecentGame.hostLocked"
              @click="openSelectedSavedHost"
            >
              Open als Gastheer
            </button>
            <button
              type="button"
              class="rounded border border-sky-400 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedRecentGame"
              @click="openSelectedSavedViewer"
            >
              Open als kijker/speler
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
