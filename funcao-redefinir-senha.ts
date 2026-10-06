// Painel Ramal da Arena · redefinir senha (só administradores)
// O administrador gera uma senha provisória para quem esqueceu a dele,
// sem depender de envio de e-mail. A chave de serviço fica só aqui no servidor.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error: e1 } = await admin.auth.getUser(jwt);
    if (e1 || !user) return resp({ erro: "sessão inválida, entre de novo" }, 401);
    const { data: perfil } = await admin.from("perfis").select("papel").eq("id", user.id).single();
    if (!perfil || perfil.papel !== "admin") return resp({ erro: "apenas administradores" }, 403);
    const { user_id, senha } = await req.json();
    if (!user_id || typeof senha !== "string" || senha.length < 8) return resp({ erro: "senha precisa ter 8 caracteres" }, 400);
    if (user_id === user.id) return resp({ erro: "para a sua conta use Minha senha" }, 400);
    const { error } = await admin.auth.admin.updateUserById(user_id, { password: senha });
    if (error) return resp({ erro: error.message }, 400);
    return resp({ ok: true });
  } catch (e) {
    return resp({ erro: String(e) }, 500);
  }
});
