<script setup>
const props = defineProps({
  lobbyAdminCode: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:lobbyAdminCode"]);
</script>

<template>
  <div class="mt-2 rounded-lg border border-sky-200 bg-white/80 p-2">
    <div class="mt-1 rounded-lg border border-sky-200 bg-white/80 p-2">
      <div class="grid grid-cols-[auto_6rem_auto] items-center gap-2">
        <label class="text-sm font-semibold text-sky-900">
          Beheerderscode
        </label>
        <input
          :value="props.lobbyAdminCode"
          type="password"
          maxlength="64"
          class="h-8 w-full rounded border border-sky-300 bg-white px-2 text-sm text-sky-950 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-300/70"
          placeholder="Code"
          @input="emit('update:lobbyAdminCode', $event.target.value)" />
        <span class="text-xs text-sky-700">Voor onderhoud gegevens</span>
      </div>
    </div>
  </div>
</template>
