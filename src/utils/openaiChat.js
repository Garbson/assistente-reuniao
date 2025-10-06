// OpenAI ChatGPT API integration para resumos de reuniões
export class OpenAIChat {
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
      console.log('🔑 Testando OpenAI ChatGPT API Key:', apiKey.substring(0, 20) + '...');
      console.log('🏢 Organization ID:', organizationId);

      // Testa a conexão com um ping simples
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      console.log('📡 Testando conexão com OpenAI ChatGPT...');
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
      console.log('✅ OpenAI ChatGPT inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar OpenAI ChatGPT:', error);
      throw new Error(`Falha na inicialização OpenAI ChatGPT: ${error.message}`);
    }
  }

  async generateSummary(transcript, options = {}) {
    if (!this.isInitialized) {
      throw new Error('OpenAI ChatGPT não está inicializado. Chame initialize() primeiro.');
    }

    if (!transcript || !transcript.trim()) {
      throw new Error('Transcrição não pode estar vazia');
    }

    const {
      model = 'gpt-3.5-turbo',
      temperature = 0.3,
      max_tokens = 4000
    } = options;

    try {
      console.log(`🤖 Gerando resumo com ChatGPT (${model})`);
      console.log(`📝 Tamanho da transcrição: ${transcript.length} caracteres`);

      const prompt = `Você receberá a transcrição de uma reunião corporativa. Produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.

OBJETIVO: Gerar um RESUMO ESTRUTURADO com título inteligente e pontos principais organizados de forma direta e prática.

REGRAS:
1. titulo_reuniao: Crie um título descritivo e inteligente baseado no contexto da reunião (ex: "Mentoria de Desenvolvimento de Carreira", "Planejamento Sprint Q4", etc.)
2. contexto_e_objetivo: Breve contexto da reunião e objetivo principal (1-2 frases).
3. participantes: Array com TODOS os nomes mencionados na reunião. Se não houver nomes específicos, usar ["Participantes não identificados"].
4. pontos_principais: Array de objetos com os tópicos específicos discutidos. QUEBRE EM SUBTÓPICOS MENORES E ESPECÍFICOS. Cada objeto deve ter:
   - "subtitulo": nome/título específico do subtópico (ex: "Melhorar tela de login", "Código único de oferta", "Problema com autenticação", "Configurar servidor de desenvolvimento")
   - "pontos_abordados": array com 2-4 pontos específicos do que foi falado sobre esse subtópico (ex: ["jesiel falou para mudar as cores do fundo", "ajustar as bordas para ficar mais arredondadas"])
5. action_items: TODAS as ações mencionadas. Formato: { "descricao": "ação específica", "responsavel": "nome ou 'A definir'", "prazo": "prazo mencionado ou 'Não definido'", "concluida": false }
6. decisoes_tomadas: Array com decisões concretas tomadas durante a reunião.
7. proximos_passos: Próximas etapas estratégicas mencionadas.

IMPORTANTE: Para os pontos_principais, QUEBRE EM MUITOS SUBTÓPICOS ESPECÍFICOS ao invés de poucos tópicos grandes. Cada subtópico deve ter entre 2-4 pontos abordados. Seja específico e direto. Capture exatamente o que foi dito, incluindo quem falou o quê. Use linguagem natural e direta.

EXEMPLO CORRETO de pontos_principais (muitos subtópicos específicos):
[
  {
    "subtitulo": "Cores da tela de login",
    "pontos_abordados": [
      "jesiel falou para mudar as cores do fundo",
      "usar tons mais escuros"
    ]
  },
  {
    "subtitulo": "Bordas dos elementos",
    "pontos_abordados": [
      "ajustar as bordas para ficar mais arredondadas",
      "aplicar border-radius de 8px"
    ]
  },
  {
    "subtitulo": "Tipografia dos botões",
    "pontos_abordados": [
      "revisar tipografia dos botões",
      "usar fonte maior para melhor legibilidade"
    ]
  },
  {
    "subtitulo": "Localização do código único",
    "pontos_abordados": [
      "está presente no book",
      "seguindo a documentação o código único já vem do book porém precisa achar ele"
    ]
  },
  {
    "subtitulo": "Verificação com backend",
    "pontos_abordados": [
      "verificar com o time de backend onde está localizado",
      "agendar reunião para entender a estrutura"
    ]
  }
]

NÃO FAÇA subtópicos muito grandes com muitos pontos. PREFIRA vários subtópicos específicos e menores.

FORMATO EXATO DO RETORNO (JSON ÚNICO):
{
  "titulo_reuniao": "...",
  "contexto_e_objetivo": "...",
  "participantes": ["..."],
  "pontos_principais": [
    {
      "subtitulo": "...",
      "pontos_abordados": ["...", "...", "..."]
    }
  ],
  "action_items": [{"descricao": "...", "responsavel": "...", "prazo": "...", "concluida": false}],
  "decisoes_tomadas": ["..."],
  "proximos_passos": ["..."],
  "formato_estruturado": true
}

Transcrição da reunião:
${transcript}

Retorne somente o JSON completo e detalhado no formato estruturado.`;

      // Prepara headers
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      // Prepara o body da requisição
      const requestBody = {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: max_tokens
      };

      // Faz a chamada para API
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log('📊 Status da geração de resumo:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro OpenAI ChatGPT:', errorText);

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
        } else if (response.status === 429) {
          throw new Error('Limite de rate excedido. Tente novamente em alguns minutos.');
        } else if (parsedError?.error?.code === 'insufficient_quota') {
          throw new Error('Cota insuficiente. Verifique seu plano e billing na OpenAI.');
        } else if (parsedError?.error?.code === 'context_length_exceeded') {
          throw new Error('Transcrição muito longa para o modelo. Tente dividir em partes menores.');
        } else {
          throw new Error(`Erro OpenAI ChatGPT: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();

      // Valida a resposta
      if (!result.choices || result.choices.length === 0) {
        throw new Error('Resposta vazia do ChatGPT');
      }

      const summaryText = result.choices[0].message.content.trim();

      if (!summaryText) {
        throw new Error('Resumo vazio retornado pelo ChatGPT');
      }

      console.log('✅ Resumo ChatGPT gerado com sucesso');
      console.log(`📝 Tamanho do resumo: ${summaryText.length} caracteres`);
      console.log(`💰 Tokens usados: ${result.usage?.total_tokens || 'N/A'}`);

      // Tenta fazer parse do JSON retornado
      try {
        const summaryJson = JSON.parse(summaryText);

        // Valida se o JSON tem a estrutura esperada
        if (!summaryJson.titulo_reuniao || !summaryJson.pontos_principais) {
          console.warn('⚠️ JSON retornado não tem a estrutura esperada, retornando como texto');
          return summaryText;
        }

        return summaryJson;
      } catch (parseError) {
        console.warn('⚠️ Não foi possível fazer parse do JSON, retornando como texto:', parseError.message);
        return summaryText;
      }

    } catch (error) {
      console.error('❌ Erro na geração de resumo ChatGPT:', error);
      throw error;
    }
  }

  // Método para listar modelos disponíveis
  async getAvailableModels() {
    if (!this.isInitialized) {
      throw new Error('OpenAI ChatGPT não está inicializado');
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
      const chatModels = result.data.filter(model =>
        model.id.includes('gpt-') && !model.id.includes('instruct')
      );

      return chatModels.map(model => ({
        id: model.id,
        name: model.id,
        description: `Modelo ${model.id}`
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar modelos:', error);
      return [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Modelo padrão OpenAI ChatGPT' },
        { id: 'gpt-4', name: 'GPT-4', description: 'Modelo avançado OpenAI ChatGPT' }
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

  // Estima custo da geração de resumo
  estimateCost(textLength, model = 'gpt-3.5-turbo') {
    // Estimativa aproximada de tokens (1 token ≈ 0.75 palavras)
    const estimatedTokens = Math.ceil(textLength / 3);

    // Preços por 1K tokens (dados de 2024)
    const modelPricing = {
      'gpt-3.5-turbo': { input: 0.0010, output: 0.0020 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 }
    };

    const pricing = modelPricing[model] || modelPricing['gpt-3.5-turbo'];

    // Estima que o resumo será ~20% do tamanho original
    const inputTokens = estimatedTokens;
    const outputTokens = Math.ceil(inputTokens * 0.2);

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    return {
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      inputCostUSD: inputCost.toFixed(4),
      outputCostUSD: outputCost.toFixed(4),
      totalCostUSD: totalCost.toFixed(4),
      totalCostBRL: (totalCost * 5.5).toFixed(2) // Estimativa USD->BRL
    };
  }
}