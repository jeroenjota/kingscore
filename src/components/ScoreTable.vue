<script setup>
const props = defineProps({
  players: {
    type: Array,
    required: true,
  },
  negativeRounds: {
    type: Array,
    required: true,
  },
  positiveRounds: {
    type: Array,
    required: true,
  },
  negativeTotals: {
    type: Object,
    required: true,
  },
  positiveTotals: {
    type: Object,
    required: true,
  },
  grandTotals: {
    type: Object,
    required: true,
  },
  isEditingDisabled: {
    type: Boolean,
    default: false,
  },
  selectClass: {
    type: String,
    default: "",
  },
  isCurrentTurnPlayer: {
    type: Function,
    required: true,
  },
  isRowFull: {
    type: Function,
    required: true,
  },
  isPossibleChoiceRound: {
    type: Function,
    required: true,
  },
  rowGroupClass: {
    type: Function,
    required: true,
  },
  roundPrimaryLabelHtml: {
    type: Function,
    required: true,
  },
  isPossibleChoiceCell: {
    type: Function,
    required: true,
  },
  openCellEditor: {
    type: Function,
    required: true,
  },
  canChooseRound: {
    type: Function,
    required: true,
  },
  setChooser: {
    type: Function,
    required: true,
  },
  isCellEditing: {
    type: Function,
    required: true,
  },
  canEditRoundScores: {
    type: Function,
    required: true,
  },
  closeCellEditor: {
    type: Function,
    required: true,
  },
  updateCellCount: {
    type: Function,
    required: true,
  },
  countOptions: {
    type: Function,
    required: true,
  },
  countOptionLabel: {
    type: Function,
    required: true,
  },
  selectedPoints: {
    type: Function,
    required: true,
  },
  pointsClass: {
    type: Function,
    required: true,
  },
});
</script>

