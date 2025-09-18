// OpenAI Whisper API integration
export class OpenAITranscription {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.openai.com/v1';
    this.organizationId = null;
    this.isInitialized = false;
  }

  async initialize(apiKey, organizationId = null) {
    if (!apiKey) {
      throw new Error('OpenAI API key é necessária');
    }

    this.apiKey = apiKey;
    this.organizationId = organizationId;

    try {
      console.log('🔑 Testando OpenAI API Key:', apiKey.substring(0, 20) + '...');
      console.log('🏢 Organization ID:', organizationId);

      // Testa a conexão com um ping simples
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      console.log('📡 Testando conexão com OpenAI...');
      const testResponse = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers
      });

      console.log('📊 Status da resposta:', testResponse.status);

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('❌ Erro na resposta:', errorText);
        throw new Error(`Falha na autenticação OpenAI: ${testResponse.status} - ${errorText}`);
      }

      const models = await testResponse.json();
      console.log('✅ Modelos disponíveis:', models.data?.length || 0);

      this.isInitialized = true;
      console.log('✅ OpenAI Whisper inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar OpenAI:', error);
      throw new Error(`Falha na inicialização OpenAI: ${error.message}`);
    }
  }

  async transcribe(audioBlob, options = {}) {
    if (!this.isInitialized) {
      throw new Error('OpenAI não está inicializado. Chame initialize() primeiro.');
    }

    const {
      model = 'whisper-1',
      language = 'pt',
      temperature = 0.0,
      response_format = 'json',
      prompt = null
    } = options;

    try {
      const fileSizeMB = audioBlob.size / (1024 * 1024);
      console.log(`🎤 Enviando para OpenAI Whisper: ${fileSizeMB.toFixed(1)}MB`);
      console.log(`🔧 Modelo: ${model}`);

      // Valida tamanho do arquivo (OpenAI permite até 25MB)
      if (fileSizeMB > 25) {
        throw new Error('Arquivo muito grande (máx: 25MB)');
      }

      // Prepara FormData para upload
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', model);
      formData.append('language', language);
      formData.append('temperature', temperature.toString());
      formData.append('response_format', response_format);

      if (prompt) {
        formData.append('prompt', prompt);
      }

      // Prepara headers
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      // Faz a chamada para API
      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers,
        body: formData
      });

      console.log('📊 Status da transcrição:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro OpenAI:', errorText);

        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
          console.error('📋 Detalhes do erro:', parsedError);
        } catch (e) {
          console.error('📋 Erro (texto):', errorText);
        }

        // Tratamento de erros específicos
        if (response.status === 401) {
          throw new Error('API key OpenAI inválida ou expirada');
        } else if (response.status === 413) {
          throw new Error('Arquivo muito grande (máx: 25MB)');
        } else if (response.status === 429) {
          throw new Error('Limite de rate excedido. Tente novamente em alguns minutos.');
        } else if (parsedError?.error?.code === 'insufficient_quota') {
          throw new Error('Cota insuficiente. Verifique seu plano e billing na OpenAI.');
        } else {
          throw new Error(`Erro OpenAI: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();

      if (!result.text || !result.text.trim()) {
        throw new Error('Transcrição vazia retornada pelo OpenAI');
      }

      console.log('✅ Transcrição OpenAI concluída');
      console.log(`📝 Tamanho da transcrição: ${result.text.length} caracteres`);

      return result.text.trim();

    } catch (error) {
      console.error('❌ Erro na transcrição OpenAI:', error);
      throw error;
    }
  }

  // Método para listar modelos disponíveis
  async getAvailableModels() {
    if (!this.isInitialized) {
      throw new Error('OpenAI não está inicializado');
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar modelos: ${response.status}`);
      }

      const result = await response.json();
      const whisperModels = result.data.filter(model =>
        model.id.includes('whisper')
      );

      return whisperModels.map(model => ({
        id: model.id,
        name: model.id,
        description: `Modelo ${model.id}`
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar modelos:', error);
      return [
        { id: 'whisper-1', name: 'Whisper-1', description: 'Modelo padrão OpenAI Whisper' }
      ];
    }
  }

  // Verifica se a API key está funcionando
  async testConnection() {
    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Estima custo da transcrição
  estimateCost(audioDurationMinutes, model = 'whisper-1') {
    // OpenAI Whisper custa $0.006 por minuto
    const ratePerMinute = 0.006;
    const cost = ratePerMinute * audioDurationMinutes;

    return {
      model,
      durationMinutes: audioDurationMinutes,
      durationHours: (audioDurationMinutes / 60).toFixed(2),
      costUSD: cost.toFixed(4),
      costBRL: (cost * 5.5).toFixed(2) // Estimativa USD->BRL
    };
  }
}