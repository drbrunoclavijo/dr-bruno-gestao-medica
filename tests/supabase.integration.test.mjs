import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';

// Testes SOMENTE de leitura. Executar APENAS em projeto Supabase de homologacao.
// Nao usar credenciais reais de pacientes, nem adicionar senhas ao GitHub.
const env=process.env;
const URL=env.SUPABASE_TEST_URL;
const KEY=env.SUPABASE_TEST_ANON_KEY;
const identities={
 medico:[env.TEST_MEDICO_EMAIL,env.TEST_MEDICO_PASSWORD],
 enfermeira:[env.TEST_ENFERMEIRA_EMAIL,env.TEST_ENFERMEIRA_PASSWORD],
 equipe:[env.TEST_EQUIPE_EMAIL,env.TEST_EQUIPE_PASSWORD],
 administrativo:[env.TEST_ADMINISTRATIVO_EMAIL,env.TEST_ADMINISTRATIVO_PASSWORD]
};
const has=(role)=>identities[role].every(Boolean);
const threeReady=Boolean(URL&&KEY&&['medico','enfermeira','equipe'].every(has));
const managerReady=Boolean(threeReady&&has('administrativo'));
const tz='America/Sao_Paulo';
const timeParts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const t=Object.fromEntries(timeParts.map(x=>[x.type,x.value]));
const end=t.year+'-'+t.month+'-'+t.day;
const shift=(iso,days)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const start=shift(end,-7);
const range={p_inicio:start,p_fim:end};
const audit={...range,p_modulo:'todos',p_usuario:null};
const year=Number(t.year);

const rpcCases=[
 ['agenda_profissionais_teste',{},['medico','enfermeira','equipe','administrativo']],
 ['listar_agendamentos_teste',{p_de:start,p_ate:end},['medico','enfermeira','equipe','administrativo']],
 ['listar_pendencias_agenda_teste',{},['equipe','administrativo']],
 ['listar_contas_receber_teste',{},['medico','administrativo']],
 ['listar_despesas_financeiras_teste',{p_ano:year},['medico','administrativo']],
 ['resumo_taxas_pagamentos_teste',{p_ano:year},['medico','administrativo']],
 ['relatorio_caixa_periodo_teste',range,['medico','administrativo']],
 ['listar_auditoria_geral_teste',audit,['medico','administrativo']],
 ['listar_responsaveis_auditoria_teste',{},['medico','administrativo']],
 ['listar_protocolos_financeiro_admin_teste',{},['medico','administrativo']],
 ['listar_protocolos_com_insumos_teste',{},['medico']],
 ['relatorio_producao_periodo_teste',range,['medico','enfermeira']],
 ['relatorio_agenda_periodo_teste',range,['medico','enfermeira']],
 ['listar_procedimentos_carol_repasse_teste',{},['enfermeira']]
];

async function createLoggedClient(role){
 const [email,password]=identities[role];
 const api=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await api.auth.signInWithPassword({email,password});
 assert.ifError(error);
 assert.ok(data.user?.id);
 const {data:profile,error:profileError}=await api.from('profissionais').select('perfil,ativo').eq('id',data.user.id).single();
 assert.ifError(profileError);
 assert.equal(profile.perfil,role);
 assert.equal(profile.ativo,true,'Acesso deve estar ATIVO apenas no usuario de homologacao');
 return api;
}

test('Regras autenticadas dos tres perfis ativos',{skip:!threeReady},async()=>{
 assert.match(URL,/^https:\/\//);
 for(const role of ['medico','enfermeira','equipe']){
  const api=await createLoggedClient(role);
  try{
   for(const [fn,args,allowed] of rpcCases){
    const {error}=await api.rpc(fn,args);
    if(allowed.includes(role))assert.ifError(error,role+': '+fn+' deveria ser permitido');
    else assert.ok(error,role+': '+fn+' deveria ser NEGADO');
   }
  }finally{await api.auth.signOut();}
 }
});

test('Permissoes do gerente ficticio somente quando criado em homologacao',{skip:!managerReady},async()=>{
 const role='administrativo';
 const api=await createLoggedClient(role);
 try{
  for(const [fn,args,allowed] of rpcCases){
   const {error}=await api.rpc(fn,args);
   if(allowed.includes(role))assert.ifError(error,'Gerente deveria ter acesso a '+fn);
   else assert.ok(error,'Gerente NAO pode executar '+fn);
  }
 }finally{await api.auth.signOut();}
});

test('Perfil inativo tem RPC financeira e auditoria bloqueadas (somente se conta de teste configurada)',{
 skip:!Boolean(threeReady&&env.TEST_INATIVO_EMAIL&&env.TEST_INATIVO_PASSWORD)
},async()=>{
 const api=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 try{
  const {data,error}=await api.auth.signInWithPassword({email:env.TEST_INATIVO_EMAIL,password:env.TEST_INATIVO_PASSWORD});
  assert.ifError(error);
  const p=await api.from('profissionais').select('ativo').eq('id',data.user.id).single();
  // Pode estar invisivel pela propria politica de acesso, mas jamais pode estar ativo.
  assert.ok(p.error||p.data?.ativo===false,'Usuario de teste deve estar efetivamente inativo');
  for(const [fn,args] of [['listar_contas_receber_teste',{}],['listar_auditoria_geral_teste',audit],['listar_agendamentos_teste',{p_de:start,p_ate:end}]]){
   const {error:denied}=await api.rpc(fn,args);
   assert.ok(denied,'Perfil inativo nao pode consultar '+fn);
  }
 }finally{await api.auth.signOut();}
});

test('Equipe e gerente nao recebem registros clinicos por consultas REST',{skip:!threeReady},async()=>{
 for(const role of ['equipe',...(managerReady?['administrativo']:[])]){
  const api=await createLoggedClient(role);
  try{
   for(const table of ['prescricoes_teste','prescricao_itens_teste','documentos_pacientes_teste']){
    const {data,error}=await api.from(table).select('*').limit(1);
    // Sem permissao SQL ou tabela invisivel por RLS: ambos sao aceitaveis.
    if(!error)assert.equal(data?.length??0,0,role+' recebeu linhas clinicas de '+table);
   }
  }finally{await api.auth.signOut();}
 }
});

test('Encerramento: perfis nao medicos sao negados no servidor (sem gravar dados)',{skip:!threeReady},async()=>{
 // UUID reservado a este teste, sem agendamento correspondente.
 // Consulta a RPC deve retornar erro antes de executar qualquer escrita.
 const nonexistent='00000000-0000-4000-8000-000000000000';
 const checks={evolucao:true,tratamento:true,retorno:true,documentos:true};
 for(const role of ['medico','enfermeira','equipe',...(managerReady?['administrativo']:[])]){
  const api=await createLoggedClient(role);
  try{
   const {data,error}=await api.rpc('encerrar_consulta_teste',{
    p_agendamento_id:nonexistent,p_consulta_id:nonexistent,p_checks:checks
   });
   assert.ok(error,'Agendamento inexistente deve falhar para '+role);
   assert.equal(data,null,'Nenhum encerramento retornado para '+role);
   if(role==='medico'){
    assert.match(error.message,/Agendamento nao encontrado/i);
   }else{
    assert.match(error.message,/Somente medico autenticado/i,role+' nao deve passar da validacao de permissao');
   }
  }finally{await api.auth.signOut();}
 }
});
