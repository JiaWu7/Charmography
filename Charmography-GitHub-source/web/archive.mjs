export function initArchive(doc=document, options={}) {
  const records=options.records??JSON.parse(doc.getElementById('archive-records').textContent);
  const get=id=>doc.getElementById(id);
  const dialog=get('record-dialog'),buttons=[...doc.querySelectorAll('[data-record-id]')];
  const location=options.location??globalThis.location,history=options.history??globalThis.history;
  const events=options.window??globalThis.window;
  let current=-1,opener=null,previousOverflow='';

  function setHash(id) {
    if(!location?.href||!history?.replaceState)return;
    try {const url=new URL(location.href);url.hash=id;history.replaceState(history.state,'',url);}catch{}
  }
  function render(index) {
    const record=records[index];if(!record)return false;
    current=index;
    get('record-owner').textContent=record.owner;
    get('record-number').textContent=`RECORD ${String(index+1).padStart(3,'0')} / ${record.owner}`;
    get('record-title').textContent=record.title;
    get('record-quote').textContent=record.quote;
    for(const key of ['origin','accumulation','outcome'])get('record-'+key).textContent=record[key];
    get('record-photo').setAttribute('viewBox',record.crop.join(' '));
    get('record-caption').textContent=record.photoCaption;
    get('record-position').textContent=`${String(index+1).padStart(2,'0')} / ${String(records.length).padStart(2,'0')}`;
    get('record-previous').disabled=index===0;
    get('record-next').disabled=index===records.length-1;
    dialog.scrollTop=0;
    setHash(record.id);
    return true;
  }
  function open(index,from=doc.activeElement) {
    if(!render(index))return;
    if(!dialog.open) {
      opener=from;previousOverflow=doc.body.style.overflow;
      doc.body.style.overflow='hidden';dialog.showModal();
    }
  }
  function move(direction) {if(dialog.open)render(current+direction);}
  buttons.forEach(button=>button.addEventListener('click',()=>open(records.findIndex(r=>r.id===button.dataset.recordId),button)));
  get('record-close').addEventListener('click',()=>dialog.close());
  get('record-previous').addEventListener('click',()=>move(-1));
  get('record-next').addEventListener('click',()=>move(1));
  dialog.addEventListener('close',()=>{
    doc.body.style.overflow=previousOverflow;setHash('');
    opener?.focus({preventScroll:true});opener=null;
  });
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const b=dialog.getBoundingClientRect();
    if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();
  });
  dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}
    if(event.key==='ArrowRight'){event.preventDefault();move(1);}
  });
  function followHash() {
    const id=location?.hash?.slice(1),index=records.findIndex(r=>r.id===id);
    if(index>=0)open(index,buttons[index]);
    else if(dialog.open)dialog.close();
  }
  events?.addEventListener('hashchange',followHash);
  const about=get('about-dialog');
  get('about-button').addEventListener('click',()=>about.showModal());
  get('dialog-close').addEventListener('click',()=>about.close());
  about.addEventListener('click',event=>{
    if(event.target!==about)return;
    const b=about.getBoundingClientRect();
    if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)about.close();
  });
  followHash();
  return {open,move,get current(){return current;},records};
}
if(typeof document!=='undefined')initArchive(document);
