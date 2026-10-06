# Painel Ramal da Arena

Painel de acompanhamento das obras do Contrato 34/2025 (Ramal da Arena · Camaragibe – PE).

Site estático (HTML, CSS e JavaScript puro, sem etapa de build) com banco de dados, login e arquivos no **Supabase**. Pode ser hospedado em qualquer serviço de páginas estáticas (GitHub Pages, Netlify, Vercel, servidor próprio).

## Perfis de acesso

| Perfil | O que vê | O que faz |
|---|---|---|
| Aguardando aprovação | nada | espera o admin liberar |
| Diretoria | avanço, mapas, cronograma, fotos, conferência, projetos | só leitura |
| Equipe | tudo, inclusive pendências, NCs, lançamentos, o que falta e serviços sem avanço | lança, edita e envia fotos |
| Administrador | tudo | tudo + aprova e muda o perfil dos usuários (botão **Usuários**) |
| Bloqueado | nada | — |

O bloqueio da diretoria é feito **no banco** (Row Level Security), não só na tela.

## Estrutura

```
index.html                 página
painel.css                 visual do painel
acesso.css                 tela de entrada e usuários
config.js                  endereço e chave pública do Supabase
app.js                     login, perfis, banco, arquivos, usuários, senhas
painel.js                  o painel (mapas, diagramas, cronograma, pendências, avanço...)
supabase.js                biblioteca oficial do Supabase v2.117.2 (licença MIT)
schema.sql                 tabelas, regras de acesso e buckets do Supabase
funcao-redefinir-senha.ts  Edge Function "redefinir-senha" (botão Nova senha)
logo.png                   logotipo
```

Os dados do contrato (boletins, traçados, perfis, cronograma) **não ficam no código**: ficam no arquivo `dados.json` do bucket privado `privado` do Supabase, que só usuários aprovados conseguem ler.

## Montar do zero em outro Supabase

1. Crie o projeto no Supabase e rode `schema.sql` no SQL Editor.
2. Envie `dados.json` para o bucket `privado`.
3. Preencha `config.js` com a URL do projeto e a chave **pública** (anon/publishable). Nunca use a chave `service_role`.
4. Em Authentication > URL Configuration, coloque o endereço do site em *Site URL*.
5. Cadastre-se no site e rode no SQL Editor:
   `update public.perfis set papel = 'admin' where email = 'SEU_EMAIL';`

## Avanço e previsão de medição

Na aba **Avanço** a equipe lança a atividade principal (ex.: escavação) e o painel puxa os serviços ligados (carga, transporte, destinação, reciclagem) com as regras da memória de cálculo. Cada lançamento leva BM, período e planilha (contrato original, Aditivo 01 ou Aditivo 02). A **Visão geral** mostra a previsão do BM escolhido e a estimativa da supervisão (contrato 08/2026), calculada pelo fator em `dados.json` → `D.supervisao`.

## Atualizar o boletim (novo BM)

Edite o arquivo de dados (objeto `D`), envie com um nome novo (ex.: `dados-v3.json`) para o bucket `privado` e troque o nome em `config.js` → `dados`. O arquivo anterior fica como cópia de segurança.
