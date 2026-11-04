# Arquitetura

O Rakestra App utiliza React Native, Expo e TypeScript. Serviços do cliente ligam a interface à API em Node.js/Next.js; o MongoDB persiste os registros. O desenho abaixo é uma visão lógica, sem declarar a topologia ou a capacidade de produção.

```mermaid
flowchart LR
    A[Aplicativo mobile] -->|HTTP e identidade da sessão| B[API e regras]
    B -->|Consulta e persistência| C[(MongoDB)]
    A --> D[Localização e mídia do dispositivo]
    B --> E[Serviços de comunicação e integrações]
```

![Responsabilidades do sistema](../../media/architecture.svg)

## Limites e referências

- O aplicativo mantém navegação e estado de apresentação. A política de acesso a uma operação também precisa existir no servidor.
- Atleta, grupo, clube, partida, reserva e torneio são contextos relacionados. O perfil não substitui um vínculo com um grupo, e um convite não equivale a uma partida realizada.
- Algumas operações se conectam ao Rakestra Gestão. A apresentação deste repositório acompanha o aplicativo; a implementação do sistema de gestão tem escopo próprio.
- Os módulos publicados em src não incluem a comunicação com APIs, o banco ou as dependências de React Native. Sua execução permite verificar funções selecionadas.

## Conexão do convite

```mermaid
sequenceDiagram
    participant A as Aplicativo
    participant S as Servidor
    participant D as Persistência
    A->>A: Preservar identificação e conteúdo da tentativa
    A->>S: Enviar proposta com a mesma identificação
    S->>D: Registrar partida, comprovante e convites na transação
    D-->>S: Registro concluído
    S-->>A: Retornar comprovante e proposta
    Note over A,S: Se a resposta se perder, consultar antes de repetir
    A->>S: Consultar comprovante da tentativa
    S-->>A: Registrado ou não encontrado
```

Este fluxo documenta o mecanismo encontrado no código. Os testes desta edição verificam contratos e identidade; a transação completa depende de seu próprio ambiente de integração.
