import React,{useEffect,useState} from 'react';
import StockAlerts from './StockAlerts.jsx';
export default function TestInventory({supabase,role}){
 const doctor=role==='medico';
 const canRegister=['medico','enfermeira','equipe'].includes(role);
 const brl=n=>n===null||n===undefined?'Custo não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n));
 // Armazenar somente os centavos digitados; converter para reais ao salvar.
 const displayCost=digits=>digits?brl(Number(digits)/100):'';
 const parseCost=digits=>Number(digits)/100;
 const [products,setProducts]=useState([]),[lots,setLots]=useState([]),[links,setLinks]=useState([]),[items,setItems]=useState([]),[patients,setPatients]=useState([]);
 const [name,setName]=useState(''),[productType,setProductType]=useState('medicamento'),[unit,setUnit]=useState('unidade'),[product,setProduct]=useState(''),[lot,setLot]=useState(''),[expiry,setExpiry]=useState(''),[qty,setQty]=useState(''),[cost,setCost]=useState('');
 const [bindItem,setBindItem]=useState(''),[bindProduct,setBindProduct]=useState(''),[bindQty,setBindQty]=useState('1');
 const [minDraft,setMinDraft]=useState({});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function load(){
  setLoading(true);setError('');
  const [a,b]=await Promise.all([
   supabase.from('estoque_produtos_teste').select('id,nome,unidade,ativo,tipo_produto,estoque_minimo').order('nome'),
   supabase.from('estoque_lotes_teste').select('id,produto_id,lote,validade,saldo,quantidade_inicial,custo_total_aquisicao').order('validade')
  ]);
  const first=[a,b].find(r=>r.error);
  if(first){setError('Não foi possível carregar estoque: '+first.error.message);setLoading(false);return;}
  setProducts(a.data||[]);setLots(b.data||[]);
  setMinDraft(Object.fromEntries((a.data||[]).map(p=>[p.id,String(p.estoque_minimo??5)])));
  if(doctor){
   const vl=await supabase.from('estoque_vinculos_teste').select('item_prescricao_id,produto_id,quantidade');
   if(vl.error){setError('Falha ao carregar vínculos de prescrições: '+vl.error.message);setLinks([]);}else setLinks(vl.data||[]);
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
  }else{setLinks([]);setItems([]);setPatients([]);}
  setLoading(false);
 }
 useEffect(()=>{load()},[role]);
 async function call(fn,args,success){
  setBusy(true);setError('');setMessage('');
  const {error}=await supabase.rpc(fn,args);
  if(error)setError(error.message);else{await load();setMessage(success);}
  setBusy(false);
 }
 const saldo=id=>lots.filter(l=>l.produto_id===id).reduce((n,l)=>n+Number(l.saldo),0);
 const lotValue=l=>l.custo_total_aquisicao===null?null:Number(l.custo_total_aquisicao)*Number(l.saldo)/Number(l.quantidade_inicial);
 const knownValue=lots.reduce((sum,l)=>sum+(lotValue(l)??0),0);
 const missingCost=lots.some(l=>l.custo_total_aquisicao===null);
 const unlinked=items.filter(i=>!links.some(l=>l.item_prescricao_id===i.id));
 async function saveMinimum(product){
  const value=Number(minDraft[product.id]);
  if(!Number.isFinite(value)||value<0||value>1000000||Math.abs(Math.round(value*1000)-value*1000)>0.000001){
   setError('Informe mínimo válido com até três casas decimais.');return;
  }
  await call('definir_estoque_minimo_teste',{p_produto_id:product.id,p_minimo:value},'Mínimo do estoque fictício atualizado.');
 }
 return <section className="premium-panel inventory-test">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">▣</span><div><h3>Estoque de testes</h3><p>Medicamentos e insumos, com lote, custo, validade e baixa pela checagem.</p></div></div>
  <p className="profile-notice">Somente materiais e saldos fictícios. Não é um controle de dispensação ou estoque clínico validado. O desconto ocorre ao confirmar a checagem fictícia, no lote válido com vencimento mais próximo.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}{message&&<p className="form-message" role="status">{message}</p>}
  <StockAlerts supabase={supabase}/>
  <div className="record-top"><h4>Produtos e saldos</h4><button type="button" className="outline-gold" disabled={loading||busy} onClick={load}>Atualizar</button></div>
  {!loading&&<p className="inventory-cost-overview">Valor estimado do saldo (lotes com custo): <strong>{brl(knownValue)}</strong>{missingCost&&<span> · Alguns lotes antigos ainda não possuem custo cadastrado.</span>}</p>}
  {loading?<p>Carregando...</p>:products.length===0?<p className="record-empty">Nenhum produto fictício cadastrado.</p>:<div className="record-list">{products.map(p=><div key={p.id} className="form-section inventory-product">
   <div className="administration-heading"><strong>{p.nome} · {p.tipo_produto==='insumo'?'Insumo':'Medicamento'}</strong><span>{saldo(p.id)} {p.unidade} restantes (todos os lotes)</span></div>
   {doctor&&<div className="inventory-minimum-edit"><label>Alerta quando saldo válido estiver até
      <input type="number" min="0" max="1000000" step="0.001" value={minDraft[p.id]??'5'}
       onChange={e=>setMinDraft(old=>({...old,[p.id]:e.target.value}))}/></label>
     <span>{p.unidade}</span><button type="button" className="outline-gold" disabled={busy||loading} onClick={()=>saveMinimum(p)}>Salvar mínimo</button></div>}
   {lots.filter(l=>l.produto_id===p.id).map(l=><p key={l.id}>Lote {l.lote} · Validade {l.validade?.split('-').reverse().join('/')} · Saldo {l.saldo} / {l.quantidade_inicial} {p.unidade} · Custo de aquisição: {brl(l.custo_total_aquisicao)} · Custo unitário: {l.custo_total_aquisicao===null?'Não informado':brl(Number(l.custo_total_aquisicao)/Number(l.quantidade_inicial))} · Valor do saldo: {brl(lotValue(l))}</p>)}
  </div>)}</div>}
  {canRegister&&<div className="inventory-management">
   <div className="form-section"><h4>Cadastrar produto fictício</h4><form className="clinical-fields" onSubmit={async e=>{e.preventDefault();await call(productType==='insumo'?'criar_insumo_estoque_teste':'criar_produto_estoque_teste',{p_nome:name,p_unidade:unit},'Produto fictício criado.');}}>
    <label>Tipo de produto<select value={productType} onChange={e=>setProductType(e.target.value)}><option value="medicamento">Medicamento</option><option value="insumo">Insumo (soro, equipo, Jelco etc.)</option></select></label>
    <label>Nome<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Unidade (ex.: ampola, frasco, mL)<input required maxLength={30} value={unit} onChange={e=>setUnit(e.target.value)}/></label>
    <button className="gold-button" disabled={busy}>Cadastrar produto</button>
   </form></div>
   <div className="form-section"><h4>Adicionar lote fictício</h4><form className="clinical-fields" onSubmit={e=>{e.preventDefault();call('adicionar_lote_estoque_teste',{p_produto_id:product,p_lote:lot,p_validade:expiry,p_quantidade:Number(qty),p_custo_total:parseCost(cost)},'Lote fictício incluído com custo de aquisição.');}}>
    <label>Produto<select required value={product} onChange={e=>setProduct(e.target.value)}><option value="">Selecione</option>{products.map(p=><option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select></label>
    <label>Número do lote<input required maxLength={100} value={lot} onChange={e=>setLot(e.target.value)}/></label>
    <label>Validade<input required type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
    <label>Quantidade recebida<input required type="number" min="0.001" step="0.001" value={qty} onChange={e=>setQty(e.target.value)}/></label>
    <label>Custo total de aquisição do lote (R$)<input required type="text" inputMode="numeric" autoComplete="off" placeholder="R$ 0,00" value={displayCost(cost)} onChange={e=>setCost(e.target.value.replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,10))}/></label>
    <button className="gold-button" disabled={busy}>Salvar lote</button>
   </form></div>
   {doctor&&<div className="form-section"><h4>Vincular prescrição ao estoque</h4><p>Associe cada item fictício ao produto e à quantidade que será descontada quando a Dra. Carol confirmar a checagem.</p><form className="clinical-fields" onSubmit={e=>{e.preventDefault();call('vincular_item_estoque_teste',{p_item_id:bindItem,p_produto_id:bindProduct,p_quantidade:Number(bindQty)},'Item vinculado ao estoque.');setBindItem('');}}>
    <label>Item prescrito<select required value={bindItem} onChange={e=>setBindItem(e.target.value)}><option value="">Selecione</option>{unlinked.map(i=><option key={i.id} value={i.id}>{patients.find(p=>p.id===i.paciente_id)?.nome||'Paciente'} · {i.medicamento} · {i.dose}</option>)}</select></label>
    <label>Produto do estoque<select required value={bindProduct} onChange={e=>setBindProduct(e.target.value)}><option value="">Selecione</option>{products.filter(p=>p.ativo&&p.tipo_produto!=='insumo').map(p=><option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}</select></label>
    <label>Quantidade a descontar por checagem<input type="number" required min="0.001" step="0.001" value={bindQty} onChange={e=>setBindQty(e.target.value)}/></label>
    <button className="gold-button" disabled={busy||!unlinked.length}>Vincular ao estoque</button>
   </form></div>}
  </div>}
 </section>;
}