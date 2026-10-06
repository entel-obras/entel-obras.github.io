-- =====================================================================
-- Painel Ramal da Arena · estrutura do banco (Supabase / PostgreSQL)
-- Rode este arquivo inteiro uma vez no SQL Editor do projeto Supabase.
-- Pode rodar de novo sem perder dados (é idempotente).
-- =====================================================================

-- ---------- perfis de acesso ----------
-- pendente  : acabou de se cadastrar, não vê nada até o admin liberar
-- diretoria : só leitura; não lê pendências, NCs, lançamentos, faltas, sem avanço
-- equipe    : lê e edita tudo
-- admin     : equipe + gerencia usuários
-- bloqueado : sem acesso
create table if not exists public.perfis (
  id      uuid primary key references auth.users on delete cascade,
  email   text,
  nome    text,
  papel   text not null default 'pendente'
          check (papel in ('pendente','diretoria','equipe','admin','bloqueado')),
  criado  timestamptz not null default now()
);
alter table public.perfis enable row level security;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid()
$$;

-- cria o perfil (pendente) a cada novo cadastro
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email, nome)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select
  using (id = auth.uid() or public.meu_papel() in ('diretoria','equipe','admin'));
drop policy if exists perfis_admin on public.perfis;
create policy perfis_admin on public.perfis for update
  using (public.meu_papel() = 'admin') with check (public.meu_papel() = 'admin');

-- ---------- registros do painel (pendências, fotos, conferências...) ----------
create table if not exists public.registros (
  colecao     text not null,
  id          text not null,
  data        jsonb not null default '{}'::jsonb,
  autor       uuid default auth.uid(),
  criado      timestamptz not null default now(),
  atualizado  timestamptz not null default now(),
  primary key (colecao, id)
);
alter table public.registros enable row level security;

-- coleções que a diretoria NÃO pode ler
create or replace function public.colecao_restrita(c text) returns boolean
language sql immutable as $$
  select c in ('rnc', 'sem_avanco', 'faltas', 'lancamentos')
$$;

drop policy if exists registros_ler on public.registros;
create policy registros_ler on public.registros for select using (
  public.meu_papel() in ('equipe','admin')
  or (public.meu_papel() = 'diretoria' and not public.colecao_restrita(colecao))
);
drop policy if exists registros_inserir on public.registros;
create policy registros_inserir on public.registros for insert
  with check (public.meu_papel() in ('equipe','admin'));
drop policy if exists registros_alterar on public.registros;
create policy registros_alterar on public.registros for update
  using (public.meu_papel() in ('equipe','admin'))
  with check (public.meu_papel() in ('equipe','admin'));
drop policy if exists registros_apagar on public.registros;
create policy registros_apagar on public.registros for delete
  using (public.meu_papel() in ('equipe','admin'));

-- atualização parcial (mescla campos), respeitando as regras acima
create or replace function public.registro_mesclar(p_colecao text, p_id text, p_patch jsonb)
returns void language sql security invoker set search_path = public as $$
  update public.registros
     set data = data || p_patch, atualizado = now()
   where colecao = p_colecao and id = p_id
$$;

-- tempo real (a tela atualiza sozinha quando alguém lança algo)
do $$ begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registros') then
    alter publication supabase_realtime add table public.registros;
  end if;
end $$;

-- ---------- arquivos ----------
-- arquivos : fotos e PDFs enviados pela equipe (leitura pelo link)
-- privado  : dados.json do contrato (só usuários aprovados leem)
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', true, 20971520),
       ('privado',  'privado',  false, 52428800)
on conflict (id) do nothing;

drop policy if exists arquivos_listar on storage.objects;
create policy arquivos_listar on storage.objects for select
  using (bucket_id = 'arquivos' and public.meu_papel() in ('diretoria','equipe','admin'));
drop policy if exists arquivos_enviar on storage.objects;
create policy arquivos_enviar on storage.objects for insert
  with check (bucket_id = 'arquivos' and public.meu_papel() in ('equipe','admin'));
drop policy if exists arquivos_apagar on storage.objects;
create policy arquivos_apagar on storage.objects for delete
  using (bucket_id = 'arquivos' and public.meu_papel() in ('equipe','admin'));

drop policy if exists privado_ler on storage.objects;
create policy privado_ler on storage.objects for select
  using (bucket_id = 'privado' and public.meu_papel() in ('diretoria','equipe','admin'));
drop policy if exists privado_admin_enviar on storage.objects;
create policy privado_admin_enviar on storage.objects for insert
  with check (bucket_id = 'privado' and public.meu_papel() = 'admin');
drop policy if exists privado_admin_alterar on storage.objects;
create policy privado_admin_alterar on storage.objects for update
  using (bucket_id = 'privado' and public.meu_papel() = 'admin');

-- ---------- depois do seu primeiro cadastro, rode (trocando o e-mail se preciso): ----------
-- update public.perfis set papel = 'admin' where email = 'andre.vasconcelos@entel.eng.br';
