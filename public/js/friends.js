(function(){
  const statTotal = document.getElementById('stat-total');
  const statOnline = document.getElementById('stat-online');
  const statPending = document.getElementById('stat-pending');
  const statSearch = document.getElementById('stat-search');
  const friendsGrid = document.getElementById('friends-grid');
  const friendsEmpty = document.getElementById('friends-empty');
  const searchInput = document.getElementById('friend-search');
  const searchGrid = document.getElementById('search-grid');
  const searchEmpty = document.getElementById('search-empty');
  const clearSearchBtn = document.getElementById('clear-search');
  const searchSpinner = document.getElementById('search-spinner');
  const pendingIncoming = document.getElementById('pending-incoming');
  const pendingOutgoing = document.getElementById('pending-outgoing');
  const pendingIncomingEmpty = document.getElementById('pending-incoming-empty');
  const pendingOutgoingEmpty = document.getElementById('pending-outgoing-empty');

  let currentSearchTerm = '';
  let searchTimer = null;

  function el(tag, className, html){
    const e = document.createElement(tag);
    if(className) e.className = className;
    if(html !== undefined) e.innerHTML = html;
    return e;
  }

  async function fetchJSON(url, options){
    const res = await fetch(url, Object.assign({ headers: { 'Content-Type':'application/json' }}, options));
    if(!res.ok) return null;
    return res.json();
  }

  function renderFriendCard(user){
    const card = el('div','p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col gap-3 shadow-sm');
    const top = el('div','flex items-center gap-3');
    const avatar = el('div','w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold');
    avatar.textContent = (user.name||'?').slice(0,2).toUpperCase();
    const info = el('div','flex-1');
    info.innerHTML = `<p class="text-sm font-medium">${user.name}</p><p class="text-xs text-gray-500 dark:text-gray-400">${user.status==='online' ? '<span class=\'text-green-500\'>Online</span>' : 'Offline'}</p>`;
    top.appendChild(avatar); top.appendChild(info);
    card.appendChild(top);
    return card;
  }

  function renderSearchUser(user){
    const card = el('div','p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col gap-3 shadow-sm');
    const top = el('div','flex items-center gap-3');
    const avatar = el('div','w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-sm font-semibold');
    avatar.textContent = (user.name||'?').slice(0,2).toUpperCase();
    const info = el('div','flex-1');
    info.innerHTML = `<p class="text-sm font-medium">${user.name}</p><p class="text-xs text-gray-500 dark:text-gray-400">${user.status==='online' ? '<span class=\'text-green-500\'>Online</span>' : 'Offline'}</p>`;
    top.appendChild(avatar); top.appendChild(info);

    const action = el('div','flex');
    let btnLabel = 'Add Friend';
    let disabled = false;
    if(user.friend_status === 'pending') { btnLabel = 'Pending'; disabled = true; }
    if(user.friend_status === 'accepted') { btnLabel = 'Friends'; disabled = true; }
    const btn = el('button',`text-xs px-3 py-1 rounded-md font-medium border ${disabled? 'cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600':'bg-blue-600 hover:bg-blue-500 text-white border-blue-600'}`,btnLabel);
    if(!disabled){
      btn.addEventListener('click', async()=>{
        btn.disabled = true; btn.textContent='...';
        const r = await fetchJSON('/api/friends/request',{method:'POST', body: JSON.stringify({ targetId: user.id })});
        if(r && r.success){ btn.textContent='Pending'; btn.className='text-xs px-3 py-1 rounded-md font-medium border cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'; }
        else { btn.textContent='Error'; }
        refreshSummary();
      });
    }
    action.appendChild(btn);

    card.appendChild(top);
    card.appendChild(action);
    return card;
  }

  async function refreshSummary(){
    const data = await fetchJSON('/api/friends/summary');
    if(!data) return;
    statTotal.textContent = data.total;
    statOnline.textContent = data.online;
    statPending.textContent = (data.pendingIncoming + data.pendingOutgoing) || 0;
  }

  async function loadFriends(){
    const list = await fetchJSON('/api/friends/list');
    friendsGrid.innerHTML='';
    if(!list || list.length===0){
      friendsEmpty.classList.remove('hidden');
    } else {
      friendsEmpty.classList.add('hidden');
      list.forEach(u=>friendsGrid.appendChild(renderFriendCard(u)));
    }
  }

  async function loadPending(){
    const data = await fetchJSON('/api/friends/pending');
    if(!data) return;
    // Incoming
    pendingIncoming.innerHTML='';
    if(!data.incoming || data.incoming.length===0){
      pendingIncomingEmpty.classList.remove('hidden');
    } else {
      pendingIncomingEmpty.classList.add('hidden');
      data.incoming.forEach(req=>{
        const row = el('div','p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between gap-3');
        row.innerHTML = `<div class='flex items-center gap-3'><div class="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-semibold">${req.name.slice(0,2).toUpperCase()}</div><div><p class='text-sm font-medium'>${req.name}</p><p class='text-xs text-gray-500 dark:text-gray-400'>${req.status==='online' ? '<span class=\'text-green-500\'>Online</span>' : 'Offline'}</p></div></div>`;
        const actions = el('div','flex items-center gap-2');
        const acceptBtn = el('button','text-xs px-3 py-1 rounded-md font-medium bg-blue-600 hover:bg-blue-500 text-white','Accept');
        acceptBtn.addEventListener('click', async()=>{
          acceptBtn.disabled=true; acceptBtn.textContent='...';
          const r = await fetchJSON('/api/friends/accept',{ method:'POST', body: JSON.stringify({ fromUserId: req.fromUserId })});
          if(r && r.success){ acceptBtn.textContent='Added'; setTimeout(()=>{ loadPending(); loadFriends(); refreshSummary(); }, 400); }
          else { acceptBtn.textContent='Err'; }
        });
        actions.appendChild(acceptBtn);
        row.appendChild(actions);
        pendingIncoming.appendChild(row);
      });
    }
    // Outgoing
    pendingOutgoing.innerHTML='';
    if(!data.outgoing || data.outgoing.length===0){
      pendingOutgoingEmpty.classList.remove('hidden');
    } else {
      pendingOutgoingEmpty.classList.add('hidden');
      data.outgoing.forEach(req=>{
        const row = el('div','p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between gap-3');
        row.innerHTML = `<div class='flex items-center gap-3'><div class="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white text-xs font-semibold">${req.name.slice(0,2).toUpperCase()}</div><div><p class='text-sm font-medium'>${req.name}</p><p class='text-xs text-gray-500 dark:text-gray-400'>${req.status==='online' ? '<span class=\'text-green-500\'>Online</span>' : 'Offline'}</p></div></div>`;
        const badge = el('span','text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 font-semibold','Sent');
        row.appendChild(badge);
        pendingOutgoing.appendChild(row);
      });
    }
  }

  async function performSearch(term){
    currentSearchTerm = term;
    if(!term){
      searchGrid.innerHTML='';
      searchEmpty.classList.add('hidden');
      statSearch.textContent='0';
      return;
    }
    searchSpinner.classList.remove('hidden');
    const results = await fetchJSON('/api/friends/search?q='+encodeURIComponent(term));
    searchSpinner.classList.add('hidden');
    searchGrid.innerHTML='';
    if(!results || results.length===0){
      searchEmpty.classList.remove('hidden');
      statSearch.textContent='0';
    } else {
      searchEmpty.classList.add('hidden');
      statSearch.textContent=results.length;
      results.forEach(u=>searchGrid.appendChild(renderSearchUser(u)));
    }
  }

  function debounceSearch(){
    const term = searchInput.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(()=>performSearch(term), 300);
  }

  searchInput.addEventListener('input', debounceSearch);
  clearSearchBtn.addEventListener('click', ()=>{ searchInput.value=''; performSearch(''); });

  // Initial load
  refreshSummary();
  loadFriends();
  loadPending();
  // Periodic update of summary and friends (e.g., every 20s)
  setInterval(()=>{ refreshSummary(); loadFriends(); loadPending(); }, 20000);
})();
