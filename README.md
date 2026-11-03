# Corretor EMFAL

Página do app de correção de provas por foto da Escola Municipal Francisca Alves (EMFAL).

A tela fica aqui (GitHub Pages). Os dados (turmas, provas, notas e professores) ficam na planilha da escola no Google Drive, acessada pelo Apps Script com login por usuário e senha.

## Conta EMFAL (vale para todos os apps)

O arquivo `conta-emfal.js` é carregado por todos os apps da EMFAL (Prova Online, Ocorrências, Relatórios, Currículo e Substituição). Por ele, em qualquer app:

- o professor cria a senha no primeiro acesso e troca a senha quando quiser;
- a coordenação cadastra professores, define as turmas de cada um, gera senha provisória e desativa ou reativa contas.

Tudo é gravado na mesma lista de usuários do Corretor EMFAL, então o usuário e a senha continuam iguais em todos os apps.
