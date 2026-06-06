<script setup>
const props = defineProps({
  resultsModalOpen: {
    type: Boolean,
    default: false,
  },
  isGameFinished: {
    type: Boolean,
    default: false,
  },
  resultsStandings: {
    type: Array,
    required: true,
  },
  pointsClass: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["close"]);
</script>

<template>
  <div
    v-if="props.resultsModalOpen && props.isGameFinished"
    class="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/60 px-4"
    @click.self="emit('close')">
    <div class="w-full max-w-2xl rounded-xl border border-sky-200 bg-white p-4 shadow-xl">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-sky-900">Uitslag</p>
          <p class="text-xs text-sky-700">Totaalstand van het gespeelde spel.</p>
        </div>
        <button
          type="button"
          class="rounded border border-sky-300 bg-white px-2 py-0.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
          @click="emit('close')">
          Sluiten
        </button>
      </div>

      <div class="overflow-hidden rounded-lg border border-sky-200">
        <table class="w-full border-separate border-spacing-0">
          <thead>
            <tr class="bg-sky-100 text-left text-xs font-semibold text-sky-900">
              <th class="px-3 py-2">#</th>
              <th class="px-3 py-2">Speler</th>
              <th class="px-3 py-2 text-right">Negatief</th>
              <th class="px-3 py-2 text-right">Positief</th>
              <th class="px-3 py-2 text-right">Totaal</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, index) in props.resultsStandings"
              :key="entry.id"
              class="border-t border-sky-100 text-sm text-sky-950">
              <td class="px-3 py-2 font-semibold text-sky-700">{{ index + 1 }}</td>
              <td class="px-3 py-2 font-semibold">{{ entry.name }}</td>
              <td class="px-3 py-2 text-right">{{ entry.negative }}</td>
              <td class="px-3 py-2 text-right">{{ entry.positive }}</td>
              <td class="px-3 py-2 text-right font-bold" :class="props.pointsClass(entry.total)">{{ entry.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
