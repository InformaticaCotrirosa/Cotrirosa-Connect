# Manual de Instruções — Cotrirosa Connect

**Versão:** Agosto/2026  
**Público:** colaboradores e administradores da Cotrirosa

---

## 1. O que é o Cotrirosa Connect?

O **Cotrirosa Connect** é o sistema de **agenda corporativa** da cooperativa. Com ele você pode:

- Agendar reuniões e compromissos
- Reservar **salas de reunião** e **carros**
- Convidar colegas e acompanhar aceites
- Ver o status da sala em um tablet na porta (monitor)

O login usa as mesmas credenciais do sistema **Senior** (usuário e senha corporativos).

---

## 2. Como acessar (Login)

1. Abra o endereço do sistema no navegador.
2. Informe seu **usuário** e **senha** corporativos.
3. Clique em **Entrar**.

### Observações importantes

| Situação | O que acontece |
|---|---|
| Senha incorreta | Mensagem de erro na tela |
| Usuário desativado | Acesso bloqueado — fale com o administrador |
| Primeiro acesso | O sistema cria seu cadastro e pode pedir para completar o perfil |

Para sair, use o botão **Sair** no rodapé do menu lateral.

---

## 3. Menu principal

À esquerda da tela você encontra:

| Menu | Função |
|---|---|
| **Dashboard** | Resumo do dia, convites e atalhos |
| **Agenda** | Calendário completo (criar e editar eventos) |
| **Reuniões** | Próximas reuniões, convites e salas/carros |
| **Equipe** | Lista de colaboradores |
| **Notificações** | Avisos do sistema (com badge de não lidas) |
| **Configurações** | Perfil, expediente e (admin) usuários |

Você pode recolher o menu pelo botão de seta na borda da barra lateral.

---

## 4. Dashboard

O Dashboard mostra um panorama rápido:

- **Eventos de hoje** — seus compromissos do dia
- **Convites pendentes de aceite** — reuniões aguardando sua resposta
- **Eventos futuros** — próximos compromissos
- **Atalhos** — Novo Evento, Minha Agenda, Agenda Completa, Ver Equipe

### Aceitar ou recusar um convite

1. No bloco de convites pendentes, localize a reunião.
2. Clique em **Aceitar** ou **Recusar**.
3. A agenda e as notificações são atualizadas automaticamente.

---

## 5. Agenda

Caminho: menu **Agenda**.

### 5.1 Visualizações

No canto superior direito (ou próximo ao título), escolha:

- **Dia** — grade horária do dia (estilo Outlook, com linha do horário atual)
- **Semana** — visão semanal
- **Mês** — calendário mensal
- **Lista** — eventos em lista

Use **Hoje** para voltar à data atual e as setas **‹ ›** para navegar.

Dicas:

- No **mês**, clique em um dia para abrir a visão **Dia**.
- No **dia** ou **semana**, clique em um horário vazio para criar um evento naquele horário.

### 5.2 Filtros

À esquerda do botão **Hoje**:

| Filtro | Resultado |
|---|---|
| **Todos** | Todos os eventos |
| **Salas** | Somente eventos em salas de reunião |
| **Carros** | Somente eventos em carros |

O atalho **Minha Agenda** (pelo Dashboard) mostra só eventos em que você participa. Para limpar, clique no **X** do chip “Minha Agenda”.

### 5.3 Criar um evento

1. Clique em **Novo Evento** (ou em um horário na grade).
2. Preencha:
   - Título
   - Data/hora de início e fim (ou dia inteiro)
   - Tipo do evento (ex.: reunião, interno)
   - **Sala ou carro** (obrigatório para reserva)
   - Participantes (colegas convidados)
   - Descrição e prioridade (opcional)
3. Se for recorrente, ative **Evento recorrente** e escolha a frequência (diário, semanal, quinzenal, mensal ou anual). O sistema mostra quantas ocorrências serão criadas até o fim do ano.
4. Salve.

O sistema **impede o salvamento** se houver:

- Sala/carro já ocupado no horário
- Conflito na agenda de um participante
- Horário fora do **expediente** configurado de alguém

Nesses casos, use a opção de **Sugestão** de horário, quando disponível, para encontrar um slot compatível.

### 5.4 Editar ou excluir

- Somente o **organizador** do evento ou um **administrador** pode editar/excluir.
- Os demais veem o evento em modo leitura.
- Em eventos recorrentes, o sistema pergunta se a alteração vale só para aquela ocorrência ou para as futuras.

### 5.5 Eventos lado a lado

Quando dois ou mais eventos coincidem no mesmo horário (ex.: salas diferentes), na visão **Dia** e **Semana** eles aparecem **um ao lado do outro**, sem sobreposição.

---

## 6. Reuniões

Caminho: menu **Reuniões**.

Abas principais:

| Aba | Conteúdo |
|---|---|
| **Próximas** | Reuniões futuras |
| **Convites** | Convites pendentes para você responder |
| **Salas** | Cadastro e lista de salas/carros |
| **Anteriores** | Histórico de reuniões passadas |

### 6.1 Gerenciar salas e carros (administrador)

Na aba **Salas**, o administrador pode:

