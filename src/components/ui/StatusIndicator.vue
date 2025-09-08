<template>
  <div class="flex items-center space-x-2">
    <div
      :class="[
        'w-3 h-3 rounded-full',
        isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300',
      ]"
    ></div>
    <span class="text-sm text-gray-600">
      {{ statusText }}
    </span>
  </div>
</template>

<script setup>
defineProps({
  isActive: {
    type: Boolean,
    default: false
  },
  statusText: {
    type: String,
    required: true
  }
});
</script>