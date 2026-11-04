# Conferir identidade e significado na leitura

## Problema

Uma resposta pode chegar quando a tela ou a conta já mudou. Um registro também pode trazer um identificador diferente do solicitado ou dados incoerentes com o contexto esperado.

## Decisão

Os leitores publicados conferem identificadores e campos antes de aceitar os dados. A proposta sem placar utiliza um contrato separado do registro de resultado. A impressão do pedido mantém a comparação estável diante da ordem das propriedades, enquanto uma mudança de conteúdo produz outra impressão.

## Consequência

Essas conferências acrescentam uma fronteira de validação no cliente. Elas não substituem autorização no servidor. Uma regra de leitura é uma responsabilidade diferente de permitir uma alteração no banco.

## Verificação

Os testes rejeitam ator divergente, participantes repetidos, placar dentro de proposta, identidade externa de comando e comprovante de outra tentativa. Os testes de ciclo de tela do aplicativo completo têm escopo próprio.
