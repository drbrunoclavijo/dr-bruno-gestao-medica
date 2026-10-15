import React,{useEffect,useState} from 'react';
export default function TestInventory({supabase,role}){
 const doctor=role==='medico';
 const [products,setProducts]=useState([]),[lots,setLots]=useState([]),[links,setLinks]=useState([]),[items,setItems]=useState([]),[patients,setPatients]=useState([]);
 const [name,setName]=useState(''),[unit,setUnit]=useState('unidade'),[product,setProduct]=useState(''),[lot,setLot]=useState(''),[expiry,setExpiry]=useState(''),[qty,setQty]=useState('');
 const [bindItem,setBindItem]=useState(''),[bindProduct,setBindProduct]=useState(''),[bindQty,setBindQty]=useState('1');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function load(){
  setLoading(true);setError('');
  const [a,b,c]=await Promise.all([
   supabase.from('estoque_produtos_teste').select('id,nome,unidade,ativo').order('nome'),
   supabase.from('estoque_lotes_teste').select('id,produto_id,lote,validade,saldo,quantidade_inicial').order('validade'),
   supabase.from('estoque_vinculos_teste').select('item_prescricao_id,produto_id,quantidade')
  ]);
  const first=[a,b,c].find(r=>r.error);
  if(first){setError('Não foi possível carregar estoque: '+first.error.message);setLoading(false);return;}
  setProducts(a.data||[]);setLots(b.data||[]);setLinks(c.data||[]);
  if(doctor){
   const [r,pa]=await Promise.all([supabase.from('prescricoes_teste').select('id,paciente_id').order('criado_em',{ascending:false}).limit(100),supabase.from('pacientes').select('id,nome').limit(100)]);
   if(r.error||pa.error){setError('Falha ao carregar prescrições para vinculação: '+(r.error||pa.error).message);}
   else{
    setPatients(pa.data||[]);
    const ids=(r.data||[]).map(p=>p.id);
    if(ids.length){
     const it=await supabase.from('prescricao_itens_teste').select('id,prescricao_id,medicamento,dose,via').in('prescricao_id',ids);
     if(it.error)setError('Falha ao carregar itens: '+it.error.message);
     else setItems((it.data||[]).map(i=>({...i,paciente_id:(r.data||[]).find(p=>p.id===i.prescricao_id)?.paciente_id})));
    }else setItems([]);
   }
  }
  setLoading(false);
 }
 useEffect(()=>{load()},[role]);
 async function call(fn,args,success){
  setBusy(true);setError('');setMessage('');
  const {error}=await supabase.rpc(fn,args);
  if(error)setError(error.message);else{setMessage(success);await load();}
  setBusy(false);
 }
 const saldo=id=>lots.filter(l=>l.produto_id===id).reduce((n,l)=>n+Number(l.saldo),0);
 const unlinked=items.filter(i=>!links.some(l=>l.item_prescricao_id===i.id));
 return <section className="premium-panel inventory-test">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">▣</span><div><h3>Estoque de testes</h3><p>Produtos, lotes, validade e baixa pela checagem da enfermagem.</p></div></div>
  <p className="profile-notice">Somente materiais e saldos fictícios. Não é um controle de dispensação ou estoque clínico validado. O desconto ocorre ao confirmar a checagem fictícia, no lote válido com vencimento mais próximo.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}{message&&<p className="form-message" role="status">{message}</p>}
  <div className="record-top"><h4>Produtos e saldos</h4><button type="button" className="outline-gold" disabled={loading||busy} onClick={load}>Atualizar</button></div>
  {loading?<p>Carregando...</p>:products.length===0?<p className="record-empty">Nenhum produto fictício cadastrado.</p>:<div className="record-list">{products.map(p=><div key={p.id} className="form-section inventory-product">
   <div className="administration-heading"><strong>{p.nome}</strong><span>{saldo(p.id)} {p.unidade} restantes (todos os lotes)</span></div>
   {lots.filter(l=>l.produto_id===p.id).map(l=><p key={l.id}>Lote {l.lote} · Validade {l.validade?.split('-').reverse().join('/')} · Saldo {l.saldo} / {l.quantidade_inicial} {p.unidade}</p>)}
  </div>)}</div>}
  {doctor&&<div className="inventory-management">
   <div className="form-section"><h4>Cadastrar produto fictício</h4><form className="clinical-fields" onSubmit={e=>{e.preventDefault();call('criar_produto_estoque_teste',{p_nome:name,p_unidade:unit},'Produto criado.');setName('');}}>
    <label>Nome<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Unidade (ex.: ampola, frasco, mL)<input required maxLength={30} value={unit} onChange={e=>setUnit(e.target.value)}/></label>
    <button className="gold-button" disabled={busy}>Cadastrar produto</button>
   </form></div>
   <div className="form-section"><h4>Adicionar lote fictício</h4><form className="clinical-fields" onSubmit={e=>{e.preventDefault();call('adicionar_lote_estoque_teste',{p_produto_id:product,p_lote:lot,p_validade:expiry,p_quantidade:Number(qty)},'Lote incluído.');setLot('');setQty('');}}>
    <label>Produto<select required value={product} onChange={e=>setProduct(e.target.value)}><option value="">Selecione</option>{products.map(p=><option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select></label>
    <label>Número do lote<input required maxLength={100} value={lot} onChange={e=>setLot(e.target.value)}/></label>
    <label>Validade<input required type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
    <label>Quantidade recebida<input required type="number" min="0.001" step="0.001" value={qty} onChange={e=>setQty(e.target.value)}/></label>
    <button className="gold-button" disabled={busy}>Salvar lote</button>
   </form></div>
   <div className="form-section"><h4>Vincular prescrição ao estoque</h4><p>Associe cada item fictício ao produto e à quantidade que será descontada quando a Dra. Carol confirmar a checagem.</p><form className="clinical-fields" onSubmit={e=>{e.preventDefault();call('vincular_item_estoque_teste',{p_item_id:bindItem,p_produto_id:bindProduct,p_quantidade:Number(bindQty)},'Item vinculado ao estoque.');setBindItem('');}}>
    <label>Item prescrito<select required value={bindItem} onChange={e=>setBindItem(e.target.value)}><option value="">Selecione</option>{unlinked.map(i=><option key={i.id} value={i.id}>{patients.find(p=>p.id===i.paciente_id)?.nome||'Paciente'} · {i.medicamento} · {i.dose}</option>)}</select></label>
    <label>Produto do estoque<select required value={bindProduct} onChange={e=>setBindProduct(e.target.value)}><option value="">Selecione</option>{products.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select></label>
    <label>Quantidade a descontar por checagem<input type="number" required min="0.001" step="0.001" value={bindQty} onChange={e=>setBindQty(e.target.value)}/></label>
    <button className="gold-button" disabled={busy||!unlinked.length}>Vincular ao estoque</button>
   </form></div>
  </div>}
 </section>;
}