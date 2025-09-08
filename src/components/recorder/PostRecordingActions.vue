<template>
  <div class="bg-white border border-gray-200 rounded-lg p-6">
    <h3 class="text-lg font-medium text-gray-900 mb-4">
      Próximos Passos
    </h3>
    <div class="space-y-3">
      <ActionButton
        @click="$emit('generate-summary')"
        variant="blue"
        class="w-full justify-center py-3"
      >
        <template #icon>
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </template>
        Gerar Resumo com IA
      </ActionButton>

      <div class="grid grid-cols-2 gap-3">
        <ActionButton
          @click="$emit('download-transcript')"
          variant="outline"
        >
          <template #icon>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              />
            </svg>
          </template>
          Baixar TXT
        </ActionButton>

        <ActionButton
          @click="$emit('save-transcript')"
          variant="outline"
        >
          <template #icon>
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
          </template>
          Salvar Transcrição
        </ActionButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import ActionButton from '../ui/ActionButton.vue';

defineEmits(['generate-summary', 'download-transcript', 'save-transcript']);
</script>