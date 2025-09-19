<template>
  <div
    :class="[
      'inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
      indicatorClasses
    ]"
  >
    <div class="flex items-center space-x-2">
      <!-- Ícone -->
      <div :class="iconClasses">
        <svg
          v-if="captureType === 'system' || captureType === 'notion'"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <svg
          v-else-if="captureType === 'microphone'"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 1v6m0 0V1m0 6v6m0 0v6"/>
        </svg>
        <svg
          v-else
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>

      <!-- Texto -->
      <div>
        <div class="font-medium">{{ title }}</div>
        <div v-if="subtitle" class="text-xs opacity-75">{{ subtitle }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  captureType: {
    type: String,
    required: true,
    validator: (value) => ['system', 'microphone', 'hybrid', 'notion', 'unknown'].includes(value)
  },
  isCapturingFullMeeting: {
    type: Boolean,
    default: false
  },
  sourceCount: {
    type: Number,
    default: 0
  },
  isCapturingInput: {
    type: Boolean,
    default: false
  },
  isCapturingOutput: {
    type: Boolean,
    default: false
  },
  audioQuality: {
    type: Object,
    default: () => ({ input: 0, output: 0 })
  }
});

const indicatorClasses = computed(() => {
  switch (props.captureType) {
    case 'system':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'notion':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'hybrid':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'microphone':
      return 'bg-orange-100 text-orange-800 border border-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
});

const iconClasses = computed(() => {
  switch (props.captureType) {
    case 'system':
      return 'text-green-600';
    case 'notion':
      return 'text-emerald-600';
    case 'hybrid':
      return 'text-blue-600';
    case 'microphone':
      return 'text-orange-600';
    default:
      return 'text-gray-600';
  }
});

const title = computed(() => {
  const inputOutput = props.isCapturingInput && props.isCapturingOutput;

  switch (props.captureType) {
    case 'system':
      return inputOutput ? '👥🔊 Sistema + Entrada' : '👥 Sistema';
    case 'notion':
      return '🎯 Captura Completa (Notion)';
    case 'hybrid':
      return '🔄 Captura Híbrida';
    case 'microphone':
      return '🎤 Apenas Você';
    default:
      return '❓ Verificando...';
  }
});

const subtitle = computed(() => {
  const qualityInfo = props.audioQuality.input > 0 || props.audioQuality.output > 0
    ? ` (${props.audioQuality.input > 0 ? 'Entrada: ' + props.audioQuality.input + '%' : ''}${props.audioQuality.input > 0 && props.audioQuality.output > 0 ? ' | ' : ''}${props.audioQuality.output > 0 ? 'Saída: ' + props.audioQuality.output + '%' : ''})`
    : '';

  switch (props.captureType) {
    case 'system':
      return 'Capturando áudio do sistema' + qualityInfo;
    case 'notion':
      return 'Microfone + Sistema mixados' + qualityInfo;
    case 'hybrid':
      return 'Tentando captura de sistema' + qualityInfo;
    case 'microphone':
      return 'Capturando apenas microfone' + qualityInfo;
    default:
      return 'Detectando tipo de captura';
  }
});
</script>