<script setup>
const props = defineProps({
  lobbySelectedPlayers: {
    type: Array,
    required: true,
  },
  playerNameOptions: {
    type: Array,
    required: true,
  },
  isLobbyPlayerOptionDisabled: {
    type: Function,
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
});

const emit = defineEmits([
  "update:lobbyPlayerAt",
  "update:lobbyGameCode",
  "start-host",
]);

function updateLobbyPlayerAt(index, value) {
  emit("update:lobbyPlayerAt", { index, value });
}
</script>

<template>
  <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-2">
    <p class="text-center text-lg font-semibold text-sky-900">
      Nieuw spel
    </p>
    <div class="mt-4 grid gap-2">
      <div class="rounded-lg border border-sky-200 bg-white/80 p-2">
        <h2 class="text-sm font-semibold text-sky-900">Kies 4 spelers</h2>
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

        <p v-if="props.lobbySelectionError" class="mt-1 text-xs text-rose-700">
          {{ props.lobbySelectionError }}
        </p>
        <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-2">
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
              @input="emit('update:lobbyGameCode', $event.target.value)" />
            <button
              type="button"
              class="h-8 rounded bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
              :disabled="props.isStartHostDisabled"
              @click="emit('start-host')">
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
    </div>
  </div>
</template>
