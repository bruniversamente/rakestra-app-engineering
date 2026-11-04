# Acesso condicionado ao armazenamento protegido

No aplicativo nativo, a política publicada utiliza um adaptador de armazenamento protegido. Ela distingue indisponibilidade, falha e limite de espera da leitura. O caminho web é explícito e separado.

Os testes existentes do produto usam adaptadores controlados para conferir gravação, migração de uma sessão antiga, falhas de leitura, timeout e saída. O pacote mantém esses testes, ajustando apenas o caminho de importação para execução no Node.

O resultado verifica a política em isolamento. Ele não comprova o comportamento do armazenamento de um aparelho específico, a autenticação da API ou a segurança geral do produto.