<template>
  <div class="mb-0 overflow-x-auto">
    <table class="w-full table-fixed border-separate border-spacing-0">
      <thead>
        <tr>
          <th
            class="w-18 md:w-22 sticky left-0 z-20 bg-sky-100 px-1 py-0.5 text-center text-[18px] font-bold text-sky-950 md:px-1.5 md:py-1 md:text-xs">
            Kingen
          </th>
          <th
            v-for="player in props.players"
            :key="player.id"
            class="w-16 px-1 py-1 text-left md:w-20 md:px-1.5 md:py-1.5"
            :class="
              props.isCurrentTurnPlayer(player.id) ? 'bg-amber-200' : 'bg-sky-100'
            ">
            <div class="rounded-lg border border-sky-200 bg-white px-1 py-0.5 text-center text-[13px] text-sky-950">
              {{ player.name }}
            </div>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="round in props.negativeRounds"
          :key="round.key"
          class="align-center">
          <td
            class="w-18 md:w-22 sticky left-0 z-10 border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
            :class="[
              props.isRowFull(round) ? 'bg-emerald-200' : 'bg-sky-50',
              props.isPossibleChoiceRound(round) ? 'bg-amber-100' : '',
              props.rowGroupClass(round),
            ]">
            <p
              class="text-right text-[14px] font-semibold leading-tight text-sky-950 md:text-sm"
              v-html="props.roundPrimaryLabelHtml(round)"></p>
          </td>

          <td
            v-for="player in props.players"
            :key="`${round.key}-${player.id}`"
            class="cursor-pointer border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
            :class="[
              props.isRowFull(round) ? 'bg-emerald-100' : '',
              props.isPossibleChoiceCell(round, player.id)
                ? 'bg-amber-50 ring-1 ring-inset ring-amber-300'
                : '',
              props.rowGroupClass(round),
            ]"
            @click="props.openCellEditor(round, player.id)">
            <div class="flex items-center gap-1">
              <input
                type="checkbox"
                class="h-3 w-3 rounded border-sky-300 text-sky-700 focus:ring-sky-400"
                :checked="round.selections[player.id]"
                :disabled="
                  props.isEditingDisabled || props.isRowFull(round) || !props.canChooseRound(round, player.id)
                "
                :aria-label="`Gekozen door ${
                  player.name || 'speler'
                } voor ${round.name}`"
                :title="`Gekozen door ${player.name || 'speler'} voor ${
                  round.name
                }`"
                @click.stop
                @change="
                  props.setChooser(round, player.id, $event.target.checked)
                " />
              <select
                v-if="props.isCellEditing(round, player.id)"
                :value="round.counts[player.id]"
                :class="props.selectClass"
                :disabled="!props.canEditRoundScores(round)"
                @click.stop
                @blur="props.closeCellEditor"
                @change="
                  props.updateCellCount(round, player.id, $event.target.value)
                ">
                <option
                  v-for="count in props.countOptions(round, player.id)"
                  :key="`${round.key}-${player.id}-neg-${count}`"
                  :value="count">
                  {{ props.countOptionLabel(round, count) }}
                </option>
              </select>
              <p
                v-else
                class="min-h-3 flex-1 text-right text-[14px] font-semibold text-sky-900">
                {{ props.selectedPoints(round, player.id) }}
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <th
            class="w-18 md:w-22 sticky left-0 z-10 border-b-2 border-sky-300 bg-sky-100/70 px-1 py-0.5 text-right text-[12px] text-red-700 md:px-1.5 md:py-1 md:text-xs">
            Totaal Negatief
          </th>
          <th
            v-for="player in props.players"
            :key="`negative-subtotal-${player.id}`"
            class="border border-b-2 border-sky-200 border-b-sky-300 bg-sky-100/70 px-1 py-1 text-right text-[14px] font-bold md:px-1.5 md:py-1.5 md:text-xs"
            :class="props.pointsClass(props.negativeTotals[player.id])">
            {{ props.negativeTotals[player.id] }}
          </th>
        </tr>

        <tr
          v-for="round in props.positiveRounds"
          :key="round.key"
          class="align-center">
          <td
            class="w-18 md:w-22 sticky left-0 z-10 border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
            :class="[
              props.isRowFull(round) ? 'bg-emerald-200' : 'bg-sky-50',
              props.isPossibleChoiceRound(round) ? 'bg-amber-100' : '',
              'border-l border-r border-sky-200',
            ]">
            <p
              class="text-[14px] font-semibold leading-tight text-sky-950 md:text-base"
              v-html="props.roundPrimaryLabelHtml(round)"></p>
          </td>

          <td
            v-for="player in props.players"
            :key="`${round.key}-${player.id}`"
            class="cursor-pointer border-b border-sky-100 px-1 py-0.5 md:px-1.5 md:py-1"
            :class="[
              props.isRowFull(round) ? 'bg-emerald-100' : '',
              props.isPossibleChoiceCell(round, player.id)
                ? 'bg-amber-50 ring-1 ring-inset ring-amber-300'
                : '',
              'border-l border-r border-sky-200',
            ]"
            @click="props.openCellEditor(round, player.id)">
            <div class="flex items-center gap-1">
              <input
                type="checkbox"
                class="h-3 w-3 rounded border-sky-300 text-sky-700 focus:ring-sky-400"
                :checked="round.selections[player.id]"
                :disabled="
                  props.isEditingDisabled || props.isRowFull(round) || !props.canChooseRound(round, player.id)
                "
                :aria-label="`Gekozen door ${
                  player.name || 'speler'
                } voor ${round.name}`"
                :title="`Gekozen door ${player.name || 'speler'} voor ${
                  round.name
                }`"
                @click.stop
                @change="
                  props.setChooser(round, player.id, $event.target.checked)
                " />
              <select
                v-if="props.isCellEditing(round, player.id)"
                :value="round.counts[player.id]"
                :class="props.selectClass"
                :disabled="!props.canEditRoundScores(round)"
                @click.stop
                @blur="props.closeCellEditor"
                @change="
                  props.updateCellCount(round, player.id, $event.target.value)
                ">
                <option
                  v-for="count in props.countOptions(round, player.id)"
                  :key="`${round.key}-${player.id}-pos-${count}`"
                  :value="count">
                  {{ props.countOptionLabel(round, count) }}
                </option>
              </select>
              <p
                v-else
                class="min-h-3 flex-1 text-right text-[15px] font-semibold text-sky-900">
                {{ props.selectedPoints(round, player.id) }}
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <th
            class="w-18 md:w-22 sticky left-0 z-10 border-b-2 border-sky-300 bg-sky-100/70 px-1 py-0.5 text-right text-[12px] text-emerald-600 md:px-1.5 md:py-1 md:text-xs">
            Totaal Positief
          </th>
          <th
            v-for="player in props.players"
            :key="`positive-subtotal-${player.id}`"
            class="border border-b-2 border-sky-200 border-b-sky-300 bg-sky-100/70 px-1 py-1 text-right text-[14px] font-bold md:px-1.5 md:py-1.5 md:text-xs"
            :class="props.pointsClass(props.positiveTotals[player.id])">
            {{ props.positiveTotals[player.id] }}
          </th>
        </tr>
      </tbody>

      <tfoot>
        <tr>
          <th
            class="w-18 md:w-22 sticky left-0 z-20 border-t border-sky-300 bg-sky-100 px-1 py-0.5 text-right text-[14px] font-bold text-sky-950 md:px-1.5 md:py-1 md:text-xs">
            Totaal
          </th>
          <th
            v-for="player in props.players"
            :key="`total-${player.id}`"
            class="border border-sky-200 bg-sky-100 px-1 py-1 text-right text-[14px] font-bold md:px-1.5 md:py-1.5 md:text-xs"
            :class="props.pointsClass(props.grandTotals[player.id])">
            {{ props.grandTotals[player.id] }}
          </th>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
