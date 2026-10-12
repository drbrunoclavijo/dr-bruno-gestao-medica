import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './style.css';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url&&key?createClient(url,key):null;
const modules=['Visão geral','Pacientes','Prescrições','Administrações','Estoque','Auditoria'];
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
function Patients(){
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
 function edit(p){setForm(Object.fromEntries(Object.keys(emptyPatient).map(k=>[k,k==='cpf'?formatCPF(p[k]):k==='telefone'?formatPhone(p[k]):p[k]||''])));setEditing(p.id);setMessage('');window.scrollTo({top:0,behavior:'smooth'});}
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
 return <section><p><strong>Ambiente de testes.</strong> Use somente dados fictícios. Não registre informações reais de pacientes.</p>
 <form onSubmit={save}><h3>{editing?'Editar paciente de teste':'Cadastrar paciente de teste'}</h3>
 <div className="patient-grid">
 {field('nome','Nome completo',{required:true,maxLength:150})}
 {field('nascimento','Nascimento',{type:'date'})}
 {field('cpf','CPF',{required:true,maxLength:14,placeholder:'000.000.000-00',inputMode:'numeric'})}
 {field('telefone','Telefone / WhatsApp',{required:true,maxLength:15,inputMode:'tel',placeholder:'(45) 99999-9999'})}
 {field('email','E-mail',{type:'email',required:true,maxLength:254,placeholder:'nome@exemplo.com',pattern:'[^\\s@]+@[^\\s@]+\\.[^\\s@.]+'})}
 <div className="cep-row">{field('cep','CEP',{maxLength:9,inputMode:'numeric',placeholder:'00000-000'})}<button type="button" onClick={lookupCEP} disabled={cepBusy}>{cepBusy?'Buscando...':'Buscar CEP'}</button></div>
 {field('logradouro','Rua / Avenida',{maxLength:200})}
 {field('numero','Número',{maxLength:20})}
 {field('complemento','Complemento',{maxLength:100})}
 {field('bairro','Bairro',{maxLength:100})}
 {field('cidade','Cidade',{maxLength:100})}
 {field('uf','Estado (UF)',{maxLength:2})}
 </div><button className="active" disabled={working||!form.nome.trim()||!form.cpf.trim()||!form.telefone.trim()||!form.email.trim()}>{working?'Salvando...':editing?'Salvar alterações':'Cadastrar'}</button> {editing&&<button type="button" onClick={reset}>Cancelar edição</button>}</form>
 {message&&<p role="status">{message}</p>}
 <h3>Pacientes visíveis para seu perfil</h3><label>Buscar por nome, CPF ou e-mail<input value={search} onChange={e=>setSearch(e.target.value)}/></label> <button onClick={load} disabled={working}>Atualizar lista</button>
 {working?<p>Carregando...</p>:shown.length===0?<p>Nenhum paciente visível.</p>:<ul className="patient-list">{shown.map(p=><li className="patient-card" key={p.id}><div className="patient-card-head"><strong>{p.nome}</strong><button type="button" onClick={()=>edit(p)}>Editar</button></div><div className="patient-details"><div><span>Nascimento</span><strong>{dateBR(p.nascimento)}</strong></div><div><span>Telefone</span><strong>{p.telefone||'Não informado'}</strong></div><div><span>E-mail</span><strong>{p.email||'Não informado'}</strong></div></div></li>)}</ul>}
 </section>;
}
function App(){
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('Visão geral');
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  let active=true;
  async function refresh(s){
   if(!active)return;
   setLoading(true);setSession(s);setProfile(null);setTab('Visão geral');
   if(s){
    const {data,error}=await supabase.from('profissionais').select('id,nome,perfil,ativo').eq('id',s.user.id).single();
    if(active){if(error)setError('Não foi possível validar seu perfil. Verifique as permissões no Supabase.');else setProfile(data);}
   }
   if(active)setLoading(false);
  }
  supabase.auth.getSession().then(({data})=>refresh(data.session)).catch(()=>{if(active){setError('Falha ao verificar a sessão.');setLoading(false);}});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setTimeout(()=>{if(active)refresh(s)},0);});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 async function login(e){e.preventDefault();if(!supabase)return;setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('E-mail ou senha inválidos, ou acesso indisponível.');setBusy(false);}
 async function logout(){setError('');await supabase.auth.signOut();setProfile(null);setSession(null);}
 const permitted=profile?.ativo&&access[profile.perfil]||[];
 return <main><header><h1>Dr. Bruno Clavijo</h1><small>Gestão médica | Acesso restrito</small></header>
 {!supabase?<div className="warning">Configuração pendente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel e publique novamente.</div>:
 loading?<article><p>Verificando acesso...</p></article>:
 !session?<article className="login"><h2>Entrar no sistema</h2><form onSubmit={login}><label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="active" disabled={busy}>{busy?'Entrando...':'Entrar'}</button></form>{error&&<p className="error" role="alert">{error}</p>}</article>:
 <><div className="session"><span>{profile?.nome||session.user.email} {profile?.ativo?'| '+profile.perfil:''}</span><button onClick={logout}>Sair</button></div>
 {!profile?.ativo||!access[profile?.perfil]?<article><h2>Acesso não liberado</h2><p>Seu usuário não possui um perfil ativo e autorizado. Solicite a configuração ao administrador.</p>{error&&<p className="error">{error}</p>}</article>:
 <><nav>{permitted.map(m=><button key={m} className={tab===m?'active':''} onClick={()=>setTab(m)}>{m}</button>)}</nav><article><h2>{tab}</h2>{tab==='Pacientes'?<Patients/>:<><p>Área reservada para {profile.nome}.</p><p>O módulo será habilitado após validação das regras de acesso e dos fluxos clínicos.</p></>}{tab==='Visão geral'&&<div className="cards">{permitted.filter(x=>x!=='Visão geral').map(x=><div key={x}><strong>{x}</strong><p>Em preparação</p></div>)}</div>}</article></>}
 </>}
 <footer>Versão de testes. Não inserir dados de pacientes até a validação de segurança, LGPD e funcionalidades clínicas.</footer></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
