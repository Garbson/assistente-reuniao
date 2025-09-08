<template>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
    <h3 class="text-lg font-medium text-blue-900 mb-4">
      Dicas para uma boa gravação
    </h3>
    <ul class="space-y-2 text-sm text-blue-800">
      <li v-for="tip in tips" :key="tip" class="flex items-start">
        <svg
          class="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        {{ tip }}
      </li>
    </ul>
  </div>
</template>

<script setup>
const tips = [
  'Fale de forma clara e pausada',
  'Mantenha-se próximo ao microfone',
  'Evite ruídos de fundo',
  'A transcrição será gerada automaticamente após parar a gravação',
  'O sistema processa automaticamente reuniões longas dividindo em partes menores'
];
</script>