# CLAUDE.md

Este arquivo fornece orientações para o Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Comandos de Desenvolvimento

### Desenvolvimento
```bash
npm run dev              # Servidor Vite para desenvolvimento web
npm run electron-dev     # Desenvolvimento com Electron (recomendado)
npm run electron         # Executar apenas Electron
```

### Build e Distribuição
```bash
npm run build            # Build para web
npm run build-electron   # Build com Electron
npm run dist             # Gerar executáveis para distribuição
npm run preview          # Preview da build web
```

## Arquitetura do Projeto

### Tecnologias Principais
- **Frontend**: Vue.js 3 (Composition API) + Tailwind CSS 4
- **Desktop**: Electron com processos principal/renderer separados
- **Build**: Vite com plugins específicos para Electron
- **IA**: Google Gemini API para transcrição e resumos

### Estrutura de Arquivos Críticos

#### Electron
- `electron.cjs` - Processo principal com monitoramento de reuniões
- `preload.cjs` - Script de pré-carregamento para comunicação IPC
- `vite.config.js` - Configuração Vite com plugins Electron

#### Vue Application
- `src/App.vue` - Componente raiz com gerenciamento de views (recorder/summary)
- `src/composables/` - Lógica reutilizável:
  - `useRecorder.js` - Gravação de áudio e transcrição
  - `useHistory.js` - Gerenciamento de histórico de reuniões
  - `useConfig.js` - Configurações da API

#### Componentes Organizados
- `src/components/RecorderView.vue` - Interface principal de gravação
- `src/components/recorder/` - Componentes específicos de gravação
- `src/components/ui/` - Componentes de interface reutilizáveis
- `src/components/Sidebar.vue` - Histórico e navegação
- `src/components/SummaryView.vue` - Visualização de resumos

### Funcionalidades Principais

#### Sistema de Gravação
- Web Speech Recognition para transcrição em tempo real
- Armazenamento local via localStorage
- Estados: idle → recording → processing → completed

#### Detecção Automática de Reuniões
O processo principal (`electron.cjs`) monitora continuamente:
- Janelas ativas de aplicativos de reunião (Teams, Meet, Zoom)
- Status do Microsoft Teams via registry/processos
- Exibe notificações e overlay para iniciar gravação

#### Comunicação IPC
- `start-recording` - Inicia gravação via notificação
- `get-meeting-debug` - Status do monitoramento
- `inject-meeting-data` - Injeção direta no localStorage
- `show-notification` - Notificações do sistema

### Configuração Necessária

#### Variáveis de Ambiente (.env)
```
VITE_GOOGLE_API_KEY=sua_chave_da_api_gemini
```

#### Dependências Críticas
- `active-win` - Detecção de janela ativa (opcional, com fallback)
- `@tailwindcss/vite` - Tailwind CSS 4 via Vite
- `vite-plugin-electron` - Integração Electron/Vite

### Padrões de Desenvolvimento

#### Estado Global
Utiliza Composition API com composables para gerenciamento de estado compartilhado, sem Vuex/Pinia.

#### Estrutura de Dados
Reuniões são armazenadas como objetos com:
- `id`, `title`, `timestamp`, `duration`
- `transcript` (texto completo)
- `summary` (gerado por IA)
- `tasks` (array de tarefas identificadas)

#### Permissões Electron
O processo principal configura automaticamente permissões de microfone e tratamento de mixed content para funcionar com Web Speech API.