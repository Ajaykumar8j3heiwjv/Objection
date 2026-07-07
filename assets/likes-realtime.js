(function(){
  // Realtime likes helper for product/course pages and index objections.
  // This file expects the page to define SUPABASE_URL and SUPABASE_ANON_KEY OR
  // to set window.__SUPABASE_URL / window.__SUPABASE_ANON_KEY before loading.

  const SUPABASE_URL = window.__SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY;

  if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
    console.warn('[likes-realtime] Supabase keys missing. Set window.__SUPABASE_URL and window.__SUPABASE_ANON_KEY');
    return;
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  const LIKE_QUERY_BATCH = 200; // not used yet; placeholder

  let sbClient = null;
  try{
    // supabase-js v2 expected
    sbClient = window.supabase && window.supabase.createClient
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;
  }catch(e){
    sbClient = null;
  }

  if(!sbClient){
    console.warn('[likes-realtime] Supabase client not available');
    return;
  }

  // Table/column names must match SQL migration.
  const LIKES_TABLE = 'objection_likes';
  const KEY_COL = 'objection_key';
  const COUNT_COL = 'count';
  const UPDATED_AT_COL = 'updated_at';
  const USER_LIKED_COL = 'liked_by';

  // Page should provide:
  // - elements with [data-like-key]
  // - each like button should have [data-like-count] span OR contain a span.count

const defaultHeart = { liked: '❤️', unliked: '🤍' };

  // Some pages may render an inline heart span with data-like-heart.
  // If the span exists, we will update its text. Otherwise we do nothing.


  function getButtons(){
    return Array.from(document.querySelectorAll('[data-like-key]'));
  }

  function getKeyFromEl(el){
    return String(el.getAttribute('data-like-key') || '');
  }

  function setButtonState(btn, liked, count){
    const likedSpan = btn.querySelector('[data-like-heart]');
    const countSpan = btn.querySelector('[data-like-count]');

    if(liked){
      btn.classList.add('liked');
      if(likedSpan) likedSpan.textContent = defaultHeart.liked;
    }else{
      btn.classList.remove('liked');
      if(likedSpan) likedSpan.textContent = defaultHeart.unliked;
    }
    const c = Number(count || 0);
    if(countSpan) countSpan.textContent = String(c);

    // Text label fallback
    const labelSpan = btn.querySelector('[data-like-label]');
    if(labelSpan){
      labelSpan.textContent = liked ? 'Liked' : 'Like';
    }

    // Persist current state for immediate UX
    btn.dataset.likeLiked = liked ? '1' : '0';
    btn.dataset.likeCount = String(c);
  }

  async function fetchLikesForKeys(keys){
    if(!keys.length) return new Map();
    // Query all like rows for the keys.
    // This is best-effort; if table doesn't exist it will throw.
    const { data, error } = await sbClient
      .from(LIKES_TABLE)
      .select(`${KEY_COL},${COUNT_COL},${USER_LIKED_COL}`)
      .in(KEY_COL, keys);

    if(error) throw error;

    const map = new Map();
    (data || []).forEach(row => {
      map.set(String(row[KEY_COL]), row);
    });
    return map;
  }

  // NOTE: We treat `liked` as whether the row contains liked_by value.
  // If you want per-user likes, update SQL/policies and set a user identifier.
  function isLikedByRow(row){
    // If liked_by is boolean or count semantics differ, adjust.
    // For anonymous demo, we use liked_by boolean.
    if(row && typeof row[USER_LIKED_COL] === 'boolean') return row[USER_LIKED_COL];
    return false;
  }

  async function initialRender(){
    const btns = getButtons();
    if(!btns.length) return;

    const keys = Array.from(new Set(btns.map(getKeyFromEl).filter(Boolean)));
    const rows = await fetchLikesForKeys(keys);

    btns.forEach(btn => {
      const key = getKeyFromEl(btn);
      const row = rows.get(key);
      const count = row ? row[COUNT_COL] : 0;
      const liked = row ? isLikedByRow(row) : false;
      setButtonState(btn, liked, count);
    });
  }

  function toggleButtonsOptimistic(){
    const btn = event && event.currentTarget ? event.currentTarget : null;
  }

  async function toggleLike(key, btn){
    // For simplicity: toggle using upsert + increment.
    // SQL should implement safe increments.
    // We'll use RPC-like approach with a single-table strategy:
    // - If liked_by is boolean, we flip it and adjust count by +1/-1.
    // If your SQL differs, update this.

    // Optimistic local UX
    const prevLiked = btn.classList.contains('liked');
    const prevCount = Number(btn.dataset.likeCount || btn.querySelector('[data-like-count]')?.textContent || 0);
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    setButtonState(btn, nextLiked, nextCount);

    // Persist to DB: update row and flip liked_by.
    // We rely on DB trigger/policy or compute server-side.
    // Here we do best-effort update: increment count and set liked_by.
    // If you do not have per-user identity, this will behave like a single shared like.

    try{
      // upsert row first if missing
      const { error: upsertErr } = await sbClient
        .from(LIKES_TABLE)
        .upsert({
          [KEY_COL]: key,
          [COUNT_COL]: 0,
          [USER_LIKED_COL]: false
        }, { onConflict: KEY_COL });

      if(upsertErr) throw upsertErr;

      const { error: updErr } = await sbClient
        .from(LIKES_TABLE)
        .update({
          // We flip liked_by; count adjustment is approximate.
          [USER_LIKED_COL]: nextLiked,
          [COUNT_COL]: nextCount
        })
        .eq(KEY_COL, key);

      if(updErr) throw updErr;

    }catch(e){
      console.error('[likes-realtime] toggleLike failed', e);
      // revert if DB failed
      setButtonState(btn, prevLiked, prevCount);
    }
  }

  function attachClickHandlers(){
    const btns = getButtons();
    btns.forEach(btn => {
      btn.addEventListener('click', async (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const key = getKeyFromEl(btn);
        if(!key) return;
        await toggleLike(key, btn);
      });
    });
  }

  function subscribeToRealtime(){
    try{
      sbClient
        .channel('realtime-like-channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: LIKES_TABLE
        }, (payload)=>{
          // payload.new contains updated row.
          const row = payload && payload.new ? payload.new : null;
          if(!row) return;
          const key = String(row[KEY_COL]);
          const btns = getButtons().filter(b => getKeyFromEl(b) === key);
          btns.forEach(btn => {
            const count = row[COUNT_COL];
            const liked = isLikedByRow(row);
            setButtonState(btn, liked, count);
          });
        })
        .subscribe();
    }catch(e){
      console.warn('[likes-realtime] realtime subscribe failed', e);
    }
  }

  async function boot(){
    attachClickHandlers();
    try{
      await initialRender();
    }catch(e){
      console.warn('[likes-realtime] initialRender failed (table missing?)', e);
    }
    subscribeToRealtime();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();

