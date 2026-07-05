import { computed, ref, watch } from "vue";

export function useScoreRules({
  players,
  rounds,
  turnStartPlayerId,
  activeCellKey,
  isEditingDisabled,
  onBeforeScoreChange,
  onValidationError,
  maxNegativeChoices,
  maxPositiveChoices,
}) {
  function resolveChoiceLimit(limitValue, fallback) {
    const raw =
      limitValue && typeof limitValue === "object" && "value" in limitValue
        ? limitValue.value
        : limitValue;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function beforeScoreChange(reason = "") {
    if (typeof onBeforeScoreChange === "function") {
      onBeforeScoreChange(reason);
    }
  }

  function getPlayerName(playerId) {
    const player = players.value.find((candidate) => candidate.id === playerId);
    return String(player?.name || "Speler");
  }

  function reportValidationError(message) {
    if (typeof onValidationError === "function") {
      onValidationError(message);
    }
  }

  function getRoundChooserId(round) {
    return (
      players.value.find((player) => round.selections[player.id])?.id ?? null
    );
  }

  function chosenRoundCount() {
    return rounds.value.reduce(
      (sum, round) => sum + (getRoundChooserId(round) ? 1 : 0),
      0,
    );
  }

  function getNextChooserId() {
    if (!turnStartPlayerId.value) {
      return null;
    }

    const startIndex = players.value.findIndex(
      (player) => player.id === turnStartPlayerId.value,
    );
    if (startIndex < 0) {
      return null;
    }

    return players.value[(startIndex + chosenRoundCount()) % players.value.length]
      .id;
  }

  const chooserStats = computed(() => {
    return Object.fromEntries(
      players.value.map((player) => {
        let negativeChosen = 0;
        let positiveChosen = 0;

        for (const round of rounds.value) {
          if (!round.selections[player.id]) {
            continue;
          }

          if (round.kind === "negatief") {
            negativeChosen += 1;
          } else {
            positiveChosen += 1;
          }
        }

        return [
          player.id,
          {
            negativeChosen,
            positiveChosen,
            totalChosen: negativeChosen + positiveChosen,
          },
        ];
      }),
    );
  });

  const currentTurnPlayerId = computed(() => {
    const chosenCount = chosenRoundCount();
    if (chosenCount === 0 || chosenCount >= rounds.value.length) {
      return null;
    }

    const allChosenRoundsFullyScored = rounds.value
      .filter((round) => chosenBySomeone(round))
      .every((round) => isRowFull(round));

    if (!allChosenRoundsFullyScored) {
      return null;
    }

    return getNextChooserId();
  });

  function isCurrentTurnPlayer(playerId) {
    return currentTurnPlayerId.value === playerId;
  }

  function isPossibleChoiceRound(round) {
    const turnPlayerId = currentTurnPlayerId.value;
    if (!turnPlayerId || chosenBySomeone(round)) {
      return false;
    }

    return canChooseRound(round, turnPlayerId);
  }

  function isPossibleChoiceCell(round, playerId) {
    return isCurrentTurnPlayer(playerId) && isPossibleChoiceRound(round);
  }

  function canChooseRound(round, playerId) {
    if (!isRoundEditable(round)) {
      return false;
    }

    if (round.selections[playerId]) {
      return true;
    }

    const allChosenRoundsFullyScored = rounds.value
      .filter((candidate) => chosenBySomeone(candidate))
      .every((candidate) => isRowFull(candidate));

    if (!allChosenRoundsFullyScored) {
      return false;
    }

    const stats = chooserStats.value[playerId];
    const negativeLimit = resolveChoiceLimit(maxNegativeChoices, 0);
    const positiveLimit = resolveChoiceLimit(maxPositiveChoices, 0);
    if (
      round.kind === "negatief" &&
      stats.negativeChosen >= negativeLimit
    ) {
      return false;
    }

    if (
      round.kind === "positief" &&
      stats.positiveChosen >= positiveLimit
    ) {
      return false;
    }

    const nextChooserId = getNextChooserId();
    if (nextChooserId && nextChooserId !== playerId) {
      return false;
    }

    return true;
  }

  function setChooser(round, playerId, checked) {
    if (isEditingDisabled.value || isRowFull(round)) {
      return;
    }

    if (!checked) {
      if (!round.selections[playerId]) {
        return;
      }

      beforeScoreChange(`Keuze verwijderd: ${getPlayerName(playerId)} bij ${round.name}`);
      round.selections[playerId] = false;

      if (chosenRoundCount() === 0) {
        turnStartPlayerId.value = null;
      }

      return;
    }

    if (!canChooseRound(round, playerId)) {
      return;
    }

    const previousChooserId = getRoundChooserId(round);
    if (previousChooserId === playerId) {
      return;
    }

    beforeScoreChange(`Kiezer gezet: ${getPlayerName(playerId)} bij ${round.name}`);

    if (!turnStartPlayerId.value) {
      turnStartPlayerId.value = playerId;
    }

    for (const player of players.value) {
      round.selections[player.id] = player.id === playerId;
    }
  }

  function cellPoints(round, playerId) {
    return Number(round.counts[playerId] || 0) * round.pointsPerUnit;
  }

  function chosenBySomeone(round) {
    return !!getRoundChooserId(round);
  }

  function roundTotalCount(round) {
    return players.value.reduce(
      (sum, player) => sum + Number(round.counts[player.id] || 0),
      0,
    );
  }

  function remainingForPlayer(round, playerId) {
    const currentValue = Number(round.counts[playerId] || 0);
    const totalWithoutCurrent = roundTotalCount(round) - currentValue;
    return Math.max(0, round.maxUnits - totalWithoutCurrent);
  }

  function canEditRoundScores(round) {
    return isRoundEditable(round) && chosenBySomeone(round);
  }

  function normalizeCount(round, playerId, rawValue) {
    if (isEditingDisabled.value || !canEditRoundScores(round)) {
      return;
    }

    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      reportValidationError("Score moet een geldig getal zijn.");
      return;
    }

    const integerValue = Math.floor(numeric);
    if (integerValue < 0) {
      reportValidationError("Score mag niet negatief zijn.");
    }

    const safeValue = Math.max(0, integerValue);
    const maxForCell = remainingForPlayer(round, playerId);
    if (safeValue > maxForCell) {
      reportValidationError(
        `Te hoog: maximaal ${maxForCell} ${round.unit || "items"} voor deze speler in deze ronde.`,
      );
    }

    const nextValue = Math.min(safeValue, maxForCell);

    if (nextValue === Number(round.counts[playerId] || 0)) {
      return;
    }

    beforeScoreChange(`Score aangepast: ${getPlayerName(playerId)} bij ${round.name}`);
    round.counts[playerId] = nextValue;
  }

  function cellKey(round, playerId) {
    return `${round.key}::${playerId}`;
  }

  function isCellEditing(round, playerId) {
    return activeCellKey.value === cellKey(round, playerId);
  }

  function openCellEditor(round, playerId) {
    if (isEditingDisabled.value || !canEditRoundScores(round)) {
      return;
    }

    activeCellKey.value = cellKey(round, playerId);
  }

  function closeCellEditor() {
    activeCellKey.value = null;
  }

  function updateCellCount(round, playerId, rawValue) {
    normalizeCount(round, playerId, rawValue);
    closeCellEditor();
  }

  function selectedPoints(round, playerId) {
    const count = Number(round.counts[playerId] || 0);
    if (count <= 0) {
      return 0;
    }

    return Math.abs(cellPoints(round, playerId));
  }

  function countOptions(round, playerId) {
    const maxForCell = remainingForPlayer(round, playerId);
    return Array.from({ length: maxForCell + 1 }, (_, index) => index);
  }

  function countOptionLabel(round, count) {
    const points = Math.abs(count * round.pointsPerUnit);
    return `${count}: ${points}`;
  }

  const negativeRounds = computed(() =>
    rounds.value.filter((round) => round.kind === "negatief"),
  );
  const positiveRounds = computed(() =>
    rounds.value.filter((round) => round.kind === "positief"),
  );

  function isRoundPlayed(round) {
    return roundTotalCount(round) > 0 || chosenBySomeone(round);
  }

  function isNegativeSecondRound(round) {
    return round.kind === "negatief" && round.key.endsWith("-2");
  }

  function canPlayNegativeSecondRound(round) {
    if (!isNegativeSecondRound(round)) {
      return true;
    }

    const firstRoundKey = round.key.replace("-2", "-1");
    const firstRound = negativeRounds.value.find(
      (candidate) => candidate.key === firstRoundKey,
    );
    return firstRound ? isRoundPlayed(firstRound) : true;
  }

  function canPlayPositiveRound(round) {
    if (round.kind !== "positief") {
      return true;
    }

    const positiveIndex = positiveRounds.value.findIndex(
      (candidate) => candidate.key === round.key,
    );
    if (positiveIndex <= 0) {
      return true;
    }

    const previousPositiveRound = positiveRounds.value[positiveIndex - 1];
    return previousPositiveRound ? isRoundPlayed(previousPositiveRound) : true;
  }

  function isRoundEditable(round) {
    if (round.kind === "negatief") {
      return canPlayNegativeSecondRound(round);
    }

    return canPlayPositiveRound(round);
  }

  function isRowFull(round) {
    return roundTotalCount(round) >= round.maxUnits;
  }

  function isGroupStart(round) {
    return round.kind === "positief" || round.key.endsWith("-1");
  }

  function isGroupEnd(round) {
    return round.kind === "positief" || round.key.endsWith("-2");
  }

  function rowGroupClass(round) {
    const classes = ["border-l border-r border-sky-200"];

    if (isGroupStart(round)) {
      classes.push("border-t border-t-sky-300");
    }

    if (isGroupEnd(round)) {
      classes.push("border-b border-b-sky-300");
    }

    return classes.join(" ");
  }

  function roundPrimaryLabel(round) {
    if (round.kind === "negatief" && round.key.endsWith("-1")) {
      return `${round.name}`;
    }

    if (round.kind === "negatief" && round.key.endsWith("-2")) {
      return `${round.pointsPerUnit > 0 ? "+" : ""}(${round.pointsPerUnit} pnt)`;
    }

    if (round.kind === "positief") {
      const troefNumber = Number(String(round.key).replace("troef-", ""));

      if (troefNumber === 4) {
        return `Troef ${troefNumber}`;
      }

      if (troefNumber === 5) {
        return `(+50 pnt) ${troefNumber}`;
      }

      if (Number.isFinite(troefNumber) && troefNumber > 0) {
        return `${troefNumber}`;
      }
    }

    return round.name;
  }

  function roundPrimaryLabelHtml(round) {
    if (round.kind === "positief") {
      const troefNumber = Number(String(round.key).replace("troef-", ""));

      if (troefNumber === 1) {
        return `<span class="grid w-full grid-cols-[1fr_auto] items-center"><span class="text-center">Troef</span><span class="text-right">${troefNumber}</span></span>`;
      }

      if (troefNumber === 2) {
        return `<span class="grid w-full grid-cols-[1fr_auto] items-center"><span class="text-center">(+${round.pointsPerUnit}pnt)</span><span class="text-right">${troefNumber}</span></span>`;
      }

      if (Number.isFinite(troefNumber) && troefNumber > 0) {
        return `<span class="block text-right">${troefNumber}</span>`;
      }
    }

    return roundPrimaryLabel(round).replaceAll(
      "♥",
      '<span class="text-red-600">♥</span>',
    );
  }

  function totalsForRounds(roundList) {
    return Object.fromEntries(
      players.value.map((player) => {
        const total = roundList.reduce(
          (sum, round) => sum + cellPoints(round, player.id),
          0,
        );
        return [player.id, total];
      }),
    );
  }

  const negativeTotals = computed(() => totalsForRounds(negativeRounds.value));
  const positiveTotals = computed(() => totalsForRounds(positiveRounds.value));
  const grandTotals = computed(() => totalsForRounds(rounds.value));
  const isGameFinished = computed(
    () =>
      rounds.value.length > 0 &&
      rounds.value.every((round) => chosenBySomeone(round) && isRowFull(round)),
  );

  const resultsStandings = computed(() =>
    players.value
      .map((player) => ({
        id: player.id,
        name: player.name,
        negative: negativeTotals.value[player.id] || 0,
        positive: positiveTotals.value[player.id] || 0,
        total: grandTotals.value[player.id] || 0,
      }))
      .sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }

        return left.name.localeCompare(right.name, "nl");
      }),
  );

  const resultsModalOpen = ref(false);

  watch(
    isGameFinished,
    (finished, wasFinished) => {
      if (finished && !wasFinished) {
        resultsModalOpen.value = true;
      }

      if (!finished) {
        resultsModalOpen.value = false;
      }
    },
    { immediate: true },
  );

  function openResultsModal() {
    if (!isGameFinished.value) {
      return;
    }

    resultsModalOpen.value = true;
  }

  function closeResultsModal() {
    resultsModalOpen.value = false;
  }

  function pointsClass(value) {
    if (value < 0) {
      return "text-red-600";
    }

    if (value > 0) {
      return "text-emerald-700";
    }

    return "text-indigo-700";
  }

  return {
    currentTurnPlayerId,
    isCurrentTurnPlayer,
    isPossibleChoiceRound,
    isPossibleChoiceCell,
    canChooseRound,
    setChooser,
    cellPoints,
    chosenBySomeone,
    roundTotalCount,
    remainingForPlayer,
    canEditRoundScores,
    normalizeCount,
    cellKey,
    isCellEditing,
    openCellEditor,
    closeCellEditor,
    updateCellCount,
    selectedPoints,
    countOptions,
    countOptionLabel,
    negativeRounds,
    positiveRounds,
    isRoundEditable,
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
  };
}
