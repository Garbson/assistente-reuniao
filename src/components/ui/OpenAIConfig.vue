<template>
  <div v-if="!hasOpenAIConfigured" class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-gray-900">
        Configurar OpenAI Whisper
      </h3>
    </div>

    <div class="flex space-x-2">
      <input
        v-model="apiKeyInput"
        type="password"
        placeholder="API Key do OpenAI (sk-proj-...)"
        class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        :disabled="isTestingConnection"
      />
      <button
        @click="configureOpenAI"
        :disabled="!apiKeyInput.trim() || isTestingConnection"
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ isTestingConnection ? '...' : 'Salvar' }}
      </button>
    </div>

    <div v-if="connectionError" class="mt-2 text-sm text-red-600">
      {{ connectionError }}
    </div>
  </div>

</template>

<script>
export default {
  name: 'OpenAIConfig',
  props: {
    hasOpenAIConfigured: {
      type: Boolean,
      default: false
    },
    onConfigureOpenAI: {
      type: Function,
      required: true
    },
    onTestConnection: {
      type: Function,
      required: true
    }
  },
  data() {
    return {
      apiKeyInput: '',
      isTestingConnection: false,
      connectionError: null
    }
  },
  methods: {
    async configureOpenAI() {
      if (!this.apiKeyInput.trim()) return;

      this.isTestingConnection = true;
      this.connectionError = null;

      try {
        // Testa a conexão primeiro
        const isValid = await this.onTestConnection(
          this.apiKeyInput.trim(),
          null
        );

        if (isValid) {
          // Se válida, configura
          const success = this.onConfigureOpenAI(
            this.apiKeyInput.trim(),
            null
          );
          if (success) {
            this.apiKeyInput = '';
            this.$emit('configured');
          }
        } else {
          this.connectionError = 'API key inválida ou sem acesso';
        }
      } catch (error) {
        this.connectionError = `Erro: ${error.message}`;
      } finally {
        this.isTestingConnection = false;
      }
    },

    resetOpenAI() {
      this.onConfigureOpenAI('', null);
      this.apiKeyInput = '';
      this.connectionError = null;
      this.$emit('reset');
    }
  }
}
</script>