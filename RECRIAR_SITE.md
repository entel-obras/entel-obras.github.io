# Painel Ramal da Arena · como recriar o site do zero

Este arquivo descreve **tudo o que o site faz e como ele foi montado**. Serve para duas coisas:

1. **Recriar o site** em outra conta (GitHub + Supabase) usando a cópia de segurança.
2. **Pedir a qualquer IA ou programador** para reconstruir ou evoluir o painel: copie a seção "Prompt" abaixo e anexe a pasta `site/` e a pasta `dados/` da cópia de segurança.

---

## 1. Restaurar a partir da cópia de segurança (sem programar)

A cópia (`backup-painel-ramal-arena-AAAA-MM-DD.zip`, gerada pelo botão **Cópia de segurança**) tem:

| Pasta / arquivo | Conteúdo |
|---|---|
| `site/` | código completo do site |
| `dados/registros.json` e `dados/restaurar_registros.sql` | pendências, análises MASP, avanços, fotos (referências), conferências, projetos, 360° |
| `dados/perfis.json` | lista de usuários e perfis |
| `dados/dados-vN.json` | boletins (BM), itens, traçados, perfis, cronograma, parâmetros da supervisão |
| `arquivos/` | fotos e PDFs, na mesma estrutura de pastas do armazenamento |

Passo a passo:

1. **Supabase** (supabase.com): crie um projeto (região São Paulo). Guarde a senha do banco.
2. **SQL Editor** → cole e rode `site/schema.sql` (cria tabelas, regras de acesso e as pastas de arquivos).
3. **SQL Editor** → cole e rode `dados/restaurar_registros.sql` (volta todos os registros).
4. **Storage** → bucket `privado` → envie `dados/dados-vN.json`.
5. **Storage** → bucket `arquivos` → recrie as pastas (`migr`, `fotos`, `planta`, `AAAA-MM`…) e envie o conteúdo de `arquivos/` mantendo os mesmos nomes.
6. **Edge Functions** → nova função `redefinir-senha` → cole `site/funcao-redefinir-senha.ts` → Deploy. Em Settings da função, desligue "Verify JWT with legacy secret".
7. **Authentication → Sign In / Providers**: deixe "Allow new users to sign up" ligado e "Confirm email" desligado.
8. **Project Settings → API Keys**: copie a URL do projeto e a chave **publishable** (pública). Nunca use a chave secret/service_role no site.
9. Edite `site/config.js`: `url`, `chave` e `dados` (nome do arquivo enviado no passo 4).
10. **GitHub**: crie um repositório público (ex.: `nome-da-organizacao.github.io`), envie todos os arquivos de `site/` e ligue **Settings → Pages → Deploy from branch → main / (root)**.
11. **Authentication → URL Configuration**: Site URL = endereço do site; Redirect URLs = endereço + `**`.
12. Abra o site, crie sua conta e rode no SQL Editor:
    `update public.perfis set papel = 'admin' where email = 'SEU_EMAIL';`
13. Os demais usuários se cadastram de novo (senhas não vão na cópia, por segurança) e você libera em **Usuários**.

---

## 2. Prompt (para uma IA ou programador recriar/evoluir)

