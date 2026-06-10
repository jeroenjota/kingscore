<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
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
  lobbyAdminCode: {
    type: String,
    default: "",
  },
  formatUpdatedAt: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  "open-saved-host",
  "open-saved-viewer",
  "delete-saved-game",
]);

const selectedRecentGameId = ref("");

const selectedRecentGame = computed(
  () =>
    props.recentGames.find(
      (item) => item.gameId === selectedRecentGameId.value,
    ) || null,
);

watch(
  () => props.recentGames,
  (games) => {
    const hasCurrent = games.some(
      (item) => item.gameId === selectedRecentGameId.value,
    );
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

function deleteSelectedSavedGame() {
  if (!selectedRecentGame.value || selectedRecentGame.value.hostLocked) {
    return;
  }

  emit("delete-saved-game", selectedRecentGame.value.gameId);
}
</script>

<template>
  <div class="mt-4 rounded-lg border border-sky-200 bg-white/80 p-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-lg font-semibold text-sky-900">Reeds gespeeld</p>
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
      <select
        v-model="selectedRecentGameId"
        class="w-full rounded border border-sky-300 bg-white px-2 py-2 text-sm text-sky-950 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-300/70">
        <option
          v-for="item in props.recentGames"
          :key="item.gameId"
          :value="item.gameId">
          {{ props.formatUpdatedAt(item.updatedAt) }} |
          {{ item.gameId.toUpperCase() }}
        </option>
      </select>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded bg-sky-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
          :disabled="!selectedRecentGame || selectedRecentGame.hostLocked"
          @click="openSelectedSavedHost">
          Open als Gastheer
        </button>
        <button
          type="button"
          class="rounded border border-sky-400 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!selectedRecentGame"
          @click="openSelectedSavedViewer">
          Open als kijker/speler
        </button>
        <button
          type="button"
          class="rounded border border-rose-400 bg-white px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!selectedRecentGame || !props.lobbyAdminCode || selectedRecentGame.hostLocked"
          @click="deleteSelectedSavedGame">
          Verwijder spel
        </button>
      </div>
      <p v-if="selectedRecentGame?.hostLocked" class="text-xs text-amber-700">
        Verwijderen is uitgeschakeld zolang een host actief is.
      </p>
    </div>
  </div>
</template>
