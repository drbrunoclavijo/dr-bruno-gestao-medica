// Simulador sem banco: cada linha é um custo de um item em uma sessão.
export const protocolTotals=(items,visits=0,minutesPerVisit=0,hourCost=0,monthlyFixed=0,monthlyVolume=1)=>{
 const nums=[visits,minutesPerVisit,hourCost,monthlyFixed,monthlyVolume].map(Number);
 if(nums.some(n=>!Number.isFinite(n)||n<0)||nums[4]<=0||!Number.isInteger(nums[0])||nums[0]>100||nums[1]>1440||!Array.isArray(items)||items.length>200)return null;
 let supplies=0;
 for(const item of items){
  const count=Number(item.sessions),units=Number(item.quantity),unitCost=Number(item.unitCost);
  if(!Number.isInteger(count)||count<0||count>100||[units,unitCost].some(n=>!Number.isFinite(n)||n<0))return null;
  supplies+=count*units*unitCost;
 }
 const labor=nums[0]*nums[1]*nums[2]/60;
 const fixed=nums[0]*nums[3]/nums[4];
 return {supplies,labor,fixed,total:supplies+labor+fixed};
};
