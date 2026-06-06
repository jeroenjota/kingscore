<script setup>
const props = defineProps({
  isViewerMode: {
    type: Boolean,
    default: false,
  },
  showViewerQrCode: {
    type: Boolean,
    default: false,
  },
  viewerQrCodeDataUrl: {
    type: String,
    default: "",
  },
  shareViewerUrl: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["close"]);
</script>

<template>
  <div
    v-if="!props.isViewerMode && props.showViewerQrCode && props.viewerQrCodeDataUrl"
    class="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/60 px-4"
    @click.self="emit('close')">
    <div
      class="w-full max-w-sm rounded-xl border border-sky-200 bg-white p-4 shadow-xl">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-sky-900">
            Meeleeslink QR-code
          </p>
          <p class="text-xs text-sky-700">
            Scan met je telefoon om direct mee te kijken.
          </p>
        </div>
        <button
          type="button"
          class="rounded border border-sky-300 bg-white px-2 py-0.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
          @click="emit('close')">
          Sluiten
        </button>
      </div>

      <div class="flex justify-center">
        <img
          :src="props.viewerQrCodeDataUrl"
          alt="QR-code voor meeleeslink"
          class="h-64 w-64 rounded border border-sky-200 bg-white p-2" />
      </div>

      <p class="mt-3 truncate text-center text-[11px] text-sky-700">
        {{ props.shareViewerUrl }}
      </p>
    </div>
  </div>
</template>
