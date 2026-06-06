<script setup>
const props = defineProps({
  playerNameOptions: {
    type: Array,
    required: true,
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
  lobbyDeletePlayerName: {
    type: String,
    default: "",
  },
  lobbyAdminCode: {
    type: String,
    default: "",
  },
  isDeletingLobbyPlayer: {
    type: Boolean,
    default: false,
  },
  lobbyDeletePlayerMessage: {
    type: String,
    default: "",
  },
  lobbyDeletePlayerError: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "update:lobbyNewPlayerName",
  "add-player",
  "update:lobbyDeletePlayerName",
  "delete-player",
]);
</script>

<template>
  <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-2">
    <p class="text-center text-lg font-semibold text-sky-900">Spelers</p>
    <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-2">
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
          @input="emit('update:lobbyNewPlayerName', $event.target.value)" />
        <button
          type="button"
          class="h-8 rounded bg-sky-700 px-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-300"
          :disabled="props.isAddingLobbyPlayer"
          @click="emit('add-player')">
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

    <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-2">
      <div class="grid grid-cols-[auto_6rem_auto] items-center gap-2">
        <label class="text-sm font-semibold text-sky-900">
          Verwijder speler
        </label>
        <select
          :value="props.lobbyDeletePlayerName"
          class="h-8 w-full rounded border border-sky-300 bg-white px-2 text-sm text-sky-950 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-300/70"
          @change="emit('update:lobbyDeletePlayerName', $event.target.value)">
          <option value="">Kies speler</option>
          <option
            v-for="name in props.playerNameOptions"
            :key="`delete-${name}`"
            :value="name">
            {{ name }}
          </option>
        </select>
        <button
          type="button"
          class="h-8 rounded bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
          :disabled="
            props.isDeletingLobbyPlayer || !props.lobbyDeletePlayerName || !props.lobbyAdminCode
          "
          @click="emit('delete-player')">
          Verwijder
        </button>
      </div>
      <p
        v-if="props.lobbyDeletePlayerMessage"
        class="mt-1 text-xs text-emerald-700">
        {{ props.lobbyDeletePlayerMessage }}
      </p>
      <p
        v-if="props.lobbyDeletePlayerError"
        class="mt-1 text-xs text-rose-700">
        {{ props.lobbyDeletePlayerError }}
      </p>
    </div>
  </div>
</template>
