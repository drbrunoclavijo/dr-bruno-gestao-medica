import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './style.css';
import ClinicalRecord from './ClinicalRecord.jsx';
import TestPrescriptions from './TestPrescriptions.jsx';
import TestAdministrations from './TestAdministrations.jsx';
import TestInventory from './TestInventory.jsx';
import TestCostReport from './TestCostReport.jsx';
import TestPatientDocuments from './TestPatientDocuments.jsx';
import TestProtocols from './TestProtocols.jsx';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url&&key?createClient(url,key):null;
const modules=['Visão geral','Pacientes','Prescrições','Administrações','Estoque','Custos','Protocolos','Auditoria'];
const access={medico:modules,enfermeira:['Visão geral','Pacientes','Administrações','Estoque'],equipe:['Visão geral','Pacientes','Estoque']};
const emptyPatient={nome:'',nascimento:'',telefone:'',cpf:'',email:'',cep:'',logradouro:'',numero:'',complemento:'',bairro:'',cidade:'',uf:''};
function validCPF(value){
 const n=value.replace(/\D/g,'');
 if(n.length!==11||/^(\d)\1+$/.test(n))return false;
 for(let length=9;length<=10;length++){let sum=0;for(let i=0;i<length;i++)sum+=Number(n[i])*(length+1-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(n[length]))return false;}
 return true;
}
function formatCPF(value){const n=String(value||'').replace(/\D/g,'').slice(0,11);return n.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{1,2})$/,'$1-$2');}
function formatPhone(value){const n=String(value||'').replace(/\D/g,'').slice(0,11);if(!n)return '';if(n.length<3)return '('+n;const d='('+n.slice(0,2)+') ';const rest=n.slice(2);if(rest.length<=4)return d+rest;const split=rest.length>8?5:4;return d+rest.slice(0,split)+(rest.length>split?'-'+rest.slice(split):'');}
function dateBR(value){if(!value)return 'Não informado';const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:value;}
function Patients({role}){
 const [selectedId,setSelectedId]=useState(()=>{try{return sessionStorage.getItem('majestic-patient-selection')||null;}catch{return null;}});
 useEffect(()=>{try{if(selectedId)sessionStorage.setItem('majestic-patient-selection',selectedId);else sessionStorage.removeItem('majestic-patient-selection');}catch{}},[selectedId]);
 const [items,setItems]=useState([]),[form,setForm]=useState(emptyPatient),[editing,setEditing]=useState(null),[message,setMessage]=useState(''),[working,setWorking]=useState(false),[search,setSearch]=useState(''),[cepBusy,setCepBusy]=useState(false);
 const set=(field,value)=>setForm(old=>({...old,[field]:field==='cpf'?formatCPF(value):field==='telefone'?formatPhone(value):value}));
 async function load(){
  setWorking(true);
  const {data,error}=await supabase.from('pacientes').select('id,nome,nascimento,telefone,cpf,email,cep,logradouro,numero,complemento,bairro,cidade,uf').order('nome').limit(100);
  if(error)setMessage('Não foi possível consultar pacientes: '+error.message);else setItems(data||[]);
  setWorking(false);
 }
 useEffect(()=>{load();},[]);
 function reset(){setForm(emptyPatient);setEditing(null);}
 function edit(p){setSelectedId(null);setForm(Object.fromEntries(Object.keys(emptyPatient).map(k=>[k,k==='cpf'?formatCPF(p[k]):k==='telefone'?formatPhone(p[k]):p[k]||''])));setEditing(p.id);setMessage('');window.scrollTo({top:0,behavior:'smooth'});}
 async function lookupCEP(){
  const cep=form.cep.replace(/\D/g,'');if(cep.length!==8){setMessage('Informe um CEP com 8 números.');return;}
  setCepBusy(true);setMessage('');
  try{
   const response=await fetch('https://viacep.com.br/ws/'+cep+'/json/');
   if(!response.ok)throw new Error('Consulta indisponível');
   const data=await response.json();if(data.erro){setMessage('CEP não encontrado.');return;}
   setForm(old=>({...old,cep,logradouro:data.logradouro||old.logradouro,bairro:data.bairro||old.bairro,cidade:data.localidade||old.cidade,uf:data.uf||old.uf}));
  }catch{setMessage('Não foi possível buscar o CEP. Preencha o endereço manualmente.');}finally{setCepBusy(false);}
 }
 async function save(e){
  e.preventDefault();setMessage('');
  const cpf=form.cpf.replace(/\D/g,'');if(!validCPF(cpf)){setMessage('CPF inválido. Confira os 11 dígitos.');return;}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(form.email.trim())){setMessage('Informe um e-mail válido, com @ e domínio (exemplo: nome@exemplo.com).');return;}
  const cep=form.cep.replace(/\D/g,'');if(cep&&cep.length!==8){setMessage('CEP deve ter 8 dígitos.');return;}
  setWorking(true);
  const values={...form,nome:form.nome.trim(),cpf,cep:cep||null,uf:form.uf.trim().toUpperCase()};
  for(const k of Object.keys(values)){if(typeof values[k]==='string'&&!values[k].trim())values[k]=null;}
  const query=editing?supabase.from('pacientes').update(values).eq('id',editing):supabase.from('pacientes').insert(values);
  const {error}=await query;
  if(error){setMessage('Não foi possível salvar: '+(error.code==='23505'?'CPF já cadastrado.':error.message));setWorking(false);return;}
  reset();await load();setMessage(editing?'Cadastro atualizado.':'Paciente fictício cadastrado.');
 }
 const field=(key,label,props={})=><label key={key}>{label}<input value={form[key]} onChange={e=>set(key,e.target.value)} {...props}/></label>;
 const shown=items.filter(p=>[p.nome,p.cpf,p.email].some(v=>(v||'').toLowerCase().includes(search.toLowerCase())));
 const selected=items.find(p=>p.id===selectedId);
 const detail=(label,value)=><div className="detail-item"><span>{label}</span><strong>{value||'Não informado'}</strong></div>;
 const addressOf=p=>[p.logradouro,[p.numero,p.complemento].filter(Boolean).join(' - '),p.bairro,[p.cidade,p.uf].filter(Boolean).join(' / ')].filter(Boolean).join(', ');
 if(selected) return <section className="patients-page patient-profile">
  <div className="profile-toolbar"><button type="button" className="outline-gold" onClick={()=>setSelectedId(null)}>← Voltar para pacientes</button><span className="profile-test-label">FICHA CADASTRAL · AMBIENTE DE TESTES</span></div>
  <div className="premium-panel">
   <div className="profile-heading"><div className="patient-avatar" aria-hidden="true">♙</div><div className="profile-name"><p className="eyebrow">FICHA DO PACIENTE</p><h3>{selected.nome}</h3><p>Informações cadastrais disponíveis no sistema</p></div><button type="button" className="gold-button" onClick={()=>edit(selected)}>✎ Editar cadastro</button></div>
   <div className="form-section"><h4>◈ Dados pessoais</h4><div className="detail-grid">{detail('Nome completo',selected.nome)}{detail('Nascimento',dateBR(selected.nascimento))}{detail('CPF',formatCPF(selected.cpf))}</div></div>
   <div className="form-section"><h4>✧ Contato</h4><div className="detail-grid">{detail('Telefone / WhatsApp',formatPhone(selected.telefone))}{detail('E-mail',selected.email)}</div></div>
   <div className="form-section"><h4>⌖ Endereço</h4><div className="detail-grid">{detail('CEP',selected.cep)}{detail('Rua / Avenida',selected.logradouro)}{detail('Número',selected.numero)}{detail('Complemento',selected.complemento)}{detail('Bairro',selected.bairro)}{detail('Cidade',selected.cidade)}{detail('Estado (UF)',selected.uf)}</div></div>
  </div>
  {role==='medico'?<ClinicalRecord key={selected.id} supabase={supabase} patientId={selected.id} canWrite={true}/>:<div className="premium-panel"><p className="profile-notice">Prontuário clínico restrito ao perfil médico autorizado. A equipe administrativa visualiza somente os dados cadastrais permitidos.</p></div>}
  {role==='medico'&&<TestPatientDocuments key={'docs-'+selected.id} supabase={supabase} patientId={selected.id}/>}
  {role==='medico'&&<TestPrescriptions key={'rx-'+selected.id} supabase={supabase} patientId={selected.id} patientName={selected.nome} canWrite={true}/>}
  {(role==='medico'||role==='enfermeira')&&<TestAdministrations key={'admin-'+selected.id} supabase={supabase} patientId={selected.id} role={role}/>}
 </section>;

 return <section className="patients-page">
 <div className="page-intro"><div><p className="eyebrow">GESTÃO DE PACIENTES</p><p className="muted">Ambiente de testes. Use somente dados fictícios. Não registre informações reais de pacientes.</p></div><span className="intro-motto">CUIDADO · ORGANIZAÇÃO · EXCELÊNCIA</span></div>
 <form onSubmit={save} className="premium-panel registration-panel">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">♙</span><div><h3>{editing?'Editar paciente de teste':'Cadastrar paciente de teste'}</h3><p>Preencha as informações para {editing?'atualizar o cadastro':'cadastrar um novo paciente'}.</p></div></div>
  <div className="form-section"><h4><span aria-hidden="true">◈</span> Dados pessoais</h4><div className="patient-grid personal-grid">
   {field('nome','Nome completo',{required:true,maxLength:150,placeholder:'Digite o nome completo do paciente'})}
   {field('nascimento','Nascimento',{type:'date'})}
   {field('cpf','CPF',{required:true,maxLength:14,placeholder:'000.000.000-00',inputMode:'numeric'})}
  </div></div>
  <div className="form-section"><h4><span aria-hidden="true">✧</span> Contato</h4><div className="patient-grid contact-grid">
   {field('telefone','Telefone / WhatsApp',{required:true,maxLength:15,inputMode:'tel',placeholder:'(45) 99999-9999'})}
   {field('email','E-mail',{type:'email',required:true,maxLength:254,placeholder:'nome@exemplo.com'})}
  </div></div>
  <div className="form-section"><h4><span aria-hidden="true">⌖</span> Endereço</h4><div className="patient-grid address-grid">
   <div className="cep-row">{field('cep','CEP',{maxLength:9,inputMode:'numeric',placeholder:'00000-000'})}<button type="button" className="outline-gold" onClick={lookupCEP} disabled={cepBusy}>{cepBusy?'Buscando...':'Buscar CEP'}</button></div>
   {field('logradouro','Rua / Avenida',{maxLength:200,placeholder:'Digite o endereço'})}
   {field('numero','Número',{maxLength:20,placeholder:'Nº'})}
   {field('complemento','Complemento',{maxLength:100,placeholder:'Opcional'})}
   {field('bairro','Bairro',{maxLength:100,placeholder:'Digite o bairro'})}
   {field('cidade','Cidade',{maxLength:100,placeholder:'Digite a cidade'})}
   {field('uf','Estado (UF)',{maxLength:2,placeholder:'UF'})}
  </div></div>
  <div className="form-actions"><button type="button" onClick={reset} className="outline-gold">{editing?'Cancelar edição':'Limpar campos'}</button><button className="gold-button" disabled={working||!form.nome.trim()||!form.cpf.trim()||!form.telefone.trim()||!form.email.trim()}>{working?'Salvando...':editing?'Salvar alterações':'Cadastrar'}</button></div>
 </form>
 {message&&<p className="form-message" role="status">{message}</p>}
 <div className="premium-panel directory-panel"><div className="panel-title"><span className="title-icon" aria-hidden="true">♧</span><div><h3>Pacientes visíveis para seu perfil</h3><p>Busque por nome, CPF ou e-mail para encontrar cadastros.</p></div></div>
 <div className="search-row"><label className="search-label"><span className="sr-only">Buscar por nome, CPF ou e-mail</span><input aria-label="Buscar por nome, CPF ou e-mail" placeholder="⌕  Buscar por nome, CPF ou e-mail..." value={search} onChange={e=>setSearch(e.target.value)}/></label><button type="button" className="outline-gold" onClick={load} disabled={working}>↻ &nbsp; Atualizar lista</button></div>
 {working?<p>Carregando...</p>:shown.length===0?<p>Nenhum paciente visível.</p>:<ul className="patient-list">{shown.map(p=><li className="patient-card" key={p.id}><div className="patient-avatar" aria-hidden="true">♙</div><div className="patient-card-content"><div className="patient-card-head"><strong>{p.nome}</strong><div className="patient-actions"><button type="button" className="gold-button" onClick={()=>setSelectedId(p.id)}>Abrir ficha</button><button type="button" className="outline-gold" onClick={()=>edit(p)}>✎ &nbsp; Editar</button></div></div><div className="patient-details"><div><span>Nascimento</span><strong>{dateBR(p.nascimento)}</strong></div><div><span>Telefone</span><strong>{p.telefone||'Não informado'}</strong></div><div><span>E-mail</span><strong>{p.email||'Não informado'}</strong></div></div></div></li>)}</ul>}
 </div>
 </section>;
}
function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState(()=>{
  try{const saved=sessionStorage.getItem('majestic-current-tab');return modules.includes(saved)?saved:'Visão geral';}catch{return 'Visão geral';}
 });
 useEffect(()=>{try{sessionStorage.setItem('majestic-current-tab',tab);}catch{}},[tab]);
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let active=true;
  let userId=null;
  let authRevision=0;
  let profileReady=false;
  async function refresh(s){
   if(!active)return;
   const nextId=s?.user?.id||null;
   // TOKEN_REFRESHED / SIGNED_IN em foco não podem reiniciar a navegação.
   // Só revalidamos perfil quando a identidade realmente muda.
   if(nextId===userId){
    setSession(old=>nextId?s:(old?.user?.id===nextId?null:old));
    if(profileReady||!nextId)setLoading(false);
    return;
   }
   const request=++authRevision;
   userId=nextId;
   profileReady=false;
   if(!nextId){
    setSession(null);setProfile(null);setLoading(false);
    try{sessionStorage.removeItem('majestic-patient-selection');}catch{}
    return;
   }
   // Não desmontar a interface ao renovar o token do MESMO usuário.
   setLoading(true);
   setSession(s);
   setProfile(null);
   const {data,error:profileError}=await supabase.from('profissionais')
     .select('id,nome,perfil,ativo').eq('id',nextId).single();
   if(!active||request!==authRevision)return;
   profileReady=true;
   if(profileError||!data){
    setError('Não foi possível validar seu perfil. Verifique as permissões no Supabase.');
   }else{
    setError('');
    setProfile(data);
   }
   setLoading(false);
  }
  supabase.auth.getSession().then(({data})=>refresh(data.session))
    .catch(()=>{if(active){setError('Falha ao verificar a sessão.');setLoading(false);}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{
   // Supabase emite eventos ao trocar de aba e renovar sessão.
   // Um refresh assíncrono não deve recolocar o usuário na tela inicial.
   setTimeout(()=>{if(active)refresh(s);},0);
  });
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 async function login(e){e.preventDefault();if(!supabase)return;setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('E-mail ou senha inválidos, ou acesso indisponível.');setBusy(false);}
 async function logout(){setError('');try{sessionStorage.removeItem('majestic-current-tab');sessionStorage.removeItem('majestic-patient-selection');}catch{}setTab('Visão geral');await supabase.auth.signOut();setProfile(null);setSession(null);}
 const permitted=profile?.ativo&&access[profile.perfil]||[];
 const activeTab=permitted.includes(tab)?tab:'Visão geral';
 return <main><header><div className="brand-emblem" aria-hidden="true">✦</div><div><h1>Majestic Santé Institute</h1><small>Gestão médica | Acesso restrito</small></div></header>
 {!supabase?<div className="warning">Configuração pendente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel e publique novamente.</div>:
 loading?<article><p>Verificando acesso...</p></article>:
 !session?<article className="login"><h2>Entrar no sistema</h2><form onSubmit={login}><label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="active" disabled={busy}>{busy?'Entrando...':'Entrar'}</button></form>{error&&<p className="error" role="alert">{error}</p>}</article>:
 <><div className="session"><span className="session-user"><span className="user-avatar" aria-hidden="true">BC</span><span>{profile?.nome||session.user.email}<small>{profile?.ativo?profile.perfil:'Acesso restrito'}</small></span></span><button onClick={logout}>Sair</button></div>
 {!profile?.ativo||!access[profile?.perfil]?<article><h2>Acesso não liberado</h2><p>Seu usuário não possui um perfil ativo e autorizado. Solicite a configuração ao administrador.</p>{error&&<p className="error">{error}</p>}</article>:
 <><nav>{permitted.map(m=><button key={m} className={activeTab===m?'active':''} onClick={()=>setTab(m)}>{m}</button>)}</nav><article><h2>{activeTab}</h2>{activeTab==='Pacientes'?<Patients role={profile.perfil}/>:activeTab==='Custos'?<TestCostReport supabase={supabase}/>:activeTab==='Protocolos'?<TestProtocols supabase={supabase}/>:activeTab==='Estoque'?(['medico','enfermeira','equipe'].includes(profile.perfil)?<TestInventory supabase={supabase} role={profile.perfil}/>:<p>Você não possui acesso ao estoque de testes.</p>):<><p>Área reservada para {profile.nome}.</p><p>O módulo será habilitado após validação das regras de acesso e dos fluxos clínicos.</p></>}{activeTab==='Visão geral'&&<div className="cards">{permitted.filter(x=>x!=='Visão geral').map(x=><div key={x}><strong>{x}</strong><p>Em preparação</p></div>)}</div>}</article></>}
 </>}
 <footer>Versão de testes. Não inserir dados de pacientes até a validação de segurança, LGPD e funcionalidades clínicas.</footer></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