1. Clicar para **criar** ou **editar** um recurso.
2. Preencher:
   - Nome
   - **Tipo:** Sala de reunião ou Carro
   - Unidade
   - Capacidade
   - Recursos (ex.: projetor, TV)
   - Cor (identificação visual na agenda)
   - **Ativa / Inativa**
3. Salvar.

**Sala ou carro inativo** não aparece para novos agendamentos.

É possível **reordenar** a lista arrastando os itens (quando disponível).

### 6.2 Monitor da sala (tablet)

Para exibir o status na porta da sala:

1. Em **Reuniões → Salas**, localize a sala.
2. Use o ícone de **monitor** / abrir em nova aba.
3. A URL fica no formato: `/monitor/{id-da-sala}`.

Essa tela é **tela cheia** (sem menu lateral) e mostra:

- Se a sala está **LIVRE** ou ocupada
- Título da reunião atual, organizador e horários
- Contagem regressiva e cores conforme o tempo restante
- Próximo evento agendado

A tela atualiza sozinha (em tempo real e a cada poucos segundos).

---

## 7. Equipe

Caminho: menu **Equipe**.

- Lista colaboradores com busca por nome.
- Filtros por unidade e perfil, quando disponíveis.
- Exibe status de presença (disponível, ocupado, ausente etc.), cargo e unidade.

Use essa tela para localizar colegas antes de convidá-los a uma reunião.

---

## 8. Notificações

Caminho: menu **Notificações**.

- Lista avisos de convites, alterações de reunião e outros eventos do sistema.
- O número no menu indica **não lidas**.
- Clique em uma notificação para marcá-la como lida; há opção de marcar todas.

Quando alguém te convida para uma reunião, você recebe notificação (e pode ver o convite também no Dashboard e em Reuniões).

---

## 9. Configurações

Caminho: menu **Configurações**.

### 9.1 Perfil (todos os usuários)

Atualize:

- Nome completo
- Cargo
- Telefone
- Unidade
- Status de presença
- Assinatura de e-mail (se aplicável)

### 9.2 Expediente

Defina os horários em que você pode ser agendado.  
O sistema usa esse expediente para **bloquear** ou **sugerir** horários compatíveis com todos os participantes.

### 9.3 Preferências de notificação

Área reservada para preferências futuras; hoje as notificações padrão do sistema são enviadas normalmente.

### 9.4 Usuários (somente administrador)

Na aba de usuários, o administrador pode:

- Ver a lista (filtros: Todos / Ativos / Inativos)
- Alterar o perfil: **Administrador** ou **Usuário**
- **Ativar** ou **Desativar** uma conta

**Usuário desativado:**

- Não consegue fazer login
- Não deve ser convidado para novas reuniões

---

## 10. Papéis: Usuário × Administrador

| Ação | Usuário | Administrador |
|---|:---:|:---:|
| Criar eventos e convidar pessoas | ✓ | ✓ |
| Editar/excluir próprios eventos | ✓ | ✓ |
| Editar/excluir eventos de outros | | ✓ |
| Ver salas e carros | ✓ | ✓ |
| Criar/editar/excluir salas e carros | | ✓ |
| Ativar/desativar salas | | ✓ |
| Gerenciar usuários (ativar/desativar) | | ✓ |
| Usar monitor de sala | ✓ | ✓ |

---

## 11. Boas práticas

1. Sempre reserve a **sala ou o carro** no evento — isso evita conflito de uso.
2. Mantenha seu **expediente** atualizado em Configurações.
3. Responda convites pendentes no Dashboard para a agenda ficar correta.
4. Em reuniões recorrentes, confira se a alteração deve valer só para um dia ou para a série.
5. Desative salas/carros fora de uso em vez de excluí-los, se ainda houver histórico.
6. No tablet da sala, deixe a página do **monitor** aberta em tela cheia.

---

## 12. Problemas frequentes

| Problema | O que verificar |
|---|---|
| Não consigo entrar | Usuário/senha Senior; conta desativada; sistema/backend no ar |
| Não aparece a sala no agendamento | Sala está **inativa**? |
| Não consigo salvar o evento | Conflito de sala, participante ou fora do expediente |
| Evento não aparece na agenda | Filtro **Salas/Carros/Minha Agenda** ativo? Data correta? |
| Convite não chegou | Pessoa desativada? Nome selecionado como participante? |
| Monitor não atualiza | Conexão de rede do tablet; recarregar a página |

Se o problema persistir, contate a **equipe de TI / Informática Cotrirosa**.

---

## 13. Glossário rápido

| Termo | Significado |
|---|---|
| **Organizadora/Organizadora** | Pessoa que criou o evento |
| **Participante** | Pessoa convidada |
| **Recurso** | Sala de reunião ou carro reservável |
| **Recorrência** | Evento que se repete (semanal, mensal etc.) |
| **Monitor** | Tela para tablet na porta da sala |
| **Expediente** | Horários em que a pessoa pode ser agendada |

---

*Documento gerado para uso interno da Cotrirosa. Em caso de dúvidas sobre permissões ou cadastros, procure o administrador do sistema.*
