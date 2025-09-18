import { onMounted, onUnmounted, ref } from 'vue';
import { OpenAITranscription } from '../utils/openaiTranscription.js';

// Composable OTIMIZADO: grava áudio do sistema + microfone e usa OpenAI Whisper + Gemini para transcrever e resumir
export function useRecorder() {
  const isRecording = ref(false);
  const isProcessing = ref(false);
  const transcript = ref('');
  const error = ref(null);
  const isSupported = ref(false);
  const hasAudio = ref(false);
  const audioBlob = ref(null);

  // Estado da captura de áudio
  const audioCaptureType = ref('unknown'); // 'system', 'microphone', 'unknown'
  const isCapturingFullMeeting = ref(false); // true se capturando áudio de todos
  const audioSources = ref([]); // fontes disponíveis
  

  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let removeElectronListener = null;
  // Configurações de API - Whisper como prioridade
  const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  let OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
  let OPENAI_ORG_ID = localStorage.getItem('openai_org_id') || null;

  let openaiTranscription = null;

  const checkSupport = () => {
    isSupported.value = !!(navigator.mediaDevices && window.MediaRecorder);
    if (!isSupported.value) error.value = 'Captura de áudio não suportada neste ambiente.';
    return isSupported.value;
  };

  const startRecording = async () => {
    if (!checkSupport()) return;
    if (isRecording.value) return;
    try {
      let stream = null;

      // Tenta capturar áudio do sistema primeiro (para reuniões)
      if (window.electronAPI && window.electronAPI.getDesktopCapturer && window.electronAPI.hasDesktopCapture && window.electronAPI.hasDesktopCapture()) {
        try {
          console.log('🎤 Tentando capturar áudio do sistema para reuniões...');

          // Obtém fontes de captura de tela
          const sources = await window.electronAPI.getDesktopCapturer(['screen', 'window']);
          audioSources.value = sources || [];

          if (sources && sources.length > 0) {
            // Usa a primeira fonte disponível com áudio do sistema
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: sources[0].id
                }
              },
              video: false
            });

            // Configura estado para captura do sistema
            audioCaptureType.value = 'system';
            isCapturingFullMeeting.value = true;
            console.log('✅ Captura de áudio do sistema ativada - ÁUDIO COMPLETO DA REUNIÃO');
          }
        } catch (systemError) {
          console.warn('⚠️ Falha na captura do sistema, usando microfone:', systemError.message);
        }
      } else {
        console.log('ℹ️ Desktop capture não disponível, usando apenas microfone');
      }

      // Fallback: captura apenas microfone se não conseguir áudio do sistema
      if (!stream) {
        console.log('🎤 Usando captura de microfone padrão');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100 // Alta qualidade para melhor transcrição
          }
        });

        // Configura estado para apenas microfone
        audioCaptureType.value = 'microphone';
        isCapturingFullMeeting.value = false;
        console.log('⚠️ CAPTURANDO APENAS SEU ÁUDIO - outros participantes não serão transcritos');
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg');

      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000 // Alta qualidade para melhor transcrição
      });

      audioChunks = [];
      transcript.value = '';
      audioBlob.value = null;
      hasAudio.value = false;
      error.value = null;
      startTime = new Date();

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        audioBlob.value = new Blob(audioChunks, { type: mimeType });
        hasAudio.value = true;
        isRecording.value = false;
        stream.getTracks().forEach(t => t.stop());
        // Reset do estado de captura
        resetCaptureState();
      };

      mediaRecorder.start(500);
      isRecording.value = true;

      console.log(`🔴 Gravação iniciada com ${stream.getAudioTracks()[0].label}`);

    } catch (e) {
      console.error('❌ Erro na gravação:', e);
      if (e.name === 'NotAllowedError') {
        error.value = 'Permissão de áudio negada. Para capturar reuniões, permita acesso ao áudio.';
      } else if (e.name === 'NotFoundError') {
        error.value = 'Nenhum dispositivo de áudio encontrado.';
      } else {
        error.value = `Erro ao iniciar gravação: ${e.message}`;
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  };

  const clearTranscript = () => {
    transcript.value = '';
    error.value = null;
  };

  const getRecordingDuration = () => {
    if (!startTime) return 0;
    return Math.floor((new Date() - startTime) / 1000);
  };

  const transcribeAudio = async () => {
    if (!audioBlob.value) throw new Error('Nenhum áudio disponível.');
    isProcessing.value = true;
    error.value = null;
    
    try {
      const fileSizeMB = audioBlob.value.size / (1024 * 1024);
      const durationMinutes = getRecordingDuration() / 60;
      
      console.log(`🎵 Processando áudio: ${fileSizeMB.toFixed(1)}MB, ${durationMinutes.toFixed(1)} minutos`);

      // Usa OpenAI Whisper como método principal
      if (OPENAI_API_KEY) {
        try {
          // Inicializa OpenAI se necessário
          if (!openaiTranscription) {
            openaiTranscription = new OpenAITranscription();
            await openaiTranscription.initialize(OPENAI_API_KEY, OPENAI_ORG_ID);
          }

          console.log('🚀 Usando OpenAI Whisper (oficial)');

          // Para arquivos grandes, usa chunking otimizado do Whisper
          if (fileSizeMB > 20 || durationMinutes > 25) {
            console.log('📦 Arquivo grande detectado, processando em chunks otimizados...');
            return await transcribeAudioInChunksWhisper();
          }

          // Para arquivos menores, usa método direto
          const transcriptText = await openaiTranscription.transcribe(audioBlob.value, {
            model: 'whisper-1',
            language: 'pt',
            temperature: 0.0,
            prompt: 'Esta é uma transcrição de uma reunião corporativa em português brasileiro. Incluir nomes próprios, termos técnicos e evitar palavras de preenchimento.'
          });

          transcript.value = transcriptText;
          console.log('✅ Transcrição OpenAI concluída!');
          return transcriptText;

        } catch (openaiError) {
          console.warn('⚠️ Falha no OpenAI, tentando Gemini como fallback:', openaiError.message);

          // Tratamento específico para diferentes erros de API
          if (openaiError.message.includes('quota') || openaiError.message.includes('insufficient_quota')) {
            error.value = 'Cota da API OpenAI excedida. Configure uma nova chave ou tente mais tarde.';
          } else if (openaiError.message.includes('API key')) {
            error.value = 'Chave da API OpenAI inválida. Verifique sua configuração.';
          } else if (openaiError.message.includes('rate')) {
            error.value = 'Limite de rate da OpenAI excedido. Aguarde alguns minutos.';
          }

          // Continua para Gemini como fallback
        }
      }
      
      // Fallback: Usa Gemini se Groq falhar ou não estiver configurado
      console.log('📱 Usando Gemini como fallback...');
      
      // Para arquivos muito grandes, usa chunks
      if (fileSizeMB > 10 || durationMinutes > 15) {
        console.log('📦 Arquivo grande detectado, processando em chunks...');
        return await transcribeAudioInChunks();
      }
      
      // Para arquivos menores, usa método direto com Gemini
      const base64Audio = await blobToBase64(audioBlob.value);
      const prompt = `Você receberá o áudio de uma reunião corporativa. Faça apenas a transcrição completa e fiel em português do Brasil, corrigindo erros de dicção óbvios e removendo muletas ("éé", "ahn", "tipo"). Mantenha todos os nomes citados. Retorne apenas o texto transcrito, sem formatação adicional ou comentários.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: audioBlob.value.type || 'audio/webm', data: base64Audio } }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro Gemini:', errorText);

        // Tratamento específico para erros do Gemini
        if (response.status === 400 && errorText.includes('API key not valid')) {
          throw new Error('Chave da API Google (Gemini) inválida. Verifique sua configuração no .env');
        } else if (response.status === 429) {
          throw new Error('Limite de rate do Gemini excedido. Tente novamente em alguns minutos.');
        } else if (response.status === 403) {
          throw new Error('Acesso negado à API Gemini. Verifique as permissões da sua chave.');
        } else {
          throw new Error(`Falha na transcrição Gemini: ${response.status} - ${errorText}`);
        }
      }
      
      const result = await response.json();
      const transcriptText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!transcriptText || !transcriptText.trim()) {
        throw new Error('Transcrição vazia retornada.');
      }
      
      transcript.value = transcriptText;
      console.log('✅ Transcrição Gemini concluída');
      return transcriptText;
      
    } catch (e) {
      console.error('❌ Erro na transcrição:', e);
      error.value = e.message;
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  // Nova função de chunking otimizada para Whisper
  const transcribeAudioInChunksWhisper = async () => {
    try {
      console.log('🔄 Processando áudio longo com chunks otimizados para Whisper...');

      // Chunks de 30 segundos conforme recomendação do Whisper
      const CHUNK_DURATION_SECONDS = 30;
      const OVERLAP_SECONDS = 2; // Overlap para evitar cortes no meio de palavras

      const chunks = await splitAudioIntoOptimizedChunks(audioBlob.value, CHUNK_DURATION_SECONDS, OVERLAP_SECONDS);
      console.log(`📦 Dividido em ${chunks.length} chunks de 30s com overlap`);

      let fullTranscript = '';
      const previousContext = ''; // Para manter contexto entre chunks

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkSizeMB = chunk.size / (1024 * 1024);

        console.log(`📤 Processando chunk ${i + 1}/${chunks.length} (${chunkSizeMB.toFixed(1)}MB)`);

        try {
          // Prompt contextual para manter continuidade
          const contextualPrompt = i === 0
            ? 'Esta é uma transcrição de uma reunião corporativa em português brasileiro. Incluir nomes próprios, termos técnicos e evitar palavras de preenchimento.'
            : `Continuação da reunião. Contexto anterior: "${previousContext}". Manter consistência de nomes e termos.`;

          const chunkTranscript = await openaiTranscription.transcribe(chunk, {
            model: 'whisper-1',
            language: 'pt',
            temperature: 0.0,
            prompt: contextualPrompt
          });

          // Remove overlap duplicado (primeiras palavras se é chunk > 0)
          let processedTranscript = chunkTranscript.trim();
          if (i > 0 && fullTranscript) {
            // Tenta remover sobreposição simples
            const lastWords = fullTranscript.split(' ').slice(-5).join(' ');
            const firstWords = processedTranscript.split(' ').slice(0, 5).join(' ');

            // Se há similaridade, remove as primeiras palavras do chunk atual
            if (lastWords.toLowerCase().includes(firstWords.toLowerCase().substring(0, 20))) {
              processedTranscript = processedTranscript.split(' ').slice(3).join(' ');
            }
          }

          if (fullTranscript && processedTranscript.trim()) {
            fullTranscript += ' ';
          }
          fullTranscript += processedTranscript.trim();

          // Atualiza contexto para próximo chunk (últimas palavras)
          previousContext = fullTranscript.split(' ').slice(-10).join(' ');

          // Pequena pausa para evitar rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (chunkError) {
          console.error(`❌ Erro no chunk ${i + 1}:`, chunkError);
          fullTranscript += ` [Erro na transcrição do segmento ${i + 1}] `;
        }
      }

      if (!fullTranscript.trim()) {
        throw new Error('Nenhuma transcrição foi obtida dos chunks.');
      }

      transcript.value = fullTranscript;
      console.log('✅ Transcrição em chunks finalizada');
      return fullTranscript;

    } catch (e) {
      console.error('❌ Erro ao processar áudio em chunks:', e);
      throw new Error(`Erro ao processar áudio longo: ${e.message}`);
    }
  };

  const transcribeAudioInChunks = async () => {
    const apiKey = GEMINI_API_KEY;
    const CHUNK_DURATION_MS = 10 * 60 * 1000; // 10 minutos por chunk
    
    try {
      console.log('🔄 Processando áudio longo em chunks...');
      
      const chunks = await splitAudioIntoChunks(audioBlob.value, CHUNK_DURATION_MS);
      console.log(`📦 Dividido em ${chunks.length} chunks`);
      
      let fullTranscript = '';
      const prompt = `Você receberá parte do áudio de uma reunião corporativa. Faça apenas a transcrição completa e fiel em português do Brasil, corrigindo erros de dicção óbvios e removendo muletas ("éé", "ahn", "tipo"). Mantenha todos os nomes citados. Retorne apenas o texto transcrito, sem formatação adicional ou comentários.`;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkSizeMB = chunk.size / (1024 * 1024);
        
        console.log(`📤 Processando chunk ${i + 1}/${chunks.length} (${chunkSizeMB.toFixed(1)}MB)`);
        
        try {
          let chunkTranscript = '';
          
          // Se chunk ainda é muito grande, usar Files API
          if (chunkSizeMB > 10) {
            chunkTranscript = await transcribeChunkWithFilesAPI(chunk, prompt, apiKey, i + 1);
          } else {
            // Usar método inline para chunks menores
            const base64Audio = await blobToBase64(chunk);
            
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: chunk.type || 'audio/webm', data: base64Audio } } ] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
              })
            });
            
            if (!resp.ok) {
              const errorText = await resp.text();
              console.error(`❌ Erro no chunk ${i + 1}:`, errorText);
              chunkTranscript = `[Erro na transcrição do chunk ${i + 1}]`;
            } else {
              const data = await resp.json();
              chunkTranscript = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || `[Chunk ${i + 1} vazio]`;
            }
          }
          
          if (fullTranscript && chunkTranscript.trim()) {
            fullTranscript += '\n\n';
          }
          fullTranscript += chunkTranscript.trim();
          
          // Pequena pausa para evitar rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (chunkError) {
          console.error(`❌ Erro no chunk ${i + 1}:`, chunkError);
          fullTranscript += `\n\n[Erro na transcrição do segmento ${i + 1}: ${chunkError.message}]`;
        }
      }
      
      if (!fullTranscript.trim()) {
        throw new Error('Nenhuma transcrição foi obtida dos chunks.');
      }
      
      transcript.value = fullTranscript;
      console.log('✅ Transcrição completa finalizada');
      return fullTranscript;
      
    } catch (e) {
      console.error('❌ Erro ao processar áudio em chunks:', e);
      throw new Error(`Erro ao processar áudio longo: ${e.message}`);
    }
  };

  const transcribeChunkWithFilesAPI = async (chunk, prompt, apiKey, chunkNumber) => {
    try {
      // 1. Upload do chunk
      const uploadData = new FormData();
      uploadData.append('file', chunk, `audio_chunk_${chunkNumber}.webm`);
      
      const uploadResp = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: 'POST',
        body: uploadData
      });
      
      if (!uploadResp.ok) {
        const errorText = await uploadResp.text();
        throw new Error(`Erro no upload do chunk: ${errorText}`);
      }
      
      const uploadResult = await uploadResp.json();
      const fileUri = uploadResult.file.uri;
      
      // 2. Aguardar processamento
      await waitForFileProcessing(fileUri, apiKey);
      
      // 3. Transcrever
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            parts: [
              { text: prompt }, 
              { file_data: { mime_type: chunk.type || 'audio/webm', file_uri: fileUri } }
            ] 
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
        })
      });
      
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Erro na transcrição do chunk: ${errorText}`);
      }
      
      const data = await resp.json();
      const transcriptText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      
      // 4. Limpar arquivo
      try {
        await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileUri.split('/').pop()}?key=${apiKey}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn(`⚠️ Não foi possível remover chunk temporário ${chunkNumber}:`, e);
      }
      
      return transcriptText;
      
    } catch (e) {
      throw new Error(`Erro ao processar chunk ${chunkNumber}: ${e.message}`);
    }
  };

  // Função otimizada para dividir áudio em chunks de 30s com overlap
  const splitAudioIntoOptimizedChunks = async (audioBlob, chunkDurationSeconds, overlapSeconds) => {
    const chunks = [];
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();

    try {
      // Decodifica o áudio para obter informações precisas
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());

      const totalDurationSeconds = audioBuffer.duration;
      const chunkDurationMs = chunkDurationSeconds * 1000;
      const overlapMs = overlapSeconds * 1000;
      const effectiveChunkDuration = chunkDurationSeconds - overlapSeconds;

      const numChunks = Math.ceil(totalDurationSeconds / effectiveChunkDuration);

      console.log(`🎵 Áudio total: ${(totalDurationSeconds / 60).toFixed(1)} min, dividindo em ${numChunks} chunks de ${chunkDurationSeconds}s`);

      // Calcula bytes por segundo para divisão aproximada
      const bytesPerSecond = audioBlob.size / totalDurationSeconds;

      for (let i = 0; i < numChunks; i++) {
        const startTimeSeconds = i * effectiveChunkDuration;
        const endTimeSeconds = Math.min(startTimeSeconds + chunkDurationSeconds, totalDurationSeconds);

        const startByte = Math.floor(startTimeSeconds * bytesPerSecond);
        const endByte = Math.floor(endTimeSeconds * bytesPerSecond);

        const chunkBlob = audioBlob.slice(startByte, endByte, audioBlob.type);
        chunks.push(chunkBlob);

        console.log(`📦 Chunk ${i + 1}: ${startTimeSeconds.toFixed(1)}-${endTimeSeconds.toFixed(1)}s (${(chunkBlob.size/1024/1024).toFixed(1)}MB)`);
      }

      return chunks;

    } catch (e) {
      console.error('❌ Erro ao dividir áudio em chunks otimizados:', e);
      // Fallback: usa divisão simples por tamanho
      const simpleChunkSize = Math.ceil(audioBlob.size / Math.ceil(audioBlob.size / (20 * 1024 * 1024))); // ~20MB por chunk
      const chunks = [];
      for (let i = 0; i < audioBlob.size; i += simpleChunkSize) {
        chunks.push(audioBlob.slice(i, i + simpleChunkSize, audioBlob.type));
      }
      return chunks;
    } finally {
      audioContext.close();
    }
  };

  const splitAudioIntoChunks = async (audioBlob, chunkDurationMs) => {
    const chunks = [];
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    
    try {
      // Decodifica o áudio para obter informações
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());
      
      const totalDurationMs = audioBuffer.duration * 1000;
      const numChunks = Math.ceil(totalDurationMs / chunkDurationMs);
      
      console.log(`🎵 Áudio total: ${(totalDurationMs / 1000 / 60).toFixed(1)} min, dividindo em ${numChunks} chunks`);
      
      // Para simplificar, vamos dividir o blob original por tempo estimado
      // (método aproximado mas funcional)
      const bytesPerMs = audioBlob.size / totalDurationMs;
      
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDurationMs;
        const endTime = Math.min(startTime + chunkDurationMs, totalDurationMs);
        
        const startByte = Math.floor(startTime * bytesPerMs);
        const endByte = Math.floor(endTime * bytesPerMs);
        
        const chunkBlob = audioBlob.slice(startByte, endByte, audioBlob.type);
        chunks.push(chunkBlob);
        
        console.log(`📦 Chunk ${i + 1}: ${(startTime/1000/60).toFixed(1)}-${(endTime/1000/60).toFixed(1)} min (${(chunkBlob.size/1024/1024).toFixed(1)}MB)`);
      }
      
      return chunks;
      
    } catch (e) {
      console.error('❌ Erro ao dividir áudio:', e);
      // Fallback: retorna o áudio original se falhar a divisão
      return [audioBlob];
    } finally {
      audioContext.close();
    }
  };

  const waitForFileProcessing = async (fileUri, apiKey, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileUri.split('/').pop()}?key=${apiKey}`);
      const fileData = await resp.json();
      
      if (fileData.state === 'ACTIVE') {
        console.log('✅ Arquivo processado e pronto');
        return;
      } else if (fileData.state === 'FAILED') {
        throw new Error('Falha no processamento do arquivo');
      }
      
      console.log(`⏳ Aguardando processamento... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2s
    }
    
    throw new Error('Timeout no processamento do arquivo');
  };

  const generateSummaryFromTranscript = async () => {
    if (!transcript.value) throw new Error('Nenhuma transcrição disponível.');
    isProcessing.value = true;
    error.value = null;
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) throw new Error('Chave da API ausente (.env).');
      
      const prompt = `Você receberá a transcrição de uma reunião corporativa. Produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.\n\nOBJETIVO: Gerar uma ATA DE REUNIÃO completa e detalhada com TODOS os pontos importantes discutidos.\n\nREGRAS:\n1. contexto: Breve contexto da reunião (1-2 frases sobre o propósito/tema principal).\n2. participantes: Array com TODOS os nomes mencionados na reunião. Se não houver nomes específicos, usar ["Participantes não identificados"].\n3. pontos_discutidos: TODOS os tópicos abordados na reunião, por ordem cronológica. Seja detalhado e completo. Cada item deve ser uma frase clara descrevendo o que foi discutido.\n4. decisoes_tomadas: Array com TODAS as decisões concretas tomadas durante a reunião. Se nenhuma decisão foi tomada, usar array vazio [].\n5. tarefas_e_acoes: TODAS as ações mencionadas, com responsável quando identificado. Formato: { "descricao": "ação específica", "responsavel": "nome ou 'A definir'", "prazo": "prazo mencionado ou 'Não definido'", "concluida": false }\n6. proximos_passos: Array com os próximos passos estratégicos mencionados.\n7. observacoes: Informações adicionais relevantes, dúvidas levantadas, ou pontos que ficaram pendentes.\n\nFORMATO EXATO DO RETORNO (JSON ÚNICO):\n{\n  "contexto": "...",\n  "participantes": ["..."],\n  "pontos_discutidos": ["..."],\n  "decisoes_tomadas": ["..."],\n  "tarefas_e_acoes": [{"descricao": "...", "responsavel": "...", "prazo": "...", "concluida": false}],\n  "proximos_passos": ["..."],\n  "observacoes": ["..."]\n}\n\nTranscrição da reunião:\n${transcript.value}\n\nRetorne somente o JSON completo e detalhado.`;
      
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 4000 }
        })
      });
      if (!resp.ok) throw new Error('Erro da API: ' + await resp.text());
      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON não encontrado na resposta da IA.');
      const parsed = JSON.parse(match[0]);
      
      return {
        contexto: parsed.contexto || '',
        participantes: parsed.participantes || ['Participantes não identificados'],
        pontos_discutidos: parsed.pontos_discutidos || [],
        decisoes_tomadas: parsed.decisoes_tomadas || [],
        tarefas_e_acoes: parsed.tarefas_e_acoes || [],
        proximos_passos: parsed.proximos_passos || [],
        observacoes: parsed.observacoes || [],
        data_reuniao: new Date().toISOString(),
        duracao_minutos: Math.round(getRecordingDuration() / 60 * 10) / 10,
        fonte: 'Transcrição via Whisper + Análise via Gemini'
      };
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };


  const setupElectronListener = () => {
    if (window.electronAPI && window.electronAPI.onStartRecording) {
      removeElectronListener = window.electronAPI.onStartRecording(() => {
        if (!isRecording.value) startRecording();
      });
    }
  };


  // Função para configurar a API key do OpenAI
  const setOpenAIApiKey = (apiKey, organizationId = null) => {
    if (apiKey && apiKey.trim()) {
      OPENAI_API_KEY = apiKey.trim();
      OPENAI_ORG_ID = organizationId;

      // Reset da instância para forçar reinicialização
      openaiTranscription = null;

      console.log('🔑 OpenAI API Key configurada');
      return true;
    }
    OPENAI_API_KEY = '';
    OPENAI_ORG_ID = null;
    openaiTranscription = null;
    return false;
  };

  // Função para testar conexão OpenAI
  const testOpenAIConnection = async (apiKey, organizationId = null) => {
    try {
      const testOpenAI = new OpenAITranscription();
      await testOpenAI.initialize(apiKey, organizationId);
      return await testOpenAI.testConnection();
    } catch (error) {
      console.error('❌ Teste OpenAI falhou:', error);
      return false;
    }
  };

  // Função para estimar custo (apenas OpenAI Whisper)
  const estimateTranscriptionCost = (durationMinutes) => {
    if (openaiTranscription) {
      return openaiTranscription.estimateCost(durationMinutes);
    }
    // Estimativa manual se a instância não estiver disponível
    const costUSD = durationMinutes * 0.006;
    return {
      model: 'whisper-1',
      durationMinutes,
      durationHours: (durationMinutes / 60).toFixed(2),
      costUSD: costUSD.toFixed(4),
      costBRL: (costUSD * 5.5).toFixed(2)
    };
  };

  // Função para resetar estado de captura
  const resetCaptureState = () => {
    audioCaptureType.value = 'unknown';
    isCapturingFullMeeting.value = false;
    audioSources.value = [];
  };

  onMounted(() => {
    checkSupport();
    setupElectronListener();
  });

  onUnmounted(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    if (removeElectronListener) removeElectronListener();
  });

  return {
    isRecording,
    isProcessing,
    isSupported,
    transcript,
    error,
    hasAudio,
    audioBlob,
    // Estado da captura de áudio
    audioCaptureType,
    isCapturingFullMeeting,
    audioSources,
    // Funções
    startRecording,
    stopRecording,
    clearTranscript,
    transcribeAudio,
    generateSummaryFromTranscript,
    getRecordingDuration,
    transcribeAudioInChunks,
    setOpenAIApiKey,
    testOpenAIConnection,
    estimateTranscriptionCost,
    hasOpenAIConfigured: () => !!OPENAI_API_KEY
  };
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
