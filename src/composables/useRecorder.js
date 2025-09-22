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
  const audioCaptureType = ref('unknown'); // 'system', 'microfone', 'hybrid', 'unknown'
  const isCapturingFullMeeting = ref(false); // true se capturando áudio de todos
  const audioSources = ref([]); // fontes disponíveis

  // Detalhes específicos da captura
  const isCapturingInput = ref(false); // microfone/entrada
  const isCapturingOutput = ref(false); // sistema/saída
  const audioQuality = ref({ input: 0, output: 0 }); // níveis de áudio detectados
  const detectedMeetingApp = ref(''); // Teams, Meet, Zoom detectado


  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let removeElectronListener = null;
  // Configurações de API - Whisper como prioridade
  const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  let OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
  let OPENAI_ORG_ID = localStorage.getItem('openai_org_id') || null;

  let openaiTranscription = null;
  let audioAnalyzer = null;
  let analysisInterval = null;

  const checkSupport = () => {
    isSupported.value = !!(navigator.mediaDevices && window.MediaRecorder);
    if (!isSupported.value) error.value = 'Captura de áudio não suportada neste ambiente.';
    return isSupported.value;
  };

  // Função SEGURA para analisar qualidade do áudio em tempo real
  const analyzeAudioStream = (stream) => {
    // DESABILITADO TEMPORARIAMENTE para evitar crashes
    console.log('🔊 Análise de áudio DESABILITADA (evitando crashes)');
    return;

  };

  // Função para parar análise
  const stopAudioAnalysis = () => {
    if (analysisInterval) {
      clearInterval(analysisInterval);
      analysisInterval = null;
    }
    if (audioAnalyzer) {
      audioAnalyzer.audioContext.close();
      audioAnalyzer = null;
    }
  };

  // Função para detectar aplicativo de reunião ativo
  const detectMeetingApp = async () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    // Detecta por URL (quando executado em browser)
    if (currentUrl.includes('teams.microsoft.com') || currentUrl.includes('teams.live.com')) {
      detectedMeetingApp.value = 'Microsoft Teams';
      return 'teams';
    } else if (currentUrl.includes('meet.google.com')) {
      detectedMeetingApp.value = 'Google Meet';
      return 'meet';
    } else if (currentUrl.includes('zoom.us')) {
      detectedMeetingApp.value = 'Zoom';
      return 'zoom';
    }

    // Detecta por título da janela (quando executado em Electron)
    if (window.electronAPI && window.electronAPI.getMeetingDebug) {
      try {
        const debug = await window.electronAPI.getMeetingDebug();
        const title = debug.lastMeetingTitle?.toLowerCase() || '';

        if (title.includes('teams') || title.includes('microsoft teams')) {
          detectedMeetingApp.value = 'Microsoft Teams';
          return 'teams';
        } else if (title.includes('meet') || title.includes('google meet')) {
          detectedMeetingApp.value = 'Google Meet';
          return 'meet';
        } else if (title.includes('zoom')) {
          detectedMeetingApp.value = 'Zoom';
          return 'zoom';
        }
      } catch (error) {
        console.warn('Falha ao detectar app de reunião:', error);
      }
    }

    return 'unknown';
  };

  // Variáveis para streams separados (como Notion)
  let microphoneStream = null;
  let systemAudioStream = null;
  let audioContext = null;

  const startRecording = async () => {
    if (!checkSupport() || isRecording.value) return;
    console.log('🎬 Iniciando captura: system(loopback) + microfone');
    try {
      // Captura do sistema (mantém lógica atual funcionando) – prioriza handler loopback do preload
      let systemStream = null;
      if (window.electronAPI?.captureSystemAudio) {
        try {
          const s = await window.electronAPI.captureSystemAudio();
          if (s && typeof s.getAudioTracks === 'function' && s.getAudioTracks().length) {
            systemStream = s;
            console.log('🖥️ Loopback OK:', s.getAudioTracks()[0].label);
          }
        } catch (e) {
          console.warn('⚠️ loopback falhou:', e.message);
        }
      }
      // Tentativa 1: somente áudio (ideal para handler)
      if (!systemStream) {
        try {
          console.log('🧪 Tentativa 1: getDisplayMedia({audio:true, video:false})');
          const pureAudio = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false });
          if (pureAudio.getAudioTracks().length) {
            systemStream = pureAudio;
            console.log('�️ System audio (pure) OK:', systemStream.getAudioTracks()[0].label);
          } else {
            pureAudio.getTracks().forEach(t => t.stop());
          }
        } catch (e) {
          console.warn('⚠️ Tentativa 1 falhou:', e.message);
        }
      }
      if (!systemStream) {
        console.log('�🔄 Fallback loopback via getDisplayMedia...');
        try {
          const fallback = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          fallback.getVideoTracks().forEach(t => { t.stop(); fallback.removeTrack(t); });
          if (fallback.getAudioTracks().length) {
            systemStream = fallback;
            console.log('🖥️ Fallback system OK:', systemStream.getAudioTracks()[0].label);
          }
        } catch (e) {
          console.warn('⚠️ getDisplayMedia sem system audio:', e.message);
        }
      }
      if (!systemStream) {
        console.warn('❌ Nenhum áudio do sistema obtido após todas as tentativas. Prosseguindo só com microfone.');
      }

      // Captura microfone
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('🎤 Microfone OK:', microphoneStream.getAudioTracks()[0]?.label);
        isCapturingInput.value = true;
      } catch (e) {
        console.warn('⚠️ Microfone indisponível:', e.message);
        microphoneStream = null;
      }

      if (systemStream) {
        systemAudioStream = systemStream;
        isCapturingOutput.value = true;
        // Heurística: alguns ambientes retornam track do próprio mic como "default" / "communications" quando loopback falha
        const label = systemStream.getAudioTracks()[0]?.label?.toLowerCase() || '';
        if (label && (label.includes('microphone') || label.includes('mic') || label.includes('input'))) {
          console.warn('⚠️ A track de "system" parece ser microfone (label heurística).');
        }
      }

      if (!systemAudioStream && !microphoneStream) {
        error.value = 'Nenhuma fonte de áudio disponível';
        return;
      }

      let finalStream;
      if (systemAudioStream && microphoneStream) {
        audioCaptureType.value = 'hybrid';
        isCapturingFullMeeting.value = true;
        finalStream = await mixStreamsHybrid(microphoneStream, systemAudioStream);
        console.log('✅ Híbrido ativo (mix system + mic)');
      } else if (systemAudioStream) {
        audioCaptureType.value = 'system';
        isCapturingFullMeeting.value = true;
        finalStream = systemAudioStream;
        console.log('🎧 Apenas system audio');
      } else {
        audioCaptureType.value = 'microphone';
        isCapturingFullMeeting.value = false;
        finalStream = microphoneStream;
        console.log('🎤 Apenas microfone');
      }

      await setupRecording(finalStream);
    } catch (e) {
      console.error('❌ Erro na captura combinada:', e);
      await cleanupStreams();
      throw e;
    }
  };

  // Função para limpar recursos
  const cleanupStreams = async () => {
    console.log('🧹 Limpando streams...');

    stopAudioAnalysis();

    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      microphoneStream = null;
    }

    if (systemAudioStream) {
      systemAudioStream.getTracks().forEach(track => track.stop());
      systemAudioStream = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
      audioContext = null;
    }

    resetCaptureState();
  };

  // Mixagem híbrida (microfone + sistema) com Web Audio
  const mixStreamsHybrid = async (micStream, sysStream) => {
    try {
      if (!micStream || !sysStream) return micStream || sysStream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('⚠️ AudioContext indisponível, usando fallback simples.');
        // Fallback: junta tracks em novo MediaStream (se suportado)
        const merged = new MediaStream();
        micStream.getAudioTracks().forEach(t => merged.addTrack(t));
        sysStream.getAudioTracks().forEach(t => merged.addTrack(t));
        return merged;
      }

      audioContext = new AudioContextClass({ latencyHint: 'interactive' });
      const destination = audioContext.createMediaStreamDestination();

      const micSource = audioContext.createMediaStreamSource(micStream);
      const sysSource = audioContext.createMediaStreamSource(sysStream);

      // Ganhos equilibrados (sistema normalmente já vem mais alto)
      const micGain = audioContext.createGain();
      const sysGain = audioContext.createGain();
      micGain.gain.value = 1.2; // Leve boost no microfone
      sysGain.gain.value = 0.9; // Leve redução no sistema

      micSource.connect(micGain).connect(destination);
      sysSource.connect(sysGain).connect(destination);

      console.log('🔗 Mixagem híbrida criada (mic + system)');
      return destination.stream;
    } catch (e) {
      console.error('❌ Falha na mixagem híbrida:', e.message);
      // Fallback: retorna system se existir, senão mic
      return sysStream || micStream;
    }
  };

  // Função simplificada para configurar MediaRecorder (método Notion)
  const setupRecording = async (stream) => {
    try {
      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error('Stream de áudio inválido');
      }

      console.log('🎬 Configurando gravação (tipo:', audioCaptureType.value, ')...');

      // MIME type simples e compatível
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // MediaRecorder SIMPLES como Notion
      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000  // Qualidade padrão
      });

      // Reset estado
      audioChunks = [];
      transcript.value = '';
      audioBlob.value = null;
      hasAudio.value = false;
      error.value = null;
      startTime = new Date();

      // Event handlers SIMPLES
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Finalizando gravação...');

        if (audioChunks.length > 0) {
          audioBlob.value = new Blob(audioChunks, { type: mimeType });
          hasAudio.value = true;
          console.log(`✅ Gravação finalizada: ${(audioBlob.value.size / 1024 / 1024).toFixed(2)}MB`);
        }

        isRecording.value = false;
        stopAudioAnalysis();

        // Parar stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (e) => {
        console.error('❌ Erro na gravação:', e.error);
        error.value = `Erro na gravação: ${e.error?.message || 'Desconhecido'}`;
        isRecording.value = false;
      };

      // Iniciar gravação (método Notion)
      mediaRecorder.start(1000); // Chunks de 1 segundo
      isRecording.value = true;

      console.log('✅ Gravação iniciada com sucesso (método Notion)!');

    } catch (setupError) {
      console.error('❌ Erro ao configurar gravação:', setupError.message);
      error.value = `Erro ao configurar gravação: ${setupError.message}`;
      isRecording.value = false;
      throw setupError;
    }
  };

  const stopRecording = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    await cleanupStreams();
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
      let previousContext = ''; // Para manter contexto entre chunks

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
                contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: chunk.type || 'audio/webm', data: base64Audio } }] }],
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

        console.log(`📦 Chunk ${i + 1}: ${startTimeSeconds.toFixed(1)}-${endTimeSeconds.toFixed(1)}s (${(chunkBlob.size / 1024 / 1024).toFixed(1)}MB)`);
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

        console.log(`📦 Chunk ${i + 1}: ${(startTime / 1000 / 60).toFixed(1)}-${(endTime / 1000 / 60).toFixed(1)} min (${(chunkBlob.size / 1024 / 1024).toFixed(1)}MB)`);
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

      const prompt = `Você receberá a transcrição de uma reunião corporativa. Produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.\n\nOBJETIVO: Gerar um RESUMO ESTRUTURADO com título inteligente e pontos principais organizados de forma direta e prática.\n\nREGRAS:\n1. titulo_reuniao: Crie um título descritivo e inteligente baseado no contexto da reunião (ex: "Mentoria de Desenvolvimento de Carreira", "Planejamento Sprint Q4", etc.)\n2. contexto_e_objetivo: Breve contexto da reunião e objetivo principal (1-2 frases).\n3. participantes: Array com TODOS os nomes mencionados na reunião. Se não houver nomes específicos, usar ["Participantes não identificados"].\n4. pontos_principais: Array de objetos com os tópicos específicos discutidos. QUEBRE EM SUBTÓPICOS MENORES E ESPECÍFICOS. Cada objeto deve ter:\n   - "subtitulo": nome/título específico do subtópico (ex: "Melhorar tela de login", "Código único de oferta", "Problema com autenticação", "Configurar servidor de desenvolvimento")\n   - "pontos_abordados": array com 2-4 pontos específicos do que foi falado sobre esse subtópico (ex: ["jesiel falou para mudar as cores do fundo", "ajustar as bordas para ficar mais arredondadas"])\n5. action_items: TODAS as ações mencionadas. Formato: { "descricao": "ação específica", "responsavel": "nome ou 'A definir'", "prazo": "prazo mencionado ou 'Não definido'", "concluida": false }\n6. decisoes_tomadas: Array com decisões concretas tomadas durante a reunião.\n7. proximos_passos: Próximas etapas estratégicas mencionadas.\n\nIMPORTANTE: Para os pontos_principais, QUEBRE EM MUITOS SUBTÓPICOS ESPECÍFICOS ao invés de poucos tópicos grandes. Cada subtópico deve ter entre 2-4 pontos abordados. Seja específico e direto. Capture exatamente o que foi dito, incluindo quem falou o quê. Use linguagem natural e direta.\n\nEXEMPLO CORRETO de pontos_principais (muitos subtópicos específicos):\n[\n  {\n    "subtitulo": "Cores da tela de login",\n    "pontos_abordados": [\n      "jesiel falou para mudar as cores do fundo",\n      "usar tons mais escuros"\n    ]\n  },\n  {\n    "subtitulo": "Bordas dos elementos",\n    "pontos_abordados": [\n      "ajustar as bordas para ficar mais arredondadas",\n      "aplicar border-radius de 8px"\n    ]\n  },\n  {\n    "subtitulo": "Tipografia dos botões",\n    "pontos_abordados": [\n      "revisar tipografia dos botões",\n      "usar fonte maior para melhor legibilidade"\n    ]\n  },\n  {\n    "subtitulo": "Localização do código único",\n    "pontos_abordados": [\n      "está presente no book",\n      "seguindo a documentação o código único já vem do book porém precisa achar ele"\n    ]\n  },\n  {\n    "subtitulo": "Verificação com backend",\n    "pontos_abordados": [\n      "verificar com o time de backend onde está localizado",\n      "agendar reunião para entender a estrutura"\n    ]\n  }\n]\n\nNÃO FAÇA subtópicos muito grandes com muitos pontos. PREFIRA vários subtópicos específicos e menores.\n\nFORMATO EXATO DO RETORNO (JSON ÚNICO):\n{\n  "titulo_reuniao": "...",\n  "contexto_e_objetivo": "...",\n  "participantes": ["..."],\n  "pontos_principais": [\n    {\n      "subtitulo": "...",\n      "pontos_abordados": ["...", "...", "..."]\n    }\n  ],\n  "action_items": [{"descricao": "...", "responsavel": "...", "prazo": "...", "concluida": false}],\n  "decisoes_tomadas": ["..."],\n  "proximos_passos": ["..."],\n  "formato_estruturado": true\n}\n\nTranscrição da reunião:\n${transcript.value}\n\nRetorne somente o JSON completo e detalhado no formato estruturado.`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 8000 }
        })
      });
      if (!resp.ok) throw new Error('Erro da API: ' + await resp.text());
      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      console.log('🔍 Resposta bruta da IA (nova gravação):', raw);

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON não encontrado na resposta da IA.');
      const parsed = JSON.parse(match[0]);
      console.log('📋 JSON parsed (nova gravação):', parsed);

      // Suporte para formato estruturado (novo) e formato antigo (compatibilidade)
      if (parsed.formato_estruturado) {
        return {
          titulo_reuniao: parsed.titulo_reuniao || 'Reunião',
          contexto_e_objetivo: parsed.contexto_e_objetivo || '',
          participantes: parsed.participantes || ['Participantes não identificados'],
          pontos_principais: parsed.pontos_principais || [],
          action_items: parsed.action_items || [],
          decisoes_tomadas: parsed.decisoes_tomadas || [],
          proximos_passos: parsed.proximos_passos || [],
          data_reuniao: new Date().toISOString(),
          duracao_minutos: Math.round(getRecordingDuration() / 60 * 10) / 10,
          fonte: 'Transcrição via Whisper + Análise via Gemini',
          formato_estruturado: true
        };
      } else {
        // Formato antigo (compatibilidade)
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
      }
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  // Nova função para regenerar resumo de reuniões existentes no formato estruturado
  const regenerateSummaryWithNewFormat = async (transcriptText, originalDuration = 0) => {
    if (!transcriptText) throw new Error('Nenhuma transcrição fornecida.');
    isProcessing.value = true;
    error.value = null;

    try {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) throw new Error('Chave da API ausente (.env).');

      const prompt = `Você receberá a transcrição de uma reunião corporativa. Produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.\n\nOBJETIVO: Gerar um RESUMO ESTRUTURADO com título inteligente e pontos principais organizados de forma direta e prática.\n\nREGRAS:\n1. titulo_reuniao: Crie um título descritivo e inteligente baseado no contexto da reunião (ex: "Mentoria de Desenvolvimento de Carreira", "Planejamento Sprint Q4", etc.)\n2. contexto_e_objetivo: Breve contexto da reunião e objetivo principal (1-2 frases).\n3. participantes: Array com TODOS os nomes mencionados na reunião. Se não houver nomes específicos, usar ["Participantes não identificados"].\n4. pontos_principais: Array de objetos com os tópicos específicos discutidos. QUEBRE EM SUBTÓPICOS MENORES E ESPECÍFICOS. Cada objeto deve ter:\n   - "subtitulo": nome/título específico do subtópico (ex: "Melhorar tela de login", "Código único de oferta", "Problema com autenticação", "Configurar servidor de desenvolvimento")\n   - "pontos_abordados": array com 2-4 pontos específicos do que foi falado sobre esse subtópico (ex: ["jesiel falou para mudar as cores do fundo", "ajustar as bordas para ficar mais arredondadas"])\n5. action_items: TODAS as ações mencionadas. Formato: { "descricao": "ação específica", "responsavel": "nome ou 'A definir'", "prazo": "prazo mencionado ou 'Não definido'", "concluida": false }\n6. decisoes_tomadas: Array com decisões concretas tomadas durante a reunião.\n7. proximos_passos: Próximas etapas estratégicas mencionadas.\n\nIMPORTANTE: Para os pontos_principais, QUEBRE EM MUITOS SUBTÓPICOS ESPECÍFICOS ao invés de poucos tópicos grandes. Cada subtópico deve ter entre 2-4 pontos abordados. Seja específico e direto. Capture exatamente o que foi dito, incluindo quem falou o quê. Use linguagem natural e direta.\n\nEXEMPLO CORRETO de pontos_principais (muitos subtópicos específicos):\n[\n  {\n    "subtitulo": "Cores da tela de login",\n    "pontos_abordados": [\n      "jesiel falou para mudar as cores do fundo",\n      "usar tons mais escuros"\n    ]\n  },\n  {\n    "subtitulo": "Bordas dos elementos",\n    "pontos_abordados": [\n      "ajustar as bordas para ficar mais arredondadas",\n      "aplicar border-radius de 8px"\n    ]\n  },\n  {\n    "subtitulo": "Tipografia dos botões",\n    "pontos_abordados": [\n      "revisar tipografia dos botões",\n      "usar fonte maior para melhor legibilidade"\n    ]\n  },\n  {\n    "subtitulo": "Localização do código único",\n    "pontos_abordados": [\n      "está presente no book",\n      "seguindo a documentação o código único já vem do book porém precisa achar ele"\n    ]\n  },\n  {\n    "subtitulo": "Verificação com backend",\n    "pontos_abordados": [\n      "verificar com o time de backend onde está localizado",\n      "agendar reunião para entender a estrutura"\n    ]\n  }\n]\n\nNÃO FAÇA subtópicos muito grandes com muitos pontos. PREFIRA vários subtópicos específicos e menores.\n\nFORMATO EXATO DO RETORNO (JSON ÚNICO):\n{\n  "titulo_reuniao": "...",\n  "contexto_e_objetivo": "...",\n  "participantes": ["..."],\n  "pontos_principais": [\n    {\n      "subtitulo": "...",\n      "pontos_abordados": ["...", "...", "..."]\n    }\n  ],\n  "action_items": [{"descricao": "...", "responsavel": "...", "prazo": "...", "concluida": false}],\n  "decisoes_tomadas": ["..."],\n  "proximos_passos": ["..."],\n  "formato_estruturado": true\n}\n\nTranscrição da reunião:\n${transcriptText}\n\nRetorne somente o JSON completo e detalhado no formato estruturado.`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 8000 }
        })
      });

      if (!resp.ok) throw new Error('Erro da API: ' + await resp.text());

      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      console.log('🔍 Resposta bruta da IA (regeneração):', raw);

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON não encontrado na resposta da IA.');
      const parsed = JSON.parse(match[0]);
      console.log('📋 JSON parsed (regeneração):', parsed);

      const result = {
        titulo_reuniao: parsed.titulo_reuniao || 'Reunião',
        contexto_e_objetivo: parsed.contexto_e_objetivo || '',
        participantes: parsed.participantes || ['Participantes não identificados'],
        pontos_principais: parsed.pontos_principais || [],
        action_items: parsed.action_items || [],
        decisoes_tomadas: parsed.decisoes_tomadas || [],
        proximos_passos: parsed.proximos_passos || [],
        data_reuniao: new Date().toISOString(),
        duracao_minutos: originalDuration,
        fonte: 'Regeneração: Transcrição via Whisper + Análise via Gemini',
        formato_estruturado: true,
        // Limpar campos do formato antigo para evitar conflitos
        pontos_discutidos: undefined,
        tarefas: undefined,
        tarefas_e_acoes: undefined,
        geral: undefined,
        observacoes: undefined
      };

      console.log('✅ Resultado final da regeneração:', result);
      return result;

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
    isCapturingInput.value = false;
    isCapturingOutput.value = false;
    audioQuality.value = { input: 0, output: 0 };
    stopAudioAnalysis();
  };

  onMounted(() => {
    checkSupport();
    setupElectronListener();
  });

  onUnmounted(async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    if (removeElectronListener) {
      removeElectronListener();
    }
    await cleanupStreams();
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
    isCapturingInput,
    isCapturingOutput,
    audioQuality,
    detectedMeetingApp,
    // Funções
    startRecording,
    stopRecording,
    clearTranscript,
    transcribeAudio,
    generateSummaryFromTranscript,
    regenerateSummaryWithNewFormat,
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
