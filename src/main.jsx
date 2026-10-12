import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './style.css';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url&&key?createClient(url,key):null;
const modules=['Visão geral','Pacientes','Prescrições','Administrações','Estoque','Auditoria'];
const access={medico:modules,enfermeira:['Visão geral','Pacientes','Administrações','Estoque'],equipe:['Visão geral','Pacientes','Estoque']};
function Patients(){
 const [items,setItems]=useState([]),[nome,setNome]=useState(''),[nascimento,setNascimento]=useState(''),[telefone,setTelefone]=useState(''),[message,setMessage]=useState(''),[working,setWorking]=useState(false);
 async function load(){
  setWorking(true);setMessage('');
  const {data,error}=await supabase.from('pacientes').select('id,nome,nascimento,telefone').order('nome').limit(100);
  if(error)setMessage('Não foi possível consultar pacientes: '+error.message);
  else setItems(data||[]);
  setWorking(false);
 }
 useEffect(()=>{load();},[]);
 async function save(e){
  e.preventDefault();setWorking(true);setMessage('');
  const {error}=await supabase.from('pacientes').insert({nome:nome.trim(),nascimento:nascimento||null,telefone:telefone.trim()||null});
  if(error){setMessage('Cadastro não autorizado ou inválido: '+error.message);setWorking(false);return;}
  setNome('');setNascimento('');setTelefone('');await load();setMessage('Paciente fictício cadastrado.');
 }
 return <section><p><strong>Ambiente de testes.</strong> Use somente dados fictícios. Não registre informações reais de pacientes.</p>
 <form onSubmit={save}><h3>Cadastrar paciente de teste</h3><label>Nome<input required maxLength="150" value={nome} onChange={e=>setNome(e.target.value)} placeholder="PACIENTE TESTE"/></label><label>Nascimento<input type="date" value={nascimento} onChange={e=>setNascimento(e.target.value)}/></label><label>Telefone<input maxLength="30" value={telefone} onChange={e=>setTelefone(e.target.value)} placeholder="Telefone fictício"/></label><button className="active" disabled={working||!nome.trim()}>Cadastrar</button></form>
 {message&&<p role="status">{message}</p>}
 <h3>Pacientes visíveis para seu perfil</h3><button onClick={load} disabled={working}>Atualizar lista</button>
 {working?<p>Carregando...</p>:items.length===0?<p>Nenhum paciente visível.</p>:<ul>{items.map(p=><li key={p.id}><strong>{p.nome}</strong> {p.nascimento||''} {p.telefone||''}</li>)}</ul>}
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
