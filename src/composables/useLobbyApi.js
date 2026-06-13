export function useLobbyApi({
  lobbyAdminCodeKey,
  lobbyAdminCodeTtlMs,
  state,
  normalizeGameCode,
  persistLobbyPlayers,
  showToast,
  getOrCreateHostClientId,
}) {
  let latestHostLockRequestId = 0;

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

  function clearPersistedLobbyAdminCode() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.removeItem(lobbyAdminCodeKey);
    } catch {
      // Ignore storage errors.
    }
  }

  function persistLobbyAdminCode(rawCode, updatedAt = Date.now()) {
    if (typeof window === "undefined") {
      return;
    }

    const code = String(rawCode || "").trim();
    if (!code) {
      clearPersistedLobbyAdminCode();
      return;
    }

    try {
      window.sessionStorage.setItem(
        lobbyAdminCodeKey,
        JSON.stringify({ code, updatedAt }),
      );
    } catch {
      // Ignore storage errors.
    }
  }

  function loadPersistedLobbyAdminCode() {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      const raw = window.sessionStorage.getItem(lobbyAdminCodeKey);
      const parsed = JSON.parse(raw || "{}");
      const code = String(parsed?.code || "").trim();
      const updatedAt = Number(parsed?.updatedAt || 0);
      const isFresh = Number.isFinite(updatedAt) && Date.now() - updatedAt <= lobbyAdminCodeTtlMs;

      if (!code || !isFresh) {
        clearPersistedLobbyAdminCode();
        return "";
      }

      return code;
    } catch {
      clearPersistedLobbyAdminCode();
      return "";
    }
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

      state.playerNameOptions.value = names;
      if (typeof window !== "undefined") {
        state.lobbySelectedPlayers.value = ["", "", "", ""];
      }
    } catch (error) {
      console.warn("Kon spelersnamen niet laden.", error);
    }
  }

  async function addLobbyPlayerName() {
    const name = String(state.lobbyNewPlayerName.value || "").trim();
    if (!name) {
      state.lobbyPlayerError.value = "Vul een spelernaam in.";
      state.lobbyPlayerMessage.value = "";
      return;
    }

    state.isAddingLobbyPlayer.value = true;
    state.lobbyPlayerError.value = "";
    state.lobbyPlayerMessage.value = "";

    try {
      const response = await fetch(`${syncApiBaseUrl()}/api/player-names`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (response.status === 409) {
        state.lobbyPlayerError.value = "Deze speler bestaat al.";
        return;
      }

      if (!response.ok) {
        state.lobbyPlayerError.value = "Kon speler niet toevoegen.";
        return;
      }

      state.lobbyNewPlayerName.value = "";
      state.lobbyPlayerMessage.value = "Speler toegevoegd.";
      state.lobbyDeletePlayerMessage.value = "";
      state.lobbyDeletePlayerError.value = "";
      await loadPlayerNameOptions();
      persistLobbyPlayers();
    } catch {
      state.lobbyPlayerError.value = "Kon speler niet toevoegen.";
    } finally {
      state.isAddingLobbyPlayer.value = false;
    }
  }

  async function deleteLobbyPlayerName() {
    const name = String(state.lobbyDeletePlayerName.value || "").trim();
    if (!name) {
      state.lobbyDeletePlayerError.value = "Kies een speler om te verwijderen.";
      state.lobbyDeletePlayerMessage.value = "";
      return;
    }

    const providedCode = String(state.lobbyAdminCode.value || "").trim();
    if (!providedCode) {
      state.lobbyDeletePlayerError.value = "Vul de beheerderscode in.";
      state.lobbyDeletePlayerMessage.value = "";
      return;
    }

    if (!window.confirm(`Weet je zeker dat je speler \"${name}\" wilt verwijderen?`)) {
      return;
    }

    state.isDeletingLobbyPlayer.value = true;
    state.lobbyDeletePlayerError.value = "";
    state.lobbyDeletePlayerMessage.value = "";
    state.lobbyPlayerMessage.value = "";
    state.lobbyPlayerError.value = "";

    try {
      const response = await fetch(`${syncApiBaseUrl()}/api/player-names/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: {
          "X-Admin-Code": providedCode,
        },
      });

      if (response.status === 409) {
        const payload = await response.json().catch(() => ({}));
        const gameIds = Array.isArray(payload?.gameIds) ? payload.gameIds.filter(Boolean) : [];
        state.lobbyDeletePlayerError.value = gameIds.length
          ? `Kan niet verwijderen: speler zit in bestaande spellen (${gameIds.join(", ")}).`
          : "Kan niet verwijderen: speler zit in bestaand spel.";
        return;
      }

      if (response.status === 404) {
        state.lobbyDeletePlayerError.value = "Speler bestaat niet (meer).";
        await loadPlayerNameOptions();
        return;
      }

      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        state.lobbyDeletePlayerError.value =
          String(payload?.error || "Ongeldige beheerderscode.");
        state.lobbyAdminCode.value = "";
        clearPersistedLobbyAdminCode();
        return;
      }

      if (!response.ok) {
        state.lobbyDeletePlayerError.value = "Kon speler niet verwijderen.";
        return;
      }

      state.lobbyDeletePlayerName.value = "";
      state.lobbyDeletePlayerMessage.value = "Speler verwijderd.";
      persistLobbyAdminCode(providedCode);
      await loadPlayerNameOptions();
      persistLobbyPlayers();
    } catch {
      state.lobbyDeletePlayerError.value = "Kon speler niet verwijderen.";
    } finally {
      state.isDeletingLobbyPlayer.value = false;
    }
  }

  async function loadRecentGames() {
    if (typeof window === "undefined") {
      return;
    }

    state.recentGamesLoading.value = true;
    state.recentGamesError.value = "";

    try {
      const response = await fetch(`${syncApiBaseUrl()}/api/games`, {
        cache: "no-store",
      });
      if (!response.ok) {
        state.recentGamesError.value = "Kon games niet laden.";
        state.recentGames.value = [];
        return;
      }

      const payload = await response.json();
      const items = Array.isArray(payload?.games) ? payload.games : [];

      state.recentGames.value = items
        .map((item) => ({
          gameId: normalizeGameCode(item?.gameId),
          updatedAt: Number(item?.updatedAt || 0),
          hostLocked: Boolean(item?.hostLocked),
        }))
        .filter((item) => item.gameId);
    } catch {
      state.recentGamesError.value = "Kon games niet laden.";
      state.recentGames.value = [];
    } finally {
      state.recentGamesLoading.value = false;
    }
  }

  async function refreshLobbyHostLock() {
    const normalized = normalizeGameCode(state.lobbyGameCode.value);
    const requestId = ++latestHostLockRequestId;

    if (!normalized) {
      if (requestId === latestHostLockRequestId) {
        state.lobbyHostLocked.value = false;
        state.lobbyHostCheckLoading.value = false;
      }
      return;
    }

    state.lobbyHostCheckLoading.value = true;

    try {
      const response = await fetch(
        `${syncApiBaseUrl()}/api/games/${normalized}/host-lock`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        if (requestId === latestHostLockRequestId) {
          state.lobbyHostLocked.value = false;
        }
        return;
      }

      const payload = await response.json();
      if (requestId === latestHostLockRequestId) {
        state.lobbyHostLocked.value = Boolean(payload?.hostLocked);
      }
    } catch {
      if (requestId === latestHostLockRequestId) {
        state.lobbyHostLocked.value = false;
      }
    } finally {
      if (requestId === latestHostLockRequestId) {
        state.lobbyHostCheckLoading.value = false;
      }
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

    if (!state.hostClientId.value) {
      state.hostClientId.value = getOrCreateHostClientId();
    }

    try {
      const response = await fetch(
        `${syncApiBaseUrl()}/api/games/${normalized}/host-lock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostId: state.hostClientId.value }),
        },
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  async function releaseHostLockForGame(code) {
    const normalized = normalizeGameCode(code);
    const hostId = String(state.hostClientId.value || "").trim().toLowerCase();
    if (!normalized || !hostId) {
      return false;
    }

    try {
      const response = await fetch(
        `${syncApiBaseUrl()}/api/games/${normalized}/host-lock`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostId }),
          keepalive: true,
        },
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  async function deleteSavedGame(gameCode) {
    const normalized = normalizeGameCode(gameCode);
    if (!normalized) {
      return;
    }

    const providedCode = String(state.lobbyAdminCode.value || "").trim();
    if (!providedCode) {
      showToast("Vul de beheerderscode in.");
      return;
    }

    if (!window.confirm(`Weet je zeker dat je spel \"${normalized}\" wilt verwijderen?`)) {
      return;
    }

    try {
      const response = await fetch(`${syncApiBaseUrl()}/api/games/${normalized}`, {
        method: "DELETE",
        headers: {
          "X-Admin-Code": providedCode,
        },
      });

      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        showToast(String(payload?.error || "Ongeldige beheerderscode."));
        state.lobbyAdminCode.value = "";
        clearPersistedLobbyAdminCode();
        return;
      }

      if (response.status === 409) {
        const payload = await response.json().catch(() => ({}));
        showToast(String(payload?.error || "Spel kan niet verwijderd worden zolang host actief is."));
        await loadRecentGames();
        await refreshLobbyHostLock();
        return;
      }

      if (!response.ok && response.status !== 404) {
        showToast("Verwijderen van spel mislukt.");
        return;
      }

      showToast("Spel verwijderd.");
      persistLobbyAdminCode(providedCode);
      await loadRecentGames();
      await refreshLobbyHostLock();
    } catch {
      showToast("Verwijderen van spel mislukt.");
    }
  }

  async function forceReleaseHostLock(code) {
    const normalized = normalizeGameCode(code);
    const providedCode = String(state.lobbyAdminCode.value || "").trim();

    if (!normalized || !providedCode) {
      return false;
    }

    try {
      const response = await fetch(
        `${syncApiBaseUrl()}/api/games/${normalized}/host-lock`,
        {
          method: "DELETE",
          headers: {
            "X-Admin-Code": providedCode,
          },
        },
      );

      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        showToast(String(payload?.error || "Ongeldige beheerderscode."));
        state.lobbyAdminCode.value = "";
        clearPersistedLobbyAdminCode();
        return false;
      }

      if (!response.ok) {
        showToast("Kon host lock niet forceren.");
        return false;
      }

      showToast("Host lock verwijderd.");
      persistLobbyAdminCode(providedCode);
      return true;
    } catch {
      showToast("Kon host lock niet forceren.");
      return false;
    }
  }

  return {
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
    isGameHostLocked,
    claimHostLockForGame,
    releaseHostLockForGame,
    forceReleaseHostLock,
  };
}
