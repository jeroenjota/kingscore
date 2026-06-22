<script setup>
import LobbyAdminSection from "./LobbyAdminSection.vue";
import LobbyPlayersSection from "./LobbyPlayersSection.vue";
import LobbyNewGameSection from "./LobbyNewGameSection.vue";
import LobbyRecentGamesSection from "./LobbyRecentGamesSection.vue";

const props = defineProps({
  apiState: {
    type: Object,
    required: true,
  },
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
  "update:lobbyVariantKey",
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
  "force-release-host-lock",
]);
</script>

<template>
  <section
    class="mx-auto mt-8 w-full max-w-lg rounded-xl border border-sky-600 bg-sky-50 p-2 shadow-sm">

    <div class="flex items-center justify-between gap-2">
      <div class="mt-2 flex items-center gap-2">
        <h1 class="text-center text-2xl font-bold text-sky-900">
          Kingen Score Lobby
        </h1>
        <span
          v-if="props.apiState.lobbyAdminCodeValid"
          class="rounded-full border px-1.5 py-0.5"
          :class="
            props.apiState.lobbyApiStatusLoading
              ? 'border-slate-300 bg-slate-100 text-slate-500'
              : props.apiState.lobbyApiReachable
                ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                : 'border-rose-300 bg-rose-100 text-rose-600'
          "
          role="status"
          aria-live="polite">
          <svg
            v-if="props.apiState.lobbyApiStatusLoading"
            class="h-3.5 w-3.5 animate-spin"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" />
          </svg>
          <svg
            v-else-if="props.apiState.lobbyApiReachable"
            class="h-3.5 w-3.5"
            fill="currentColor"
            viewBox="0 0 24 24"
            title="API online">
            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
          </svg>
          <svg
            v-else
            class="h-3.5 w-3.5"
            fill="currentColor"
            viewBox="0 0 24 24"
            title="API offline">
            <path d="M22.99 9C19.15 5.16 13.8 3.76 8.84 4.78L11 6.94c3.23-.35 6.57.6 9.01 3.03l1.98-1.97zM13 11.17l3.56 3.56c-.18-.2-.35-.4-.56-.56L13 11.17zM1.09 1.09 0 2.18 2.85 5c-.58.51-1.14 1.05-1.63 1.63L3.2 8.6C3.85 7.81 4.6 7.08 5.42 6.44L7.2 8.22C6.22 8.99 5.36 9.89 4.62 10.9L6.6 12.88c.98-1.29 2.19-2.36 3.54-3.16l5.85 5.85c-1.35.8-2.56 1.87-3.54 3.16l1.99 1.98C15.81 19.5 17.02 18.43 18 17.14l1.07 1.07 1.41-1.41 2.51 2.51 1.09-1.09L1.09 1.09zM12 22l3-3c-1.65-1.66-4.34-1.66-6 0l3 3z" />
          </svg>
        </span>
      </div>
        <button
          type="button"
          class="rounded border border-sky-300 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
          @click="emit('open-help-page')">
          Help & regels
        </button>
    </div>
    <p
      v-if="!props.apiState.lobbyApiBaseUrl"
      class="mt-1 break-all text-[11px] text-red-700"
    >
      API: <span class="font-mono">Geen verbinding!</span>
    </p>
    <LobbyAdminSection
      :lobby-admin-code="props.adminState.lobbyAdminCode"
      @update:lobby-admin-code="(value) => emit('update:lobbyAdminCode', value)" />

    <LobbyPlayersSection
      v-if="props.apiState.lobbyAdminCodeValid"
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
      :lobby-variant-key="props.newGameState.lobbyVariantKey"
      :lobby-variant-options="props.newGameState.lobbyVariantOptions"
      :lobby-player-count="props.newGameState.lobbyPlayerCount"
      :lobby-selected-players="props.newGameState.lobbySelectedPlayers"
      :player-name-options="props.playersState.playerNameOptions"
      :is-lobby-player-option-disabled="props.newGameState.isLobbyPlayerOptionDisabled"
      :is-player-selection-enabled="props.apiState.lobbyAdminCodeValid"
      :lobby-selection-error="props.newGameState.lobbySelectionError"
      :lobby-game-code="props.newGameState.lobbyGameCode"
      :is-start-host-disabled="props.newGameState.isStartHostDisabled"
      :lobby-host-check-loading="props.newGameState.lobbyHostCheckLoading"
      :lobby-host-locked="props.newGameState.lobbyHostLocked"
      @update:lobby-variant-key="(value) => emit('update:lobbyVariantKey', value)"
      @update:lobby-player-at="({ index, value }) => emit('update:lobbyPlayerAt', { index, value })"
      @update:lobby-game-code="(value) => emit('update:lobbyGameCode', value)"
      @start-host="emit('start-host')"
      @reset-host-session="emit('reset-host-session')"
      @force-release-host-lock="emit('force-release-host-lock')" />

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
