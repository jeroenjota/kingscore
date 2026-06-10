<script setup>
import LobbyAdminSection from "./LobbyAdminSection.vue";
import LobbyPlayersSection from "./LobbyPlayersSection.vue";
import LobbyNewGameSection from "./LobbyNewGameSection.vue";
import LobbyRecentGamesSection from "./LobbyRecentGamesSection.vue";

const props = defineProps({
  adminState: {
    type: Object,
    required: true,
  },
  playersState: {
    type: Object,
    required: true,
  },
  newGameState: {
    type: Object,
    required: true,
  },
  recentGamesState: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  "update:lobbyPlayerAt",
  "update:lobbyGameCode",
  "update:lobbyNewPlayerName",
  "update:lobbyDeletePlayerName",
  "update:lobbyAdminCode",
  "start-host",
  "start-viewer",
  "add-player",
  "delete-player",
  "refresh-games",
  "open-saved-host",
  "open-saved-viewer",
  "delete-saved-game",
  "open-help-page",
  "reset-host-session",
]);
</script>

<template>
  <section
    class="mx-auto mt-8 w-full max-w-lg rounded-xl border border-sky-600 bg-sky-50 p-2 shadow-sm">

    <div class="flex items-center justify-between gap-2">
      <h1 class="mt-2 text-center text-2xl font-bold text-sky-900">
        Kingen Score Lobby
      </h1>
        <button
          type="button"
          class="rounded border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
          @click="emit('open-help-page')">
          Help & regels
        </button>
    </div>
    <LobbyAdminSection
      :lobby-admin-code="props.adminState.lobbyAdminCode"
      @update:lobby-admin-code="(value) => emit('update:lobbyAdminCode', value)" />

    <LobbyPlayersSection
      :player-name-options="props.playersState.playerNameOptions"
      :lobby-new-player-name="props.playersState.lobbyNewPlayerName"
      :is-adding-lobby-player="props.playersState.isAddingLobbyPlayer"
      :lobby-player-message="props.playersState.lobbyPlayerMessage"
      :lobby-player-error="props.playersState.lobbyPlayerError"
      :lobby-delete-player-name="props.playersState.lobbyDeletePlayerName"
      :lobby-admin-code="props.adminState.lobbyAdminCode"
      :is-deleting-lobby-player="props.playersState.isDeletingLobbyPlayer"
      :lobby-delete-player-message="props.playersState.lobbyDeletePlayerMessage"
      :lobby-delete-player-error="props.playersState.lobbyDeletePlayerError"
      @update:lobby-new-player-name="(value) => emit('update:lobbyNewPlayerName', value)"
      @add-player="emit('add-player')"
      @update:lobby-delete-player-name="(value) => emit('update:lobbyDeletePlayerName', value)"
      @delete-player="emit('delete-player')" />

    <LobbyNewGameSection
      :lobby-selected-players="props.newGameState.lobbySelectedPlayers"
      :player-name-options="props.playersState.playerNameOptions"
      :is-lobby-player-option-disabled="props.newGameState.isLobbyPlayerOptionDisabled"
      :lobby-selection-error="props.newGameState.lobbySelectionError"
      :lobby-game-code="props.newGameState.lobbyGameCode"
      :is-start-host-disabled="props.newGameState.isStartHostDisabled"
      :lobby-host-check-loading="props.newGameState.lobbyHostCheckLoading"
      :lobby-host-locked="props.newGameState.lobbyHostLocked"
      @update:lobby-player-at="({ index, value }) => emit('update:lobbyPlayerAt', { index, value })"
      @update:lobby-game-code="(value) => emit('update:lobbyGameCode', value)"
      @start-host="emit('start-host')"
      @reset-host-session="emit('reset-host-session')" />

    <LobbyRecentGamesSection
      :recent-games-loading="props.recentGamesState.recentGamesLoading"
      :recent-games-error="props.recentGamesState.recentGamesError"
      :recent-games="props.recentGamesState.recentGames"
      :lobby-admin-code="props.adminState.lobbyAdminCode"
      :format-updated-at="props.recentGamesState.formatUpdatedAt"
      @open-saved-host="(gameId) => emit('open-saved-host', gameId)"
      @open-saved-viewer="(gameId) => emit('open-saved-viewer', gameId)"
      @delete-saved-game="(gameId) => emit('delete-saved-game', gameId)"
      @open-help-page="emit('open-help-page')" />
  </section>
</template>
