# Conferir um envio antes de repeti-lo

## Problema

A interrupção de conexão pode ocorrer antes do registro de uma proposta ou depois dele, quando a resposta não chega ao celular. O aplicativo precisa conservar a tentativa original e consultar o que aconteceu antes de oferecer outro envio.

## Decisão presente na implementação

O cliente guarda a identificação e o conteúdo da tentativa. O servidor vincula o comprovante ao autor e ao pedido. A consulta de recuperação não cria uma partida. Quando o usuário revisa e reenvia, o código reutiliza a tentativa original.

## Consequência

Um novo pedido com outra identificação poderia produzir outro efeito. A identificação preservada e a verificação do comprovante permitem tratar a resposta perdida. Um erro de rede isolado não é prova de ausência de registro.

## Material desta edição

- src/matchProposalData.ts valida os dados da proposta e a leitura da resposta.
- src/matchCreationData.ts fornece a impressão do conteúdo e a leitura do comprovante.
- tests/contracts.test.ts verifica a autoria, a consistência e o vínculo do comprovante.

A lógica de persistência da tentativa, a rota de recuperação e a transação da API são documentadas, mas não estão executáveis neste recorte. Os testes deste pacote não simulam uma prova ponta a ponta dessas camadas.

## Verificação adicional do fluxo original

A execução de `scripts/match-proposal-creation.test.cjs` nos arquivos originais do produto passou em **15 testes** em 04/11/2026. A suíte utiliza API e armazenamento controlados para provocar resposta perdida, reinício do módulo, concorrência e troca de conta. O [registro TAP](../../evidence/original-proposal-flow.tap) conserva os cenários e resultados. Essa execução é separada dos 17 testes reproduzíveis deste pacote e não comprova a transação do banco nem o percurso no aparelho.
