const PREVIEW_ONLY = false;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg','image/png','image/webp']);

export function initCollect(doc = document, options = {}) {
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const objectURLs = options.URL ?? globalThis.URL;
  const pageLocation = options.location ?? globalThis.location;
  const isPreview = options.preview ?? (PREVIEW_ONLY || pageLocation?.protocol === 'file:');
  const get = id => doc.getElementById(id);
  const form=get('story-form'), area=get('upload-area'), input=get('photo-input');
  const placeholder=get('upload-placeholder'), preview=get('photo-preview');
  const actions=get('photo-actions'), help=get('upload-help'), submit=get('submit-story');
  const status=get('form-status'), another=get('another-story');
  const fields=['origin','accumulation','outcome'].map(get);
  let photo=null, objectURL=null, saved=false, saving=false;
  let token=crypto.randomUUID();

  const about=get('about-dialog');
  get('about-button').addEventListener('click',()=>about.showModal());
  get('dialog-close').addEventListener('click',()=>about.close());
  about.addEventListener('click',event=>{
    if(event.target!==about)return;
    const b=about.getBoundingClientRect();
    if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)about.close();
  });

  function message(text, kind='error') {
    status.textContent=text; status.hidden=false;
    status.classList.remove('is-error','is-success'); status.classList.add(`is-${kind}`);
  }
  function clearMessage() {status.hidden=true;status.textContent='';}
  function clearPhoto() {
    if(objectURL)objectURLs.revokeObjectURL(objectURL);
    objectURL=null;photo=null;input.value='';preview.src='';preview.hidden=true;
    placeholder.hidden=false;actions.hidden=true;
    help.textContent='JPG, PNG or WebP · up to 10 MB';
  }
  function selectPhoto(file) {
    if(saved||saving)return;
    if(!file)return;
    if(!PHOTO_TYPES.has(file.type)) {message('Choose a JPG, PNG or WebP photo.');return;}
    if(!file.size||file.size>MAX_PHOTO_BYTES) {message('Choose a photo smaller than 10 MB.');return;}
    clearPhoto();photo=file;objectURL=objectURLs.createObjectURL(file);
    preview.src=objectURL;preview.hidden=false;placeholder.hidden=true;actions.hidden=false;
    help.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`;
    clearMessage();
  }
  const choose=()=>{if(!saved&&!saving)input.click();};
  area.addEventListener('click',choose);
  area.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}});
  input.addEventListener('change',()=>selectPhoto(input.files?.[0]));
  get('replace-photo').addEventListener('click',choose);
  get('remove-photo').addEventListener('click',()=>{if(!saved&&!saving){clearPhoto();clearMessage();}});
  area.addEventListener('dragover',event=>{event.preventDefault();if(!saved&&!saving)area.classList.add('is-dragging');});
  area.addEventListener('dragleave',()=>area.classList.remove('is-dragging'));
  area.addEventListener('drop',event=>{
    event.preventDefault();area.classList.remove('is-dragging');
    const files=event.dataTransfer?.files;
    if(files?.length>1)message('Choose one photo for this charm.');
    else selectPhoto(files?.[0]);
  });
  preview.addEventListener('error',()=>{if(photo){clearPhoto();message('This photo could not be opened. Please choose another image.');}});
  if(isPreview){get('offline-note').hidden=false;submit.disabled=true;}

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(saving||saved)return;
    if(isPreview){message('Open the online Collect page to submit your story.');return;}
    const empty=fields.find(field=>!field.value.trim());
    if(empty){message('Please answer all three questions.');empty.focus();return;}
    if(!form.reportValidity())return;
    if(!photo){message('Add a photo of your charm before saving.');area.focus();return;}
    const body=new FormData();
    fields.forEach(field=>body.set(field.name,field.value.trim()));
    body.set('photo',photo,photo.name);body.set('submissionToken',token);
    saving=true;submit.disabled=true;form.setAttribute('aria-busy','true');
    fields.forEach(field=>field.readOnly=true);input.disabled=true;
    submit.textContent='Saving your Charmography…';clearMessage();
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),60000);
    try {
      const response=await fetchRequest('/api/stories',{method:'POST',body,credentials:'same-origin',signal:controller.signal});
      let result;
      try {result=await response.json();}
      catch {throw new Error('Your story could not be saved. Please refresh the website and try again.');}
      if(!response.ok||!result.id)throw new Error(result.error||'Your story could not be saved. Please try again.');
      saved=true;fields.forEach(field=>field.disabled=true);input.disabled=true;
      area.classList.add('is-saved');actions.hidden=true;submit.textContent='Your Charmography is saved';
      message('Thank you. Your story and photo have been saved together.','success');another.hidden=false;
    } catch(error) {
      submit.disabled=false;submit.textContent='Save as Your Charmography ↗';
      message(error.name==='AbortError'?'Saving took a little too long. Your answers are still here. Please try again.':error instanceof TypeError?'Your story could not be saved. Check your connection and try again.':(error.message||'Your answers are still here. Please try again.'));
    } finally {
      clearTimeout(timeout);saving=false;form.removeAttribute('aria-busy');
      fields.forEach(field=>field.readOnly=false);input.disabled=saved;
    }
  });
  another.addEventListener('click',()=>{
    form.reset();fields.forEach(field=>field.disabled=false);input.disabled=false;
    clearPhoto();clearMessage();saved=false;token=crypto.randomUUID();
    another.hidden=true;area.classList.remove('is-saved');submit.disabled=false;
    submit.textContent='Save as Your Charmography ↗';fields[0].focus();
  });
  return {selectPhoto,clearPhoto,get photo(){return photo;},get saved(){return saved;}};
}
if(typeof document!=='undefined')initCollect(document);
