# 🎯 Monitoramento de Reuniões - Implementação Refinada

## 📋 Visão Geral

Esta implementação segue exatamente as especificações fornecidas para criar um sistema robusto de detecção automática de reuniões online com notificações inteligentes.

## 🏗️ Arquitetura

### Processo Principal (`electron.cjs`)
- ✅ Monitoramento a cada **7 segundos** conforme especificado
- ✅ Análise precisa de `activeWindow.owner.name` e `activeWindow.title`
- ✅ Lógica específica por aplicativo
- ✅ Notificação "Reunião Detectada!" com botão "▶️ Iniciar Gravação"
- ✅ Evento IPC `start-recording-from-main`

### Ponte Segura (`preload.cjs`)
- ✅ `contextBridge.exposeInMainWorld` com objeto `electronAPI`
- ✅ Função `onStartRecording(callback)` que retorna cleanup
- ✅ Listener para canal `start-recording-from-main`

## 🔍 Lógica de Detecção

### 1. Microsoft Teams
```javascript
// Processo: teams.exe, ms-teams.exe, Microsoft Teams
// Título deve conter: "| Reunião", "| Chamada", "| Meeting", "| Call"
```

### 2. Zoom
```javascript
// Processo: zoom.exe, zoom
// Título deve conter: "Zoom Meeting", "Reunião Zoom", "Zoom Webinar"
```

### 3. Google Meet (Navegador)
```javascript
// Processo: chrome.exe, msedge.exe, firefox.exe, safari, opera.exe
// Título deve conter: "meet.google.com" (mas não apenas a página inicial)
```

### 4. Apps Web (Teams/Zoom)
```javascript
// Navegadores com:
// - "teams.microsoft.com" + ("call" ou "meeting")
// - "zoom.us" + "meeting"
```

## 🎬 Fluxo de Funcionamento

1. **Detecção**: Sistema monitora janela ativa a cada 7s
2. **Análise**: Aplica lógica específica por app
3. **Validação**: Verifica se reunião não foi notificada antes
4. **Notificação**: Exibe "Reunião Detectada!" com botão de ação
5. **Ação**: Usuário clica → Foca app → Envia evento IPC
6. **Interface**: Vue recebe evento e inicia gravação automaticamente

## 🔧 Como Usar

### No Componente Vue
```javascript
onMounted(() => {
  if (window.electronAPI?.onStartRecording) {
    const cleanup = window.electronAPI.onStartRecording((meetingData) => {
      console.log('Reunião detectada:', meetingData);
      // meetingData contém: { app, title, timestamp }
      
      // Iniciar gravação automaticamente
      startRecording();
    });
    
    // Limpar listener quando componente é desmontado
    onUnmounted(cleanup);
  }
});
```

### Dados do Evento
```javascript
{
  app: "Teams" | "Zoom" | "Google Meet" | "Teams Web" | "Zoom Web",
  title: "Título completo da janela",
  timestamp: "2025-08-31T10:30:00.000Z"
}
```

## 🐛 Debug em Tempo Real

A sidebar agora mostra informações detalhadas:
- **Janela Ativa**: Processo e título atual
- **Detecção**: Se detectou reunião e qual app
- **Razão**: Por que detectou ou não detectou
- **Notificações Ativas**: Quantas reuniões foram notificadas
- **Histórico**: Lista de reuniões já notificadas

## 🚀 Benefícios da Nova Implementação

### ✅ Precisão
- Lógica específica por aplicativo elimina falsos positivos
- Análise de processo + título para máxima precisão

### ✅ Performance
- Intervalo otimizado de 7 segundos
- Cleanup automático de notificações antigas (30 min)

### ✅ UX
- Notificação clara com call-to-action
- Foco automático da aplicação
- Feedback visual imediato

### ✅ Manutenibilidade
- Código modular e bem documentado
- Debug em tempo real
- Logs detalhados para troubleshooting

## 🔄 Próximos Passos

1. Teste com reuniões reais do Teams/Zoom/Meet
2. Ajuste fine-tuning se necessário
3. Adicione mais apps conforme demanda
4. Monitore logs de debug para otimizações

---

**Status**: ✅ Implementação completa conforme especificação
**Testado**: ✅ Sintaxe e estrutura
**Próximo**: 🧪 Testes com reuniões reais
