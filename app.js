'use strict';
(() => {
  const byId = (id) => document.getElementById(id);
  const els = Object.fromEntries([
    'video','videoFileInput','jsonFileInput','newVideoBtn','chooseVideoBtn','emptyState','dropZone','dropOverlay','stagePlay','fileOverlay','filenameTop','fileSizeTop','videoStatus','playerControls','seekSlider','timelineMarkers','playBtn','playIcon','backBtn','forwardBtn','frameBackBtn','frameNextBtn','currentTime','totalTime','fpsSelect','speedSelect','muteBtn','fullBtn','fileDetails','shortcutBtn','shortcutsDialog','closeShortcuts','noteText','categorySelect','captureTimeDisplay','addNoteBtn','noteSubmitText','cancelEditBtn','composerHint','noteCount','notesSummary','sortBtn','searchNotes','notesList','exportFormat','exportBtn','importBtn','toast'
  ].map(id => [id, byId(id)]));
  const CATEGORIES = new Set(['Observation','Visual','Timing','Audio','Fix']);
  const STORAGE_PREFIX = 'manimchecker:reviews:v1:';
  let videoObjectUrl = null;
  let fileInfo = null;
  let notes = [];
  let editingId = null;
  let capturedAt = null;
  let ascending = true;
  let toastTimer = null;
  let isScrubbing = false;
  const validTime = (v) => Number.isFinite(v) && v >= 0;
  const duration = () => validTime(els.video.duration) && els.video.duration > 0 ? els.video.duration : 0;
  const bounded = (v) => Math.max(0, Math.min(duration() || Math.max(v || 0, 0), Number.isFinite(v) ? v : 0));
  const formatTime = (seconds) => {
    const ms = Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 1000));
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor(ms / 60000) % 60;
    const secs = Math.floor(ms / 1000) % 60;
    const frac = String(ms % 1000).padStart(3, '0');
    return `${hours ? String(hours).padStart(2,'0')+':' : ''}${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${frac}`;
  };
  const safeName = (s) => String(s || 'video').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'video';
  const keyFor = (f) => `${STORAGE_PREFIX}${encodeURIComponent(f.name)}:${f.size}:${f.lastModified}`;
  const toast = (message) => {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3700);
  };
  const persist = () => {
    if (!fileInfo) return;
    try {
      localStorage.setItem(keyFor(fileInfo), JSON.stringify({version:1, video:{name:fileInfo.name,size:fileInfo.size,lastModified:fileInfo.lastModified}, notes}));
    } catch (err) {
      console.warn('Could not persist notes:', err);
      toast('Browser storage is unavailable. Export your notes to keep them.');
    }
  };
  const normalizeNote = (n) => {
    if (!n || !validTime(Number(n.time)) || typeof n.text !== 'string') return null;
    const value = n.text.trim().slice(0, 20000);
    if (!value) return null;
    return {id: typeof n.id === 'string' && n.id.length < 100 ? n.id : makeId(), time: bounded(Number(n.time)), text:value, category:CATEGORIES.has(n.category) ? n.category : 'Observation', createdAt:typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString()};
  };
  const makeId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const loadSavedNotes = () => {
    notes = [];
    try {
      const json = localStorage.getItem(keyFor(fileInfo));
      if (json) {
        const saved = JSON.parse(json);
        if (Array.isArray(saved.notes)) notes = saved.notes.slice(0,5000).map(normalizeNote).filter(Boolean);
      }
    } catch (err) { console.warn('Could not load notes:',err); toast('Saved notes could not be loaded.'); }
    renderNotes();
  };
  const enableWorkspace = (enabled) => {
    for (const id of ['noteText','categorySelect','addNoteBtn','searchNotes','sortBtn','importBtn']) els[id].disabled = !enabled;
    els.videoStatus.classList.toggle('loaded',enabled);
    els.emptyState.hidden = enabled;
    els.playerControls.hidden = !enabled;
    els.fileOverlay.hidden = !enabled;
    els.stagePlay.hidden = !enabled;
    els.video.classList.toggle('is-loaded',enabled);
    els.videoStatus.lastChild.textContent = enabled ? ' Ready to review' : ' No video loaded';
    els.composerHint.textContent = enabled ? 'Pause and start typing to capture a timestamp · Ctrl/⌘ + Enter to save' : 'Open a video to start adding notes.';
  };
  const openVideo = (file) => {
    if (!file) return;
    if (!(file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|ogv|ogg)$/i.test(file.name))) { toast('Choose a video file (MP4, WebM or browser-playable video).'); return; }
    if (file.size === 0) { toast('This video file is empty.'); return; }
    els.video.pause();
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    videoObjectUrl = URL.createObjectURL(file);
    fileInfo = {name:file.name,size:file.size,lastModified:file.lastModified};
    els.video.src = videoObjectUrl;
    els.video.load();
    els.filenameTop.textContent = file.name;
    els.fileSizeTop.textContent = (file.size / (1024*1024)).toFixed(1)+' MB';
    els.fileDetails.lastElementChild.textContent = `${file.name} · ${(file.size/1024/1024).toFixed(1)} MB · Local file, not uploaded`;
    els.speedSelect.value = '1';
    els.video.playbackRate = 1;
    capturedAt = null;
    editingId = null;
    els.noteText.value = '';
    els.categorySelect.value = 'Observation';
    els.cancelEditBtn.hidden = true;
    els.noteSubmitText.textContent = 'Add note';
    enableWorkspace(true);
    updatePlayback();
    loadSavedNotes();
    toast('Video opened locally. Pause anywhere to annotate.');
  };
  const updatePlayback = () => {
    if (!fileInfo) return;
    const t = validTime(els.video.currentTime) ? els.video.currentTime : 0;
    els.currentTime.textContent = formatTime(t);
    els.totalTime.textContent = formatTime(duration());
    const p = duration() ? Math.max(0,Math.min(1,t/duration())) : 0;
    if (!isScrubbing) els.seekSlider.value = Math.round(p*1000);
    els.seekSlider.style.setProperty('--progress',`${p*100}%`);
    const playing = !els.video.paused && !els.video.ended;
    els.playBtn.setAttribute('aria-label',playing?'Pause video':'Play video');
    els.playBtn.title = playing?'Pause (Space)':'Play (Space)';
    els.playIcon.setAttribute('d',playing?'M7 4h3v16H7zm7 0h3v16h-3z':'m8 5 12 7-12 7V5');
    els.playIcon.setAttribute('fill','currentColor');
    els.playIcon.setAttribute('stroke','none');
    els.stagePlay.hidden = playing;
    if (!editingId && capturedAt === null && document.activeElement !== els.noteText) setCapturedTime(t,false);
    for (const card of els.notesList.querySelectorAll('.note-card')) {
      const at = Number(card.dataset.time);
      card.classList.toggle('active',Math.abs(at-t)<.35);
    }
  };
  const seekTo = (time) => {
    if (!fileInfo) return;
    els.video.currentTime = bounded(time);
    updatePlayback();
  };
  const playPause = () => {
    if (!fileInfo) return;
    if (els.video.paused) els.video.play().catch(err => toast('Playback failed: '+err.message));
    else els.video.pause();
  };
  const stepBy = (seconds) => { if (!fileInfo) return; els.video.pause(); seekTo(els.video.currentTime + seconds); };
  const frameBy = (sign) => stepBy(sign / Number(els.fpsSelect.value || 30));
  const setCapturedTime = (time,locked=true) => {
    if (!fileInfo) return;
    if (locked) els.video.pause();
    capturedAt = locked ? bounded(time) : null;
    els.captureTimeDisplay.textContent = '@ '+formatTime(locked ? capturedAt : time);
  };
  const beginNote = () => {
    if (!fileInfo) return;
    if (editingId) { els.noteText.focus(); return; }
    setCapturedTime(els.video.currentTime,true);
    els.noteText.focus();
  };
  const resetComposer = () => {
    editingId = null;
    capturedAt = null;
    els.noteText.value = '';
    els.categorySelect.value = 'Observation';
    els.cancelEditBtn.hidden = true;
    els.noteSubmitText.textContent = 'Add note';
    if (fileInfo) els.captureTimeDisplay.textContent = '@ '+formatTime(els.video.currentTime);
  };
  const saveNote = () => {
    if (!fileInfo) return;
    const value = els.noteText.value.trim();
    if (!value) { toast('Write a note before saving.'); els.noteText.focus(); return; }
    if (value.length > 20000) { toast('Please keep the note below 20,000 characters.'); return; }
    if (capturedAt === null) setCapturedTime(els.video.currentTime,true);
    const category = CATEGORIES.has(els.categorySelect.value) ? els.categorySelect.value : 'Observation';
    if (editingId) {
      const n = notes.find(n => n.id === editingId);
      if (n) Object.assign(n,{text:value, category, time:capturedAt});
      toast('Note updated.');
    } else {
      notes.push({id:makeId(), time:capturedAt, text:value, category, createdAt:new Date().toISOString()});
      toast(`Note saved at ${formatTime(capturedAt)}.`);
    }
    persist();
    resetComposer();
    renderNotes();
  };
  const editNote = (id) => {
    const n = notes.find(n => n.id === id);
    if (!n) return;
    els.video.pause();
    editingId = id;
    capturedAt = n.time;
    els.noteText.value = n.text;
    els.categorySelect.value = n.category;
    els.captureTimeDisplay.textContent = '@ '+formatTime(n.time);
    els.noteSubmitText.textContent = 'Save changes';
    els.cancelEditBtn.hidden = false;
    els.noteText.focus();
    els.noteText.scrollIntoView({behavior:'smooth',block:'nearest'});
  };
  const deleteNote = (id) => {
    const n = notes.find(n => n.id === id);
    if (!n || !window.confirm(`Delete note at ${formatTime(n.time)}?`)) return;
    notes = notes.filter(n => n.id !== id);
    if (editingId === id) resetComposer();
    persist(); renderNotes(); toast('Note deleted.');
  };
  const button = (cls,label,onClick,title) => {
    const b = document.createElement('button');b.type='button';b.className=cls;b.textContent=label;
    if (title) b.title=title;
    b.addEventListener('click',onClick);return b;
  };
  const renderNotes = () => {
    const count = notes.length;
    els.noteCount.textContent = `${count} ${count === 1 ? 'note':'notes'}`;
    els.notesSummary.textContent = count ? `${count} annotation${count===1?'':'s'} captured` : 'Your feedback appears here';
    els.exportBtn.disabled = count===0;
    els.exportFormat.disabled = count===0;
    els.sortBtn.disabled = !fileInfo || count===0;
    els.sortBtn.firstChild.textContent = ascending?'Time ↑':'Time ↓';
    const q = els.searchNotes.value.trim().toLocaleLowerCase();
    const visible = notes.filter(n => `${n.text} ${n.category} ${formatTime(n.time)}`.toLocaleLowerCase().includes(q))
      .sort((a,b)=> (ascending?1:-1)*(a.time-b.time || a.createdAt.localeCompare(b.createdAt)));
    els.notesList.replaceChildren();
    if (visible.length===0) {
      const empty = document.createElement('div'); empty.className = count ? 'no-results' : 'notes-empty';
      if (count) empty.textContent = 'No notes match your search.';
      else {
        const glyph=document.createElement('div');glyph.className='note-empty-icon';glyph.textContent='✎';
        const strong=document.createElement('strong');strong.textContent='No notes yet';
        const p=document.createElement('p');p.textContent='Your first annotation will appear here, linked to the playback time.';
        empty.append(glyph,strong,p);
      }
      els.notesList.append(empty);
    }
    for (const n of visible) {
      const card=document.createElement('article');card.className='note-card cat-'+n.category;card.dataset.time=String(n.time);
      const header=document.createElement('div');header.className='note-card-header';
      const time=button('note-time',formatTime(n.time),()=>{els.video.pause();seekTo(n.time)},'Jump to '+formatTime(n.time));
      const category=document.createElement('span');category.className='category-label';category.textContent=n.category==='Fix'?'Fix needed':n.category;
      header.append(time,category);
      const body=document.createElement('p');body.className='note-body';body.textContent=n.text;
      const footer=document.createElement('div');footer.className='note-card-footer';
      footer.append(button('edit-note','Edit',()=>editNote(n.id)),button('remove-note','Delete',()=>deleteNote(n.id)));
      card.append(header,body,footer);els.notesList.append(card);
    }
    renderMarkers();updatePlayback();
  };
  const renderMarkers = () => {
    els.timelineMarkers.replaceChildren();
    if (!duration()) return;
    notes.forEach(n => {
      const p = Math.min(100, Math.max(0, n.time/duration()*100));
      const marker=button('marker','',()=>{els.video.pause();seekTo(n.time);},`${formatTime(n.time)} — ${n.text.slice(0,75)}`);
      marker.style.left=`${p}%`;
      marker.setAttribute('aria-label',`Jump to note at ${formatTime(n.time)}`);
      els.timelineMarkers.append(marker);
    });
  };
  const quoteCsv = (s) => '"'+String(s).replaceAll('"','""')+'"';
  const sorted = () => [...notes].sort((a,b)=>a.time-b.time || a.createdAt.localeCompare(b.createdAt));
  const asMarkdown = () => {
    const list=sorted();
    return ['# Video review — '+fileInfo.name,'',`- **Video:** ${fileInfo.name}`,`- **Duration:** ${formatTime(duration())}`,`- **Review notes:** ${list.length}`,'','## Timestamped notes','',...list.flatMap((n,i)=>[`### ${i+1}. [${formatTime(n.time)}] — ${n.category==='Fix'?'Fix needed':n.category}`,'',n.text,''])].join('\n')+'\n';
  };
  const asText = () => ['VIDEO REVIEW: '+fileInfo.name,'Duration: '+formatTime(duration()),'Notes: '+notes.length,'',...sorted().flatMap(n=>[`[${formatTime(n.time)}] (${n.category})`,n.text,''])].join('\n')+'\n';
  const asCsv = () => ['Timestamp,Seconds,Category,Note',...sorted().map(n=>[formatTime(n.time),n.time.toFixed(3),n.category,n.text].map(quoteCsv).join(','))].join('\r\n')+'\r\n';
  const asJson = () => JSON.stringify({app:'manimchecker',version:1,exportedAt:new Date().toISOString(),video:{...fileInfo,duration:duration()},notes:sorted()},null,2)+'\n';
  const download = (content,mime,name) => {
    const url=URL.createObjectURL(new Blob([content],{type:mime}));
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const exportNotes = () => {
    if (!fileInfo || !notes.length) return;
    const fmt=els.exportFormat.value;
    const types={md:['text/markdown;charset=utf-8',asMarkdown],txt:['text/plain;charset=utf-8',asText],csv:['text/csv;charset=utf-8',asCsv],json:['application/json;charset=utf-8',asJson]};
    const entry=types[fmt] || types.md;
    download(entry[1](),entry[0],`${safeName(fileInfo.name)}-review-notes.${fmt}`);
    toast(`Downloaded ${notes.length} timestamped notes (${fmt.toUpperCase()}).`);
  };
  const importNotes = async (file) => {
    if (!file || !fileInfo) return;
    if (file.size > 2*1024*1024) { toast('The JSON backup is too large (2 MB limit).'); return; }
    try {
      const payload=JSON.parse(await file.text());
      if (payload.app!=='manimchecker' || !Array.isArray(payload.notes)) throw new Error('Not a Manim Checker JSON export');
      if (payload.notes.length>5000) throw new Error('Backup has more than 5,000 notes');
      if (payload.video?.name && payload.video.name!==fileInfo.name && !window.confirm(`This backup was created for “${payload.video.name}”. Import its timestamps for “${fileInfo.name}” anyway?`)) return;
      const imported=payload.notes.map(normalizeNote);
      if (imported.some(n=>!n)) throw new Error('Invalid note in backup');
      if (notes.length && !window.confirm(`Replace the ${notes.length} existing notes with ${imported.length} imported notes?`)) return;
      const ids=new Set();
      notes=imported.map(n=>{if(ids.has(n.id)) n.id=makeId();ids.add(n.id);return n;});
      resetComposer();persist();renderNotes();toast(`Imported ${notes.length} notes.`);
    } catch(err) {toast('Could not import backup: '+err.message);}
  };

  els.video.addEventListener('loadedmetadata',()=>{updatePlayback();renderMarkers();});
  els.video.addEventListener('durationchange',()=>{updatePlayback();renderMarkers();});
  els.video.addEventListener('timeupdate',updatePlayback);
  els.video.addEventListener('seeked',updatePlayback);
  els.video.addEventListener('play',updatePlayback);
  els.video.addEventListener('pause',updatePlayback);
  els.video.addEventListener('ended',updatePlayback);
  els.video.addEventListener('error',()=>{if(fileInfo)toast('This browser cannot play the video. Try an H.264 MP4 or WebM file.');});
  els.playBtn.addEventListener('click',playPause);
  els.stagePlay.addEventListener('click',playPause);
  els.video.addEventListener('click',playPause);
  els.backBtn.addEventListener('click',()=>stepBy(-5));
  els.forwardBtn.addEventListener('click',()=>stepBy(5));
  els.frameBackBtn.addEventListener('click',()=>frameBy(-1));
  els.frameNextBtn.addEventListener('click',()=>frameBy(1));
  els.seekSlider.addEventListener('input',()=>{isScrubbing=true;seekTo(Number(els.seekSlider.value)/1000*duration());els.seekSlider.style.setProperty('--progress',`${Number(els.seekSlider.value)/10}%`);});
  els.seekSlider.addEventListener('change',()=>{isScrubbing=false;updatePlayback();});
  els.speedSelect.addEventListener('change',()=>{els.video.playbackRate=Number(els.speedSelect.value);});
  els.muteBtn.addEventListener('click',()=>{els.video.muted=!els.video.muted;els.muteBtn.setAttribute('aria-label',els.video.muted?'Unmute video':'Mute video');els.muteBtn.style.color=els.video.muted?'var(--amber)':'';});
  els.fullBtn.addEventListener('click',()=>{const node=byId('videoStage');if(document.fullscreenElement)document.exitFullscreen();else node.requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable.'));});
  els.newVideoBtn.addEventListener('click',()=>els.videoFileInput.click());
  els.chooseVideoBtn.addEventListener('click',()=>els.videoFileInput.click());
  els.videoFileInput.addEventListener('change',()=>{const f=els.videoFileInput.files[0];openVideo(f);els.videoFileInput.value='';});
  let dragDepth=0;
  document.addEventListener('dragenter',e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();dragDepth++;els.dropOverlay.hidden=false;});
  document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  document.addEventListener('dragleave',e=>{if(!e.dataTransfer?.types.includes('Files'))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)els.dropOverlay.hidden=true;});
  document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;els.dropOverlay.hidden=true;const file=e.dataTransfer?.files[0];if(file)openVideo(file);});
  els.noteText.addEventListener('focus',()=>{if(fileInfo && capturedAt===null)setCapturedTime(els.video.currentTime,true);});
  els.addNoteBtn.addEventListener('click',saveNote);
  els.noteText.addEventListener('keydown',e=>{if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){e.preventDefault();saveNote();}});
  els.cancelEditBtn.addEventListener('click',resetComposer);
  els.sortBtn.addEventListener('click',()=>{ascending=!ascending;renderNotes();});
  els.searchNotes.addEventListener('input',renderNotes);
  els.exportBtn.addEventListener('click',exportNotes);
  els.importBtn.addEventListener('click',()=>els.jsonFileInput.click());
  els.jsonFileInput.addEventListener('change',async()=>{await importNotes(els.jsonFileInput.files[0]);els.jsonFileInput.value='';});
  els.shortcutBtn.addEventListener('click',()=>els.shortcutsDialog.showModal());
  els.closeShortcuts.addEventListener('click',()=>els.shortcutsDialog.close());
  document.addEventListener('keydown',e=>{
    if(!fileInfo || e.altKey||e.ctrlKey||e.metaKey||els.shortcutsDialog.open)return;
    const tag=document.activeElement?.tagName;
    if (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag) || document.activeElement?.isContentEditable) return;
    if (e.code==='Space'||e.key.toLowerCase()==='k') {e.preventDefault();playPause();}
    else if(e.key==='ArrowLeft'){e.preventDefault();stepBy(-5);}
    else if(e.key==='ArrowRight'){e.preventDefault();stepBy(5);}
    else if(e.key===','){e.preventDefault();frameBy(-1);}
    else if(e.key==='.'){e.preventDefault();frameBy(1);}
    else if(e.key.toLowerCase()==='n'){e.preventDefault();beginNote();}
  });
  window.addEventListener('beforeunload',()=>{if(videoObjectUrl)URL.revokeObjectURL(videoObjectUrl);});
  enableWorkspace(false);
  renderNotes();
})();