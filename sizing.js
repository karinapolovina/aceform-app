window.ACEFORM_SIZING = {
 rows: [
  {size:'S',bust:[87,90],waist:[67,70],hips:[93,96]},
  {size:'M',bust:[91,94],waist:[71,74],hips:[97,100]},
  {size:'L',bust:[95,98],waist:[75,78],hips:[101,104]}
 ],
 fields(product) {return product==='top'?['bust','waist']:product==='dress'?['bust','waist','hips']:['waist','hips'];},
 recommend(product,measurements) {
  const fields=this.fields(product);
  if(fields.some(k=>!Number.isFinite(measurements[k])||measurements[k]<=0))return {kind:'missing'};
  const matches=fields.map(k=>this.rows.find(r=>measurements[k]>=r[k][0]&&measurements[k]<=r[k][1])?.size);
  if(matches.some(s=>!s))return {kind:'outside'};
  return new Set(matches).size===1?{kind:'match',size:matches[0]}:{kind:'mixed'};
 }
};
