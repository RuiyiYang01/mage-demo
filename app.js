'use strict';
const $=id=>document.getElementById(id);
const STAGES=['Select task','Attempt','Evaluate','Write correction','Dual memory','Retry','Harvest','Carry forward'];
let data,caseIndex=0,step=0,timer=null,graphTimer=null,focusCase=false,selectedNode=null;
const current=()=>data.cases[caseIndex];
const stageLabels=()=>current().stages?current().stages.map(s=>s.label):STAGES;
const lastStep=()=>stageLabels().length-1;
const iterationName=i=>i<0?'Initial':`Iteration ${i}`;
function stop(){clearInterval(timer);timer=null;$('play').textContent='Play evolution';}
function stopGraph(){clearInterval(graphTimer);graphTimer=null;$('graph-play').textContent='Animate growth';}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function snapshotFor(iteration){return Math.max(0,current().snapshots.findIndex(s=>s.iteration===iteration));}
function stage(next){
 step=next;const c=current();
 if(c.stages){customStage(next);return;}
 document.querySelectorAll('[data-step]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===step));b.tabIndex=i===step?0:-1;b.classList.toggle('completed',i<step);});
 $('stage-panel').setAttribute('aria-labelledby',`tab-${step}`);
 const cycle=step<5?c.failureIteration:c.successIteration;
 $('stage-iteration').textContent=iterationName(cycle);
 $('stage-kind').textContent=['Navigator · saved curriculum','Frozen learner · recorded answer','Critic · recorded failure','Guidance model · saved correction','Success + failure · illustrative bundle','Frozen learner · recorded recovery','Curator · saved success memory','EvoKG · next recorded state'][step];
 $('stage-title').textContent=['Choose the next learning target.','The learner makes a mistake.','Compare the answer with the target.','Turn the failure into reusable guidance.','Bring both kinds of experience together.','The same question is answered again.','The correct trace becomes experience.','Carry the expanded memory forward.'][step];
 const planned=c.plan.map(p=>`${p.skill}\n${p.reason}`).join('\n\n');
 $('stage-text').textContent=[
 planned||`Target task type: ${c.taskType}`,
 `Recorded wrong answer: ${c.wrongAnswer}\nTarget answer: ${c.expectedAnswer}`,
 `Task type: ${c.taskType}\nObserved answer: ${c.wrongAnswer}\nExpected answer: ${c.expectedAnswer}\nCorrection linked to skill: ${c.skillName}`,
 c.correction,'',c.successTrace,
 `Stored success memory: ${c.successNode}\nTask type: ${c.taskType}\nRecorded answer: ${c.answer}\n\n${c.successTrace}`,
 'Success memories and failure corrections are retained together. Future task-conditioned retrieval can draw from both stores.'
 ][step];
 $('stage-answer').textContent=step===1?c.wrongAnswer:step===5?c.answer:'';
 $('stage-answer').className=step===1?'wrong':'right';
 $('stage-note').textContent=[
 'The Navigator target is taken from this iteration’s saved plan. The example below is a recorded question from the same evolution cycle.',
 'The wrong answer is preserved in the failure-memory metadata; the complete original failed response was not saved here.',
 'The failure record preserves the wrong and expected answers. The comparison shown here is rendered from those fields.',
 `${c.teacher} wrote this correction. The execution backbone remains ${c.learner}, with frozen weights.`,
 'Illustrative selection from the preceding snapshot, not the exact historical prompt. These records share the question’s task type and existed before the recovery.',
 'This later success is recorded on the same evolution-pool question. The saved trace is displayed as recorded and may be abbreviated by the original logger.',
 'The correct answer and its available reasoning trace are saved as a success-memory node. The earlier correction remains in the graph.',
 'This view compares recorded snapshots. Nodes are the complete saved graph; the layout is grouped by node type.'
 ][step];
 $('memory-bundle').hidden=step!==4;$('stage-text').hidden=step===4;
 if(step===4)renderBundle();
 $('stage-delta').hidden=step!==7;
 if(step===7){
  const a=c.snapshots[snapshotFor(c.successIteration-1)],b=c.snapshots[snapshotFor(c.successIteration)];
  $('stage-delta').replaceChildren();const grid=el('div',undefined,'stage-delta-grid');
  for(const [count,label] of [[b.totalNodes-a.totalNodes,'net new graph nodes'],[b.successes-a.successes,'net new success memories']]){const box=el('div');box.append(el('strong',`+${count}`),el('span',label));grid.append(box);}$('stage-delta').append(grid);
 }
 $('previous').disabled=step===0;$('next').disabled=step===7;$('stage-counter').textContent=`${step+1} / 8`;
 const snap=step<=2?c.failureIteration-1:step<=4?c.bundle.sourceIteration:c.successIteration;
 $('iteration').value=String(snapshotFor(snap));
 focusCase=step>=3&&step<=6;$('graph-focus').setAttribute('aria-pressed',String(focusCase));
 selectedNode=step>=5?c.successNode:step===4?c.bundle.successes[0]?.id:step===3?c.failureNode:null;
 renderGraph();
 $('replay-state').replaceChildren(el('span',`Stage ${step+1}/8 · ${STAGES[step]}`),el('span',`Saved graph: ${iterationName(snap)} · ${c.learner} weights unchanged`));
}
function memoryCard(m,index,positive){
 const card=el('article',undefined,`memory-card${positive?'':' correction'}`);
 card.append(el('span',`${positive?'S':'F'}${index+1} · ${iterationName(m.iteration)}`,'memory-label'),el('p',m.question));
 const details=el('details');details.append(el('summary',positive?'Read the successful example':'Read the failure correction'),el('pre',m.text));
 card.append(details,el('p',`Answer: ${m.answer}`),el('div',`${m.taskType} · ${m.id}`,'memory-id'));return card;
}
function renderBundle(){
 const c=current(),b=c.bundle,root=$('memory-bundle');root.replaceChildren();
 root.append(el('div',`${iterationName(b.sourceIteration)} snapshot · task type: ${c.taskType}\nIllustrative bundle of real saved records`,'memory-bundle-head'));
 const columns=el('div',undefined,'bundle-columns');
 for(const [positive,memories,title] of [[true,b.successes,'1. Reuse a successful pattern'],[false,b.failures,'2. Correct a known mistake']]){
  if(!memories.length)continue;
  const column=el('div',undefined,'bundle-column');column.append(el('h4',title));memories.forEach((m,i)=>column.append(memoryCard(m,i,positive)));columns.append(column);
 }
 root.append(columns);if(!b.failures.length)root.append(el('p','No task-matched failure correction was saved for this example’s task type.','note'));const merge=el('div',undefined,'bundle-merge');merge.append(el('strong',`Saved experience for the frozen ${c.learner}`),el('span',b.failures.length?'Successful examples first · failure corrections second · current question last':'Successful examples · current question'));root.append(merge);
}
function selectCase(index){
 stop();stopGraph();caseIndex=index;selectedNode=null;const c=current();
 document.querySelectorAll('[data-case]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});
 $('case-panel').setAttribute('aria-labelledby',`case-tab-${index}`);
 $('case-title').textContent=c.title;$('question').textContent=c.displayQuestion||c.question;
 $('case-context').hidden=!c.context;$('context-text').textContent=c.context||'';
 $('earlier-label').textContent=c.mode==='heldout'?'Recorded output':c.mode==='trajectory'?'Saved sequence':'Earlier answer';
 $('later-label').textContent=c.mode==='heldout'?'Dataset reference':c.mode==='trajectory'?'Stored at':'Later answer';
 $('task-type').textContent=c.taskType.replace('gsm8k_','').replace('step','-step problem');
 $('run-meta').textContent=`${c.benchmark} · ${c.evidenceLabel} · ${c.learner}`;
 $('model-meta').textContent=`Execution: ${c.learner}\nGuidance: ${c.teacher}`;
 $('earlier-answer').textContent=c.wrongAnswer;$('later-answer').textContent=c.answer;
 $('bundle-badge').textContent=c.mode==='trajectory'?'Recorded action sequence':`${c.bundle.successes.length} success + ${c.bundle.failures.length} failure records`;
 const cycle=c.mode==='heldout'?['EVOLVE','FREEZE','MEMORY','ANSWER','SCORE']:c.mode==='trajectory'?['TASK','ACT','SEQUENCE','SAVE','REUSE']:['SELECT','EVALUATE','WRITE MEMORY','REUSE','HARVEST'];
 document.querySelectorAll('.cycle-strip span').forEach((n,i)=>n.textContent=cycle[i]);
 $('iteration').max=String(c.snapshots.length-1);
 $('source-info').textContent=`Run: experiments/${c.run}\nPlan: evolution_history.json, iteration ${c.failureIteration}\nFailure: iter_${c.failureIteration}/evokg.json → ${c.failureNode}\nRecovery: iter_${c.successIteration}/evokg.json → ${c.successNode}\nIllustrative memory pool: iter_${c.bundle.sourceIteration}/evokg.json`;
 if(c.sourceInfo)$('source-info').textContent=c.sourceInfo;
 buildStageTabs();stage(0);
}
function svgEl(tag,attrs={}){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
const nodeGroup=n=>['capability','principle','failure_memory','success_memory'].includes(n.type)?n.type:['action_recipe','success'].includes(n.type)?'success_memory':'context';
const COLORS={capability:['#c9dce5','#668d9f'],principle:['#ddd1ed','#9980b4'],failure_memory:['#ebc7a6','#ae7444'],success_memory:['#bfdb94','#638b3c'],context:['#d2e4df','#588580']};
function inspect(node){
 selectedNode=node.id;$('node-select').value=node.id;
 $('node-name').textContent=node.name;$('node-description').textContent=node.text+(node.excerpt?'\n[Display excerpt]':'');
 $('node-type').textContent=node.type.replaceAll('_',' ');
 $('node-id').textContent=`${node.id}\nFirst observed: ${iterationName(node.firstSeen)}${node.taskType?'\nTask: '+node.taskType:''}`;
 document.querySelectorAll('.graph-node').forEach(group=>{const active=group.dataset.id===node.id;group.setAttribute('tabindex',active?'0':'-1');const circle=group.querySelector('circle');circle.setAttribute('stroke-width',active?'3':group.classList.contains('new-node')?'1.4':'.5');});
}
function renderGraph(){
 const c=current(),snap=c.snapshots[Number($('iteration').value)],visible=new Set(snap.nodeIds),fresh=new Set(snap.newIds);
 const nodeMap=new Map(c.nodes.map(n=>[n.id,n]));
 $('iteration-label').textContent=iterationName(snap.iteration);
 const timeline=$('snapshot-timeline');timeline.replaceChildren();
 c.snapshots.forEach((s,i)=>{const b=el('button');b.setAttribute('aria-current',String(i===Number($('iteration').value)));b.setAttribute('aria-label',`${iterationName(s.iteration)}: ${s.totalNodes} nodes`);b.append(el('strong',iterationName(s.iteration)),el('span',`${s.totalNodes} nodes`));const bar=el('i',undefined,'mini-bar');bar.style.width=`${100*s.totalNodes/c.nodes.length}%`;b.append(bar);b.onclick=()=>{stop();stopGraph();$('iteration').value=i;renderGraph();};timeline.append(b);});
 const types=['capability','principle','failure_memory','success_memory','context'];
 const centers={capability:{x:118,y:245,r:70},context:{x:118,y:487,r:47},principle:{x:350,y:150,r:82},failure_memory:{x:350,y:418,r:87},success_memory:{x:755,y:285,r:188}};
 const positions=new Map();
 for(const type of types){const nodes=c.nodes.filter(n=>nodeGroup(n)===type),center=centers[type];nodes.forEach((n,i)=>{const angle=i*2.3999632297,rad=center.r*Math.sqrt((i+.5)/Math.max(1,nodes.length));positions.set(n.id,{x:center.x+Math.cos(angle)*rad,y:center.y+Math.sin(angle)*rad});});}
 const focal=new Map([[c.failureNode,'Correction'],[c.successNode,'Recovery']]);c.bundle.successes.forEach((m,i)=>focal.set(m.id,`S${i+1}`));c.bundle.failures.forEach((m,i)=>focal.set(m.id,`F${i+1}`));
 const svg=$('graph-svg');svg.replaceChildren();
 for(const type of types){const center=centers[type],label=svgEl('text',{x:center.x,y:center.y-center.r-30,'text-anchor':'middle',class:'cluster-name'});label.textContent=type==='capability'?'CAPABILITIES':type==='principle'?'PRINCIPLES':type==='failure_memory'?'FAILURE CORRECTIONS':type==='context'?'TASKS / ENVIRONMENT':c.mode==='trajectory'?'ACTION EXPERIENCE':'SUCCESS MEMORIES';svg.append(label);const count=svgEl('text',{x:center.x,y:center.y-center.r-12,'text-anchor':'middle',class:'cluster-count'});count.textContent=`${c.nodes.filter(n=>nodeGroup(n)===type&&visible.has(n.id)).length} saved nodes`;svg.append(count);}
 const edgeLayer=svgEl('g',{'aria-hidden':'true'});svg.append(edgeLayer);
 for(const edge of snap.edges){const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b||!visible.has(edge.source)||!visible.has(edge.target))continue;const line=svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#a4b7a8','stroke-width':.8,opacity:focusCase?.18:.55});const title=svgEl('title');title.textContent=`${edge.source} → ${edge.target}: ${edge.relation}`;line.append(title);edgeLayer.append(line);}
 if(focusCase){
  const task={x:505,y:290};
  for(const[id]of focal){if(!visible.has(id)||nodeMap.get(id)?.taskType!==c.taskType)continue;const p=positions.get(id);svg.append(svgEl('line',{x1:task.x,y1:task.y,x2:p.x,y2:p.y,stroke:'#527247','stroke-width':1.4,class:'task-link'}));}
  const rect=svgEl('rect',{x:450,y:270,width:110,height:40,rx:7,fill:'#f7faf2',stroke:'#7b926d','stroke-dasharray':'4 3'});svg.append(rect);const label=svgEl('text',{x:505,y:294,'text-anchor':'middle'});label.textContent='Case task type';svg.append(label);
 }
 const ordered=c.nodes.filter(n=>visible.has(n.id)).sort((a,b)=>Number(focal.has(a.id))-Number(focal.has(b.id)));
 for(const node of ordered){
  const p=positions.get(node.id);if(!p)continue;const isFocal=focal.has(node.id),isNew=fresh.has(node.id),color=COLORS[nodeGroup(node)]||COLORS.context;
  const group=svgEl('g',{class:`graph-node${isNew?' new-node':''}`,tabindex:-1,role:'button','aria-label':`Inspect ${node.name}`,'data-id':node.id,opacity:focusCase&&!isFocal?.16:1});
  const r=isFocal?8:node.type==='capability'?8:node.type==='principle'?6:node.type==='failure_memory'?6:3.6;
  group.append(svgEl('circle',{cx:p.x,cy:p.y,r,fill:color[0],stroke:isNew?'#3f5a34':color[1],'stroke-width':isNew?1.4:.5}));
  if(isFocal){group.append(svgEl('circle',{cx:p.x,cy:p.y,r:r+4,fill:'none',stroke:color[1],'stroke-width':1,opacity:.6,'pointer-events':'none'}));if(focusCase){const label=svgEl('text',{x:p.x+14,y:p.y+4,class:'case-label'});label.textContent=focal.get(node.id);group.append(label);}}
  const title=svgEl('title');title.textContent=`${node.name}\n${node.id}${isNew?' · NEW':''}`;group.append(title);
  group.onclick=()=>inspect(node);group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(node);}};svg.append(group);
 }
 $('node-select').replaceChildren();for(const node of ordered.slice().sort((a,b)=>Number(focal.has(b.id))-Number(focal.has(a.id)))){const option=el('option',`${fresh.has(node.id)?'NEW · ':''}${node.type.replaceAll('_',' ')} · ${node.name.slice(0,90)}`);option.value=node.id;$('node-select').append(option);}
 const selected=visible.has(selectedNode)?nodeMap.get(selectedNode):nodeMap.get(visible.has(c.successNode)?c.successNode:visible.has(c.failureNode)?c.failureNode:snap.nodeIds[0]);if(selected)inspect(selected);
 $('graph-stats').replaceChildren();for(const[value,label]of[[snap.totalNodes,'Graph nodes'],[c.mode==='trajectory'?(snap.recipes||0):snap.successes,c.mode==='trajectory'?'Action recipes':'Success memories'],[snap.failures,'Failure corrections'],[snap.principles,'Principles']]){const b=el('div');b.append(el('strong',value),el('span',label));$('graph-stats').append(b);}
 const addCounts={};for(const id of snap.newIds){const t=nodeMap.get(id)?.type;addCounts[t]=(addCounts[t]||0)+1;}
 $('graph-change').textContent=snap.iteration<0?`Starting state: ${snap.totalNodes} nodes. ${snap.initialSource==='recorded'?'Recorded discovery snapshot.':'Structural projection of the first saved snapshot.'}`:`New since the previous snapshot: ${snap.newIds.length} nodes · ${addCounts.success_memory||0} successes · ${addCounts.failure_memory||0} corrections · ${addCounts.principle||0} principles · ${addCounts.action_recipe||0} action recipes. ${snap.totalEdges} recorded edges in this snapshot.`;
}
function buildStageTabs(){
 const root=document.querySelector('.step-tabs');root.replaceChildren();
 stageLabels().forEach((label,i)=>{const b=el('button',String(i+1).padStart(2,'0'));b.id=`tab-${i}`;b.dataset.step=i;b.setAttribute('role','tab');b.setAttribute('aria-controls','stage-panel');b.append(el('span',label));b.onclick=()=>{stop();stopGraph();stage(i);};b.onkeydown=e=>{let n;const total=stageLabels().length;if(e.key==='ArrowRight')n=(step+1)%total;if(e.key==='ArrowLeft')n=(step+total-1)%total;if(e.key==='Home')n=0;if(e.key==='End')n=total-1;if(n!==undefined){e.preventDefault();stop();stopGraph();stage(n);$(`tab-${n}`).focus();}};root.append(b);});
}
function customStage(next){
 const c=current(),s=c.stages[next];
 document.querySelectorAll('[data-step]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===next));b.tabIndex=i===next?0:-1;b.classList.toggle('completed',i<next);});
 $('stage-panel').setAttribute('aria-labelledby',`tab-${next}`);
 $('stage-kind').textContent=c.evidenceLabel;$('stage-iteration').textContent=iterationName(s.iteration);
 $('stage-title').textContent=s.title;$('stage-text').textContent=s.text;
 $('stage-answer').textContent=s.answer||'';$('stage-answer').className=c.mode==='trajectory'?'case-stage-action':'right';
 $('stage-note').textContent=s.note||'The graph below follows the corresponding saved state.';
 $('memory-bundle').hidden=!s.bundle;$('stage-text').hidden=!!s.bundle;$('stage-delta').hidden=true;
 if(s.bundle)renderBundle();
 $('previous').disabled=next===0;$('next').disabled=next===lastStep();$('stage-counter').textContent=`${next+1} / ${c.stages.length}`;
 $('iteration').value=String(snapshotFor(s.iteration));focusCase=!!s.bundle;
 $('graph-focus').setAttribute('aria-pressed',String(focusCase));selectedNode=next===2?c.failureNode:next>=3?c.successNode:null;renderGraph();
 $('replay-state').replaceChildren(el('span',`${c.benchmark} · ${c.evidenceLabel}`),el('span',`Saved graph: ${iterationName(s.iteration)} · model weights unchanged`));
}
async function init(){
 try{
  const response=await fetch('replays.json?v=3');if(!response.ok)throw new Error('Replay data unavailable');data=await response.json();
  data.cases.forEach((c,i)=>{const b=el('button');b.id=`case-tab-${i}`;b.dataset.case=i;b.setAttribute('role','tab');b.setAttribute('aria-controls','case-panel');b.append(el('small',c.benchmark),el('strong',c.title));b.onclick=()=>selectCase(i);b.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%data.cases.length;if(e.key==='ArrowLeft')n=(i+data.cases.length-1)%data.cases.length;if(e.key==='Home')n=0;if(e.key==='End')n=data.cases.length-1;if(n!==undefined){e.preventDefault();selectCase(n);$(`case-tab-${n}`).focus();}};$('case-tabs').append(b);});

  $('previous').onclick=()=>{stop();stopGraph();stage(Math.max(0,step-1));};$('next').onclick=()=>{stop();stopGraph();stage(Math.min(lastStep(),step+1));};
  $('play').onclick=()=>{if(timer){stop();return;}stopGraph();if(step===lastStep())stage(0);$('play').textContent='Pause';timer=setInterval(()=>{if(step<lastStep())stage(step+1);if(step===lastStep())stop();},6500);};
  $('iteration').oninput=()=>{stop();stopGraph();renderGraph();};
  $('graph-focus').onclick=()=>{focusCase=!focusCase;$('graph-focus').setAttribute('aria-pressed',String(focusCase));renderGraph();};
  $('node-select').onchange=e=>inspect(current().nodes.find(n=>n.id===e.target.value));
  $('graph-play').onclick=()=>{if(graphTimer){stopGraph();return;}stop();focusCase=false;$('graph-focus').setAttribute('aria-pressed','false');$('iteration').value=0;renderGraph();$('graph-play').textContent='Pause growth';graphTimer=setInterval(()=>{const next=Number($('iteration').value)+1;$('iteration').value=next;renderGraph();if(next>=current().snapshots.length-1)stopGraph();},1800);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();stopGraph();}});
  for(const r of data.results){const tr=el('tr');[r.benchmark,r.baseline.toFixed(1),`${r.sonnet.toFixed(1)} ± ${r.sonnetStd.toFixed(1)} (n=${r.sonnetN})`,`${r.opus.toFixed(1)} ± ${r.opusStd.toFixed(1)} (n=${r.opusN})`,`+${(Math.max(r.sonnet,r.opus)-r.baseline).toFixed(1)} pp`].forEach(v=>tr.append(el('td',v)));$('results-body').append(tr);}
  $('replay-app').hidden=false;selectCase(0);
 }catch(error){$('load-error').hidden=false;console.error(error);}
}
init();

// Citation controls are independent of replay-data loading.
$('copy-citation').addEventListener('click',async()=>{
 const citation=$('bibtex').textContent;
 try{
  if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(citation);
  $('citation-status').textContent='BibTeX copied.';
 }catch{
  const selection=window.getSelection(),range=document.createRange();
  range.selectNodeContents($('bibtex'));selection.removeAllRanges();selection.addRange(range);$('bibtex').focus();
  $('citation-status').textContent='Citation selected. Press Ctrl+C or Command+C to copy, or download the .bib file.';
 }
});