> Recrie o **Painel Ramal da Arena**, um site de acompanhamento de obra, em português do Brasil, com HTML/CSS/JavaScript puro (sem etapa de build), hospedado no GitHub Pages e com banco, login e arquivos no Supabase. Use os arquivos anexados (`site/` e `dados/`) como referência exata de comportamento e visual. Requisitos:
>
> **Obra:** Contrato 34/2025 – obras remanescentes do Ramal da Arena (Eixo 5.000, Eixo 7.000, Eixo 10.000 – R. Jacinto Freire de Andrade, R. Dom Antônio de Macedo, R. Frei Amador –, R. Conceição da Barra e Ramal Interno), Camaragibe – PE, contratada Consórcio Arena I, valor R$ 15.399.979,48. Supervisão: contrato 08/2026, Consórcio Entel – Iguatemi – Cortes.
>
> **Visual:** fundo verde-petróleo escuro (#081c1a), cartões #0d2725, destaque #1fc79d, faixa de cabeçalho em degradê #0a4743 → #0a8d72 com o logo, fontes Barlow Condensed (títulos em maiúsculas), Barlow (texto) e IBM Plex Mono (números); modo claro automático; funciona no celular.
>
> **Acesso (regras no banco – RLS –, não só na tela):** cadastro aberto por e-mail e senha, sem confirmação por e-mail; todo cadastro nasce "pendente" e não vê nada; o administrador libera em "Usuários" como **Equipe** (vê e edita tudo), **Diretoria** (só leitura, sem pendências, não conformidades, lançamentos/avanços, "o que falta" e "serviços sem avanço"), **Administrador** (equipe + gestão de usuários) ou **Bloqueado**. Botões "Nova senha" (admin gera senha provisória via Edge Function com a chave de serviço) e "Minha senha".
>
> **Banco:** tabela `perfis(id, email, nome, papel)` criada por gatilho no cadastro; tabela genérica `registros(colecao, id, data jsonb, autor, criado, atualizado)` com tempo real; função `meu_papel()`; coleções restritas à equipe: `rnc`, `sem_avanco`, `faltas`, `lancamentos`. Buckets: `arquivos` (público por link, fotos/PDFs; envio só equipe) e `privado` (arquivo de dados do contrato; leitura só usuários aprovados).
>
> **Dados do contrato** (arquivo `dados-vN.json`, objeto `D`): `meta` (contrato, BM atual, totais), `zones` (frentes e grupos com itens: código, descrição, unidade, quantidade, preço unitário com BDI, acumulado e quantidade por BM), `bms` (valor por BM e por zona), `recs` (trechos medidos por estaca das memórias de cálculo), `geos` (traçados), `secoes`/`perfis` (camadas e perfil longitudinal), `crono` (cronograma), `plans`, `supervisao` (fator da supervisão). Mais `CICLO` e `DREN` (ciclovia e drenagem). O BM atual e os textos "BM nn" do site saem de `D.meta.bm`.
>
> **Telas:** Visão geral (KPIs, pontos de atenção, previsão de medição, avanço por frente, mapa, curva de medição, fotos recentes); uma aba por frente (planta com estacas, camadas e 3D, diagrama por estaca, avanço por serviço, itens do boletim, o que falta, cronograma da frente, lançamentos); Cronograma (Gantt); Fotos por data e estaca; Pendências e não conformidades (gravidade, prazo, fotos, histórico, análise MASP); Conferência × medição; Projetos em uso (lista mestra com PDF); **Avanço**.
>
> **Avanço:** a equipe escolhe planilha (BM original, Aditivo 01, Aditivo 02 ou item novo), BM, período, frente, estacas, atividade principal e quantidade; o painel puxa os serviços ligados com valores e total, usando as regras da memória de cálculo: escavação (m³) → carga e manobra (t = V × 1,5 × 1,3), transporte (tkm = t × DMT, padrão 20,8 km) e destinação final (t); demolição de asfalto (m²) ou fresagem → carga mecânica (m³ = A × 0,05 × 1,3) ou carga de fresado, transporte (t × 6,6 km, densidade 2,4) e reciclagem; remoção de intertravado (m²) → carga de blocos (t = A × 0,08 × 2,4) e transporte interno. Parâmetros, quantidades e preços editáveis. Lista com filtro por planilha e BM. Na Visão geral, "Previsão de medição" soma os avanços do BM escolhido, mostra o % do contrato e estima o BM da supervisão = % medido da obra × fator (R$ 1.171.606,80, calibrado no BM 07 rev.03 da supervisão) + impressões (R$ 506,47).
>
> **Pendências – MASP simplificado:** (1) problema: o quê, onde, quando, quanto; (2) contenção imediata; (3) causa raiz por 5 porquês guiados (cada resposta vira a próxima pergunta "E por que…?", com sugestões por tipo 6M: material, mão de obra, máquina, método, projeto, interferências, gestão; o funcionário marca qual é a causa raiz); (4) plano de ação 5W2H (o quê, quem, quando, como, quanto; várias ações; sugestão automática pela causa raiz); (5) verificação registrada ao fechar a pendência. As causas raiz alimentam o gráfico de espinha de peixe (6M) da obra.
>
> **Cópia de segurança:** botão do administrador que gera um .zip com registros (JSON e SQL), perfis, arquivo de dados, todas as fotos e PDFs, o código do site e este documento.

---

## 3. Rotina recomendada

- **Toda semana:** Cópia de segurança → salvar no Google Drive, pasta "Painel Ramal da Arena – Backups".
- **A cada BM novo:** atualizar o arquivo de dados com o BM e a memória de cálculo, enviar como `dados-vN+1.json` e trocar o nome em `config.js`.
- **Uso do plano grátis do Supabase:** o banco pausa após 7 dias sem acesso (basta entrar no site) e o armazenamento grátis é de 1 GB. Acompanhe em Project Settings → Usage.
