<script setup>
const props = defineProps({
  lobbyVariantKey: {
    type: String,
    required: true,
  },
  lobbyVariantOptions: {
    type: Array,
    required: true,
  },
  lobbyPlayerCount: {
    type: Number,
    required: true,
  },
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
  isPlayerSelectionEnabled: {
    type: Boolean,
    default: false,
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
  "update:lobbyVariantKey",
  "update:lobbyPlayerAt",
  "update:lobbyGameCode",
  "start-host",
  "reset-host-session",
  "force-release-host-lock",
]);

function updateLobbyPlayerAt(index, value) {
  emit("update:lobbyPlayerAt", { index, value });
}
</script>

<template>
  <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-2">
    <p class="text-center text-lg font-semibold text-sky-900">Nieuw spel</p>
    <div class="mt-1 grid gap-2">
      <div class="rounded-lg border border-sky-200 bg-white/80 p-2">
        <div class="grid grid-cols-[auto_1fr] items-center gap-2">
          <div class="col-span-2 flex w-full flex-wrap items-center justify-center gap-4">
            <h2 class="inline-flex text-sm font-semibold text-sky-900">Kies</h2>
            <label
              v-for="option in props.lobbyVariantOptions"
              :key="option.key"
              class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-sky-900">
              <input
                type="radio"
                name="lobby-variant"
                :value="option.key"
                :checked="props.lobbyVariantKey === option.key"
                class="h-3.5 w-3.5 border-sky-400 text-sky-700 focus:ring-sky-300"
                @change="emit('update:lobbyVariantKey', option.key)" />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </div>

        <div
          v-if="props.isPlayerSelectionEnabled"
          class="mt-2 grid gap-1"
          :class="
            props.lobbyPlayerCount === 4
              ? 'grid-cols-4 md:grid-cols-4'
              : 'grid-cols-3 md:grid-cols-3'
          ">
          <div
            v-for="(_selectedName, index) in props.lobbySelectedPlayers"
            :key="`lobby-player-${index}`"
            class="grid gap-1">
            <span class="text-xs font-semibold text-sky-800">
              Speler {{ index + 1 }}
            </span>
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
              Spel code
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
      <div v-if="props.lobbyHostLocked" class="flex flex-wrap gap-2">
        <button
          type="button"
          class="w-fit rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          @click="emit('reset-host-session')">
          Reset host op dit toestel
        </button>
        <button
          type="button"
          class="w-fit rounded border border-rose-400 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100"
          @click="emit('force-release-host-lock')">
          Forceer vrijgave (admin)
        </button>
      </div>
    </div>
  </div>
</template>
