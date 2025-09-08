<template>
  <div class="flex space-x-2">
    <ActionButton
      v-if="!isRecording"
      @click="$emit('start-recording')"
      :disabled="!isSupported || isProcessing"
      variant="primary"
    >
      <template #icon>
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </template>
      Iniciar Gravação
    </ActionButton>

    <ActionButton
      v-if="isRecording"
      @click="$emit('stop-recording')"
      variant="secondary"
    >
      <template #icon>
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
      </template>
      Parar Gravação
    </ActionButton>

    <ActionButton
      v-if="transcript && !isRecording"
      @click="$emit('clear-transcript')"
      variant="outline"
      title="Limpar transcrição"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </ActionButton>
  </div>
</template>

<script setup>
import ActionButton from '../ui/ActionButton.vue';

defineEmits(['start-recording', 'stop-recording', 'clear-transcript']);

defineProps({
  isRecording: Boolean,
  isSupported: Boolean,
  isProcessing: Boolean,
  transcript: String
});
</script>