import { computed, ref } from 'vue';

export function useConfig() {
  // Configurações reativas
  const config = ref({
    googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
    appName: import.meta.env.VITE_APP_NAME || 'Assistente de Reuniões IA',
    appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
    apiTimeout: 30000, // 30 segundos
    maxRetries: 3
  });

  // Computed
  const isApiConfigured = computed(() => {
    return !!config.value.googleApiKey;
  });

  const apiStatus = computed(() => {
    if (!config.value.googleApiKey) {
      return {
        status: 'error',
        message: 'Chave da API não configurada'
      };
    }

    if (config.value.googleApiKey.length < 30) {
      return {
        status: 'warning',
        message: 'Chave da API pode estar inválida'
      };
    }

    return {
      status: 'success',
      message: 'API configurada corretamente'
    };
  });

  // Métodos
  const updateApiKey = (newKey) => {
    config.value.googleApiKey = newKey;
    // Em um ambiente real, isso salvaria nas configurações persistentes
    localStorage.setItem('assistente-reuniao-api-key', newKey);
  };

  const loadSavedConfig = () => {
    try {
      const savedKey = localStorage.getItem('assistente-reuniao-api-key');
      if (savedKey && !config.value.googleApiKey) {
        config.value.googleApiKey = savedKey;
      }
    } catch (error) {
      console.warn('Erro ao carregar configurações salvas:', error);
    }
  };

  const validateApiKey = async (apiKey = config.value.googleApiKey) => {
    if (!apiKey) {
      throw new Error('Chave da API não fornecida');
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.status === 403) {
        throw new Error('Chave da API inválida ou sem permissões');
      }

      if (!response.ok) {
        throw new Error(`Erro ao validar API: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Erro na validação da API:', error);
      throw error;
    }
  };

  const getApiEndpoint = (model = 'gemini-pro') => {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.value.googleApiKey}`;
  };

  const createApiRequest = (prompt, options = {}) => {
    const defaultOptions = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    };

    return {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        ...defaultOptions,
        ...options
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };
  };

  // Inicializar configurações
  loadSavedConfig();

  return {
    // Estado
    config,

    // Computed
    isApiConfigured,
    apiStatus,

    // Métodos
    updateApiKey,
    loadSavedConfig,
    validateApiKey,
    getApiEndpoint,
    createApiRequest
  };
}
