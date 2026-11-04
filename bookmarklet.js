/* TikTok Multi Player bookmarklet.
   index.html serializes this function into a javascript: link with the player URL and version baked in,
   so it must not reference anything outside its own body. It runs in the user's own tab on tiktok.com
   and only collects post ids: the player plays them through TikTok's official embed player.
   Use block comments only: the source is turned into a URL. */
function ttmpBookmarklet(PLAYER_URL, VERSION) {
  const MAX = 16, PANEL_ID = 'ttmp-panel';
  const SITE = /(^|\.)tiktok\.com$/i;
  /* Video posts live at /@<user>/video/<numeric id>. Photo posts (/photo/) cannot play in the embed player's video mode. */
  const VIDEO_PATH = /^\/@[^/]+\/video\/(\d{8,25})(?:[/?#]|$)/i;
  const videoId = path => (path.match(VIDEO_PATH) || [])[1] || '';
  if (!SITE.test(location.hostname)) { alert('TikTokのページで実行してください。'); return; }
  if (window.__ttmpBookmarklet) { window.__ttmpBookmarklet.scan(); return; }

  /* Every run starts with an empty selection. */
  let selected = [];
  const has = id => selected.some(v => v.id === id);
  const clean = text => String(text || '').trim().replace(/\s+/g, ' ').slice(0, 180);

  function videoInfo(anchor) {
    let url;
    try { url = new URL(anchor.href, location.href); } catch (e) { return null; }
    if (!SITE.test(url.hostname)) return null;
    const id = videoId(url.pathname);
    if (!id) return null;
    const user = url.pathname.split('/')[1];
    const title = anchor.getAttribute('title') || anchor.getAttribute('aria-label') || anchor.querySelector('img')?.alt || `${user} ${id}`;
    return { id, title: clean(title) };
  }

  function encodeState(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* Styles are set through the CSSOM rather than a <style> element so a strict style-src CSP cannot block them. */
  const css = (el, text) => { el.style.cssText = text; return el; };
  const button = (label, primary) => {
    const b = css(document.createElement('button'), `border:0;border-radius:9px;padding:9px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;${primary ? 'background:#c4f26a;color:#18200f' : 'background:#30333c;color:#f3f3f5'}`);
    b.type = 'button'; b.textContent = label; return b;
  };

  const panel = css(document.createElement('div'), 'position:fixed;z-index:2147483647;right:18px;bottom:18px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;max-width:calc(100vw - 36px);padding:12px 14px;background:#16181ef0;border:1px solid #41444e;border-radius:14px;color:#f7f7fa;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px #0008');
  panel.id = PANEL_ID;
  const label = css(document.createElement('span'), 'flex-basis:100%;color:#aeb4c0;font-size:11px');
  label.textContent = `TikTok Multi Player ${VERSION || ''}`.trim();
  const count = css(document.createElement('span'), 'font-weight:650;min-width:96px');
  const message = css(document.createElement('span'), 'flex-basis:100%;color:#ffb4b4;font-size:12px;display:none');
  /* The feed changes the address as it scrolls, so the "add this video" button reads it at click time. */
  const addCurrent = button('この動画を追加', false);
  const clear = button('クリア', false);
  const open = button('Multi Playerで開く', true);
  /* Plays videos one after another on one screen, as YouTube Shorts does: the selected videos, or with none selected,
     every video on this page. It works without a selection, so it is never disabled. */
  const sequence = button('順に自動再生', true);
  sequence.title = '選択した動画（未選択ならこのページの動画）を1画面で順に再生します';
  const close = button('×', false);
  close.title = '閉じる';
  /* Contact links styled like the other Multi Players' headers: a circled icon followed by the address. */
  const contact = (href, icon, text) => {
    const link = css(document.createElement('a'), 'display:inline-flex;align-items:center;gap:6px;color:#c6cad2;text-decoration:none;font-size:13px;white-space:nowrap');
    link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const mark = css(document.createElement('span'), 'display:inline-grid;place-items:center;width:20px;height:20px;border:1px solid #59606d;border-radius:50%;font-size:12px;font-weight:800');
    mark.textContent = icon; mark.setAttribute('aria-hidden', 'true');
    link.append(mark, text);
    link.addEventListener('mouseenter', () => { link.style.color = '#c4f26a'; link.style.textDecoration = 'underline'; });
    link.addEventListener('mouseleave', () => { link.style.color = '#c6cad2'; link.style.textDecoration = 'none'; });
    return link;
  };
  const contacts = css(document.createElement('span'), 'display:inline-flex;align-items:center;gap:12px');
  contacts.append(contact('mailto:okcysk@gmail.com', '✉', 'okcysk@gmail.com'), contact('https://x.com/okcysk46770', '𝕏', '@okcysk46770'));
  panel.append(label, count, addCurrent, clear, open, sequence, contacts, close, message);
  document.body.append(panel);

  let messageTimer;
  function notice(text) {
    message.textContent = text; message.style.display = 'block';
    clearTimeout(messageTimer); messageTimer = setTimeout(() => { message.style.display = 'none'; }, 2600);
  }

  function refresh() {
    count.textContent = `${selected.length} / ${MAX} 選択`;
    open.disabled = selected.length < 1; open.style.opacity = open.disabled ? '.42' : '1';
    const current = videoId(location.pathname);
    addCurrent.style.display = current ? '' : 'none';
    addCurrent.disabled = has(current); addCurrent.style.opacity = addCurrent.disabled ? '.42' : '1';
    for (const box of document.querySelectorAll('.ttmp-check')) box.checked = has(box.dataset.videoId);
  }

  function toggle(info, on) {
    if (on && !has(info.id)) {
      if (selected.length >= MAX) { notice(`選択できるのは${MAX}本までです。`); refresh(); return; }
      selected.push(info);
    } else if (!on) selected = selected.filter(v => v.id !== info.id);
    refresh();
  }

  /* A thumbnail link holds an image or preview, or is at least thumbnail-sized; a caption link is a short line of text. */
  const isThumb = anchor => {
    if (anchor.querySelector('img,picture,video')) return true;
    const box = anchor.getBoundingClientRect();
    return box.width >= 80 && box.height >= 100;
  };
  /* Any page under the site works: profiles, search results, hashtags, related videos and so on. */
  function scan() {
    for (const anchor of document.querySelectorAll('a[href]')) {
      if (anchor.dataset.ttmp || panel.contains(anchor)) continue;
      const info = videoInfo(anchor);
      if (!info) { anchor.dataset.ttmp = 'skip'; continue; }
      /* Not done yet: a lazy-loaded card may only get its image later. */
      if (!isThumb(anchor)) continue;
      anchor.dataset.ttmp = 'done';
      /* One checkbox per card, even when the card links the same video from several places. */
      const card = anchor.parentElement?.parentElement || anchor.parentElement;
      if (card && [...card.querySelectorAll('.ttmp-check')].some(box => box.dataset.videoId === info.id)) continue;
      if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
      const box = css(document.createElement('input'), 'position:absolute;z-index:2147483646;top:8px;left:8px;width:32px;height:32px;margin:0;accent-color:#c4f26a;cursor:pointer;filter:drop-shadow(0 1px 3px #000)');
      box.type = 'checkbox'; box.className = 'ttmp-check'; box.dataset.videoId = info.id;
      box.title = '動画を選択'; box.checked = has(info.id);
      box.addEventListener('click', event => event.stopPropagation());
      box.addEventListener('change', event => { event.stopPropagation(); toggle(info, box.checked); });
      anchor.append(box);
    }
    refresh();
  }

  let scanTimer;
  const observer = new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 200); });
  observer.observe(document.body, { childList: true, subtree: true });

  addCurrent.addEventListener('click', () => {
    const id = videoId(location.pathname);
    if (!id) return;
    const title = document.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"], h1')?.textContent || document.title;
    toggle({ id, title: clean(title) }, true);
  });
  clear.addEventListener('click', () => { selected = []; refresh(); });
  function launch(videos, n, sequential) {
    const list = videos.map(video => ({ id: video.id, t: video.title }));
    const slots = list.slice(0, n).map((video, i) => ({ i, ...video }));
    /* o marks sequential play; q holds the videos that come after the ones on screen. */
    const state = { v: 1, n, c: slots.length, slots, q: list.slice(n), o: sequential ? 1 : 0 };
    const target = `${PLAYER_URL}#share=${encodeState(state)}`;
    /* No 'noopener' feature: with it window.open returns null, which would look like a blocked popup. */
    const win = window.open(target, '_blank');
    if (win) win.opener = null; else location.href = target;
    /* The player has its own copy of the selection now, so the next pick starts from nothing. */
    selected = [];
    refresh();
  }
  /* Every video linked on the page, in page order, starting with the one open in the address bar if there is one. */
  function pageVideos() {
    const seen = new Set(), videos = [];
    const add = info => { if (info && !seen.has(info.id)) { seen.add(info.id); videos.push(info); } };
    const current = videoId(location.pathname);
    if (current) add({ id: current, title: clean(document.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"], h1')?.textContent || document.title) });
    for (const anchor of document.querySelectorAll('a[href]')) if (!panel.contains(anchor)) add(videoInfo(anchor));
    /* Keep the share link a sensible length. */
    return videos.slice(0, 100);
  }
  open.addEventListener('click', () => {
    if (!selected.length) return;
    launch(selected, [1, 2, 4, 9, 16].find(n => n >= selected.length), false);
  });
  sequence.addEventListener('click', () => {
    const videos = selected.length ? selected : pageVideos();
    if (!videos.length) { notice('このページに動画が見つかりません。プロフィールや検索結果のページで押してください。'); return; }
    launch(videos, 1, true);
  });
  close.addEventListener('click', () => {
    observer.disconnect(); panel.remove();
    for (const box of document.querySelectorAll('.ttmp-check')) box.remove();
    for (const anchor of document.querySelectorAll('a[data-ttmp]')) delete anchor.dataset.ttmp;
    delete window.__ttmpBookmarklet;
  });

  window.__ttmpBookmarklet = { scan };
  scan();
}
