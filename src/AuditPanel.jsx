import React,{useEffect,useMemo,useState} from 'react';
const iso=()=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
};
const minusDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const fmt=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(v)):'—';
const modules={todos:'Todos os módulos',agenda:'Agenda',financeiro:'Financeiro',despesas:'Despesas',estoque:'Estoque',enfermagem:'Administrações',protocolos:'Protocolos e sessões'};
const names={status_alterado:'Status atualizado',medicamento_vinculado:'Medicamento vinculado',saida_checagem:'Saída de estoque na checagem',checagem_registrada:'Checagem registrada',sessao_reagendada:'Sessão reagendada',protocolo_criado:'Protocolo cadastrado'};
const friendly=s=>names[s]||String(s||'').replaceAll('_',' ');
export default function AuditPanel({supabase}){
 const [start,setStart]=useState(()=>minusDays(iso(),30)),[end,setEnd]=useState(iso());
 const [module,setModule]=useState('todos'),[user,setUser]=useState(''),[people,setPeople]=useState([]);
 const [rows,setRows]=useState([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[page,setPage]=useState(1);
 async function load(){
  const days=(Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000;
  if(!start||!end||start>end||days>365){setError('Escolha um período válido com no máximo 366 dias.');return;}
  setLoading(true);setError('');
  const [logs,staff]=await Promise.all([
   supabase.rpc('listar_auditoria_geral_teste',{p_inicio:start,p_fim:end,p_modulo:module,p_usuario:user||null}),
   supabase.rpc('listar_responsaveis_auditoria_teste')
  ]);
  if(logs.error||staff.error){setRows([]);setError('Não foi possível carregar a auditoria: '+(logs.error||staff.error).message+'. Confira o SQL da auditoria.');}
  else{setRows(logs.data||[]);setPeople(staff.data||[]);setPage(1);}
  setLoading(false);
 }
 useEffect(()=>{load();},[start,end,module,user]);
 const visible=useMemo(()=>rows.filter(r=>[
  r.modulo,r.acao,r.responsavel_nome,r.detalhe,r.referencia_id
 ].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))),[rows,search]);
 const pageSize=30,maxPage=Math.max(1,Math.ceil(visible.length/pageSize));
 const current=Math.min(page,maxPage),displayed=visible.slice((current-1)*pageSize,current*pageSize);
 const recorded=rows.filter(r=>r.natureza==='historico').length;
 const operational=rows.filter(r=>r.natureza==='registro_operacional').length;
 return <section className="audit-panel">
  <div className="premium-panel">
   <div className="panel-title"><span className="title-icon" aria-hidden="true">◎</span><div>
    <h3>Auditoria geral — somente leitura</h3><p>Históricos disponíveis e registros de operações fictícias.</p>
   </div></div>
   <p className="profile-notice">Acesso exclusivo ao perfil médico. Este painel agrega fontes existentes, mas não demonstra uma trilha imutável ou completa de todas as alterações. Eventos descritos como “Registro operacional” não são logs independentes de auditoria. Nenhum histórico pode ser alterado por esta tela.</p>
   <div className="audit-filters">
    <label>De<input aria-label="Data inicial da auditoria" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>Até<input aria-label="Data final da auditoria" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    <label>Módulo<select value={module} onChange={e=>setModule(e.target.value)}>{Object.entries(modules).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Responsável<select value={user} onChange={e=>setUser(e.target.value)}><option value="">Todos os profissionais</option>{people.map(p=><option key={p.id} value={p.id}>{p.nome} — {p.perfil}</option>)}</select></label>
    <label>Buscar<input type="search" placeholder="Evento, profissional ou referência" maxLength={120} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>
    <button className="outline-gold" type="button" disabled={loading} onClick={load}>Atualizar</button>
   </div>
   {error&&<p role="alert" className="form-message">{error}</p>}
   <div className="audit-stats">
    <div><small>Eventos encontrados</small><strong>{loading?'…':rows.length}</strong></div>
    <div><small>Históricos registrados</small><strong>{loading?'…':recorded}</strong></div>
    <div><small>Registros operacionais</small><strong>{loading?'…':operational}</strong></div>
   </div>
   <p className="profile-notice">Período máximo de 366 dias, limitado aos 1.500 eventos mais recentes por consulta. Dados de pacientes e detalhes clínicos sensíveis não são expostos nesta listagem. Filtre por módulo ou responsável para refinar a busca.</p>
  </div>
  <div className="premium-panel">
   <div className="record-top"><h4>Eventos — {visible.length} resultado(s)</h4></div>
   {loading?<p>Carregando registros…</p>:!visible.length?<p className="record-empty">Nenhum evento encontrado nesse período ou filtro. Isso não comprova ausência de atividades em módulos ainda sem histórico.</p>:
    <div className="audit-table-scroller"><table className="audit-table"><thead><tr>
     <th>Data / horário</th><th>Módulo</th><th>Ação</th><th>Responsável</th><th>Referência / detalhe</th><th>Natureza</th>
    </tr></thead><tbody>{displayed.map(row=><tr key={row.evento_id}>
     <td>{fmt(row.ocorrido_em)}</td><td>{modules[row.modulo]||row.modulo}</td>
     <td><strong>{friendly(row.acao)}</strong></td>
     <td>{row.responsavel_nome||'Não identificado'}</td>
     <td><span>{row.detalhe||'—'}</span><small>{row.referencia_id?String(row.referencia_id).slice(0,8):''}</small></td>
     <td>{row.natureza==='historico'?'Histórico':'Registro operacional'}</td>
    </tr>)}</tbody></table></div>}
   {visible.length>pageSize&&<div className="audit-pagination">
    <button type="button" className="outline-gold" disabled={current<=1} onClick={()=>setPage(n=>Math.max(1,n-1))}>Anterior</button>
    <span>Página {current} de {maxPage}</span>
    <button type="button" className="outline-gold" disabled={current>=maxPage} onClick={()=>setPage(n=>Math.min(maxPage,n+1))}>Próxima</button>
   </div>}
  </div>
 </section>;
}
