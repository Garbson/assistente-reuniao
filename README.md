# Assistente de Reuniões IA

Um aplicativo de desktop inteligente para gravação, transcrição e resumo automático de reuniões usando Vue.js 3, Electron e IA.

## 🚀 Funcionalidades

- **Gravação em Tempo Real**: Transcrição automática usando Web Speech Recognition
- **Resumos Inteligentes**: Geração automática de resumos estruturados usando Google Gemini AI
- **Histórico Completo**: Armazenamento local com busca e organização por data
- **Gerenciamento de Tarefas**: Identificação automática de tarefas e responsáveis
- **Detecção Automática**: Monitora janelas de reunião (Google Meet, Teams, Zoom)
- **Notificações Inteligentes**: Alerta quando uma reunião é detectada
- **Exportação**: Baixe resumos em PDF ou transcrições em TXT
- **Interface Moderna**: Design limpo inspirado no Notion com Tailwind CSS

## 🛠️ Tecnologias

- **Frontend**: Vue.js 3 (Composition API), Tailwind CSS
- **Desktop**: Electron
- **IA**: Google Gemini API
- **Armazenamento**: LocalStorage
- **Build**: Vite

## ⚙️ Configuração

### Pré-requisitos

- Node.js (^20.19.0 || >=22.12.0)
- npm ou yarn
- Chave da API do Google Gemini

### Instalação

1. **Clone o repositório**

```sh
git clone <repository-url>
cd assistente-reuniao
```

2. **Instale as dependências**

```sh
npm install
```

3. **Configure a API do Google Gemini**

   a. Copie o arquivo de exemplo:

   ```sh
   cp .env.example .env
   ```

   b. Obtenha uma chave da API:

   - Acesse [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Crie um novo projeto ou use um existente
   - Gere uma nova chave da API

   c. Edite o arquivo `.env` e adicione sua chave:

   ```env
   VITE_GOOGLE_API_KEY=sua_chave_da_api_aqui
   ```

## 🏃‍♂️ Como Usar

### Desenvolvimento

```sh
# Servidor de desenvolvimento (apenas web)
npm run dev

# Desenvolvimento com Electron
npm run electron-dev
```

### Produção

```sh
# Build para web
npm run build

# Build para Electron
npm run build-electron

# Gerar executáveis
npm run dist
```

### Usando o Aplicativo

1. **Inicie uma Nova Reunião**

   - Clique em "Nova Reunião" ou use o botão "+"
   - Permita acesso ao microfone quando solicitado

2. **Grave sua Reunião**

   - Clique em "Iniciar Gravação"
   - Fale normalmente - a transcrição aparecerá em tempo real
   - Clique em "Parar Gravação" quando terminar

3. **Gere um Resumo**

   - Clique em "Gerar Resumo com IA"
   - Aguarde o processamento (alguns segundos)
   - Revise o resumo estruturado gerado

4. **Gerencie suas Reuniões**
   - Visualize o histórico na barra lateral
   - Clique em qualquer reunião para ver detalhes
   - Marque tarefas como concluídas
   - Exporte resumos ou transcrições

## 🔧 Estrutura do Projeto

```
src/
├── components/           # Componentes Vue
│   ├── Sidebar.vue      # Histórico de reuniões
│   ├── RecorderView.vue # Interface de gravação
│   └── SummaryView.vue  # Visualização de resumos
├── composables/         # Lógica reutilizável
│   ├── useRecorder.js   # Gravação e transcrição
│   ├── useHistory.js    # Gerenciamento de histórico
│   └── useConfig.js     # Configurações da API
├── assets/             # Recursos estáticos
└── App.vue            # Componente principal

electron.cjs           # Processo principal do Electron
preload.cjs           # Script de pré-carregamento
```

## 🎯 Funcionalidades Avançadas

### Detecção Automática de Reuniões

O aplicativo monitora continuamente as janelas ativas e detecta quando você inicia uma reunião em:

- Google Meet
- Microsoft Teams
- Zoom
- Skype
- Discord
- WebEx

Quando detectado, uma notificação aparece oferecendo para iniciar a gravação automaticamente.

### Resumos Estruturados

A IA gera resumos organizados contendo:

- **Resumo Geral**: Visão executiva da reunião
- **Pontos Discutidos**: Lista dos principais tópicos
- **Tarefas e Ações**: Identificação automática de tarefas com responsáveis

### Exportação

- **PDF**: Resumo completo formatado
- **TXT**: Transcrição simples
- **JSON**: Dados estruturados para integração

## 🔒 Privacidade e Segurança

- **Dados Locais**: Todas as transcrições ficam armazenadas localmente
- **API Segura**: Comunicação criptografada com Google Gemini
- **Sem Telemetria**: Nenhum dado é enviado para terceiros além da API de IA

## 🐛 Solução de Problemas

### Reconhecimento de Voz Não Funciona

- Verifique se está usando Google Chrome
- Confirme as permissões de microfone
- Teste em uma página HTTPS

### Erro na API do Google

- Verifique se a chave está correta no arquivo `.env`
- Confirme se a API está habilitada no Google Cloud Console
- Verifique sua cota de uso

### Aplicação Não Inicia

- Confirme que todas as dependências foram instaladas
- Verifique a versão do Node.js
- Tente excluir `node_modules` e reinstalar

## 📝 Scripts Disponíveis

```sh
npm run dev           # Desenvolvimento web
npm run build         # Build web
npm run preview       # Preview da build
npm run electron      # Executar Electron
npm run electron-dev  # Desenvolvimento Electron
npm run build-electron # Build Electron
npm run dist          # Gerar executáveis
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

Se você encontrar problemas ou tiver dúvidas:

1. Verifique a seção de [Solução de Problemas](#-solução-de-problemas)
2. Consulte as [Issues existentes](../../issues)
3. Abra uma [Nova Issue](../../issues/new) se necessário

---

**Desenvolvido com ❤️ usando Vue.js 3, Electron e IA**
