import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';

// Executar APENAS contra ambiente de homologação com dados fictícios.
// Exige credenciais temporárias e separadas dos 3 perfis. Somente leituras.
// Não roda no CI sem configuração explícita.
const env=process.env;
const URL=env.SUPABASE_TEST_URL;
const KEY=env.SUPABASE_TEST_ANON_KEY;
const identities={
 medico:[env.TEST_MEDICO_EMAIL,env.TEST_MEDICO_PASSWORD],
 enfermeira:[env.TEST_ENFERMEIRA_EMAIL,env.TEST_ENFERMEIRA_PASSWORD],
 equipe:[env.TEST_EQUIPE_EMAIL,env.TEST_EQUIPE_PASSWORD]
};
const ready=Boolean(URL&&KEY&&Object.values(identities).every(v=>v[0]&&v[1]));
const now=new Date();const end=now.toISOString().slice(0,10);
const start=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
async function client(role){
 const [email,password]=identities[role];
 const api=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await api.auth.signInWithPassword({email,password});
 assert.ifError(error);
 assert.ok(data.user?.id);
 const {data:profile,error:profileError}=await api.from('profissionais').select('perfil,ativo').eq('id',data.user.id).single();
 assert.ifError(profileError);
 assert.equal(profile.perfil,role);
 assert.equal(profile.ativo,true);
 return api;
}
const args={p_inicio:start,p_fim:end};
const audit={p_inicio:start,p_fim:end,p_modulo:'todos',p_usuario:null};
const reportRead=[['relatorio_producao_periodo_teste',args],['relatorio_agenda_periodo_teste',args]];
const doctorOnly=[
 ['relatorio_caixa_periodo_teste',args],
 ['listar_auditoria_geral_teste',audit],
 ['listar_responsaveis_auditoria_teste',{}],
 ['listar_catalogo_servicos_teste',{}],
 ['listar_contas_receber_teste',{}],
 ['resumo_taxas_pagamentos_teste',{p_ano:Number(end.slice(0,4))}]
];
test('Ambiente de teste configurado ou explicitamente ignorado',{skip:!ready},async()=>{
 assert.ok(URL.startsWith('https://'),'A URL deve ser HTTPS');
 assert.ok(!URL.includes('localhost'),'Verifique o projeto Supabase de TESTES');
 for(const role of Object.keys(identities)){
  const api=await client(role);
  try{
   for(const [fn,params] of reportRead){
    const result=await api.rpc(fn,params);
    if(role==='equipe')assert.ok(result.error,fn+' deve negar equipe');
    else assert.ifError(result.error);
   }
   for(const [fn,params] of doctorOnly){
    const result=await api.rpc(fn,params);
    if(role==='medico')assert.ifError(result.error);
    else assert.ok(result.error,fn+' deve negar '+role);
   }
   const own=await api.rpc('listar_procedimentos_carol_repasse_teste');
   if(role==='enfermeira')assert.ifError(own.error);
   else assert.ok(own.error,'Procedimentos da Carol devem ser reservados a enfermeira');
  }finally{await api.auth.signOut();}
 }
});
