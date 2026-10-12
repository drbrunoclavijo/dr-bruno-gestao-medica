import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './style.css';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url&&key?createClient(url,key):null;
const modules=['Visão geral','Pacientes','Prescrições','Administrações','Estoque','Auditoria'];
const access={medico:modules,enfermeira:['Visão geral','Pacientes','Administrações','Estoque'],equipe:['Visão geral','Pacientes','Estoque']};
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
 <><nav>{permitted.map(m=><button key={m} className={tab===m?'active':''} onClick={()=>setTab(m)}>{m}</button>)}</nav><article><h2>{tab}</h2><p>Área reservada para {profile.nome}.</p><p>O módulo será habilitado após validação das regras de acesso e dos fluxos clínicos.</p>{tab==='Visão geral'&&<div className="cards">{permitted.filter(x=>x!=='Visão geral').map(x=><div key={x}><strong>{x}</strong><p>Em preparação</p></div>)}</div>}</article></>}
 </>}
 <footer>Versão de testes. Não inserir dados de pacientes até a validação de segurança, LGPD e funcionalidades clínicas.</footer></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
