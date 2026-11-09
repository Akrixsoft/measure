/* Application route legend: conditional notation, not a building standard. */
(() => {
  'use strict';
  if(window.MeasureLabRouteCatalog)return;
  const types=[
    {id:'el',label:'Электрика',short:'ЭЛ',color:'#E07A00',dash:[20,4]},
    {id:'lo',label:'Слаботочка',short:'СС',color:'#7B3FC4',dash:[8,4]},
    {id:'wa',label:'ХВС',short:'ХВ',color:'#3D9BFF',dash:[14,4]},
    {id:'wh',label:'ГВС',short:'ГВ',color:'#FF5C5C',dash:[14,3,2,3]},
    {id:'dr',label:'Канализация',short:'К',color:'#8D6E63',dash:[3,4]},
    {id:'ht',label:'Отопление',short:'ОТ',color:'#D455B0',dash:[14,3,2,3,2,3]},
    {id:'ufh',label:'Тёплый пол',short:'ТП',color:'#D93263',dash:[8,3,8,7]},
    {id:'ga',label:'Газ',short:'Г',color:'#C98A00',dash:[18,4,3,4]},
    {id:'ve',label:'Вентиляция',short:'ВЕН',color:'#1FA98F',dash:[2,3,2,7]},
    {id:'ot',label:'Другое',short:'ДР',color:'#7B8795',dash:[6,6]}
  ];
  const byId=Object.fromEntries(types.map(t=>[t.id,t]));
  const get=id=>byId[id]||byId.ot;
  const pattern=(id,dpi=1)=>get(id).dash.map(n=>n*dpi);
  const style=(q,dpi=1)=>{const t=get(q?.t),dash=q?.dash==null?[10*dpi,4*dpi]:q.dash?(pattern(t.id,dpi).length?pattern(t.id,dpi):[10*dpi,4*dpi]):[];return {color:t.color,dash,short:t.short,shortcode:t.short,label:t.label};};
  const api=window.MeasureLabRouteCatalog={types,byId,get,pattern,style};
  // Preserve references and all historical keys used by native import/export.
  for(const t of types){const row=RT_T.find(r=>r[0]===t.id);if(row)row[1]=t.label;else RT_T.push([t.id,t.label]);RT_C[t.id]=t.color;}
  if(window.PM)PM.labRouteCatalog=api;
})();
