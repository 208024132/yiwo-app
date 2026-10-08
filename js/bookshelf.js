/* 阅读书架：推荐 / 我的书架 / 阅读进度 */
UserShell.boot({ hideTab: true, back: "my.html", title: Store.getTitle("page.bookshelf") });

(() => {
  const u = Store.currentUser();
  if (!u) return;
  const body = document.getElementById("bookshelf-body");

  let tab = "advise"; // advise | shelf | progress
  const myBooks = () => Store.myBooks(u.id);
  const inShelf = bid => myBooks().some(s => s.bid === bid);

  function recoCard(b) {
    const added = inShelf(b.id);
    return `
      <div class="book-card fade-in">
        <div class="book-cover" style="background:${b.g}">
          <div class="bc-title">${UI.esc(b.title)}</div>
          <div class="bc-author">${UI.esc(b.author)}</div>
        </div>
        <div class="book-info">
          <div class="book-title ellipsis">${UI.esc(b.title)}</div>
          <div class="book-meta">${UI.esc(b.author)} <span class="tag">${UI.esc(b.tag || "书")}</span></div>
          <div class="book-desc clamp-2">${UI.esc(b.desc)}</div>
        </div>
        <div class="book-add">
          ${added
            ? `<span class="tag success">已在书架</span>`
            : `<button class="btn sm soft block" data-add="${b.id}">加入书架</button>`}
        </div>
      </div>`;
  }

  function shelfRow(it, showDone) {
    const b = it.book;
    return `
      <div class="card shelf-item tap" data-book="${it.bid}">
        <div class="shelf-cover" style="background:${b.g}">${UI.esc(b.title.slice(0, 1))}</div>
        <div class="shelf-main">
          <div class="shelf-title ellipsis">${UI.esc(b.title)}</div>
          <div class="shelf-author ellipsis">${UI.esc(b.author)}</div>
          <div class="progress mt-8"><i style="width:${it.pct}%"></i></div>
        </div>
        <div class="shelf-side">
          ${it.pct === 100 && showDone
            ? `<span class="tag success">读完啦 🎉</span>`
            : `<span class="shelf-pct num">${it.pct}%</span>`}
          <button class="icon-btn" data-del="${it.bid}">${UI.icon("trash", 18)}</button>
        </div>
      </div>`;
  }

  function render() {
    let html = `
      <div class="seg book-seg">
        <button data-tab="advise" class="${tab === "advise" ? "on" : ""}">推荐</button>
        <button data-tab="shelf" class="${tab === "shelf" ? "on" : ""}">我的书架</button>
        <button data-tab="progress" class="${tab === "progress" ? "on" : ""}">阅读进度</button>
      </div>`;

    const empty = () => `<div class="card">${UI.emptyBox("📭", "书架空空", "切换到「推荐」标签，挑一本加入书架开始阅读")}</div>`;

    if (tab === "advise") {
      html += `<div class="reco-grid">${Store.recommendBooks().map(recoCard).join("")}</div>`;
    } else if (tab === "shelf") {
      const list = myBooks();
      html += `<div class="shelf-list">${list.length ? list.map(it => shelfRow(it, false)).join("") : empty()}</div>`;
    } else {
      const list = myBooks().slice().sort((a, b) => b.pct - a.pct);
      html += `<div class="shelf-list">${list.length ? list.map(it => shelfRow(it, true)).join("") : empty()}</div>`;
    }
    body.innerHTML = html;
  }

  function openProgress(bid) {
    const it = myBooks().find(x => x.bid === bid);
    if (!it) return;
    const s = UI.sheet(`
      <div class="sheet-head"><h3>更新进度</h3>
        <button class="icon-btn" data-x>${UI.icon("close", 18)}</button></div>
      <div class="prog-title">${UI.esc(it.book.title)}</div>
      <div class="range-box">
        <input type="range" class="range" min="0" max="100" step="1" value="${it.pct}" data-r>
        <span class="range-val num" data-v>${it.pct}%</span>
      </div>
      <div class="sheet-actions"><button class="btn primary block" data-save>保存</button></div>`);
    const r = s.el.querySelector("[data-r]");
    const v = s.el.querySelector("[data-v]");
    s.el.querySelector("[data-x]").onclick = () => s.close();
    r.oninput = () => { v.textContent = r.value + "%"; };
    s.el.querySelector("[data-save]").onclick = () => {
      Store.setProgress(u.id, bid, Number(r.value));
      s.close();
      UI.toast("进度已更新", "success");
      render();
    };
  }

  async function delBook(bid) {
    const it = myBooks().find(x => x.bid === bid);
    if (!it) return;
    const ok = await UI.confirm("移出书架？", `确定将《${it.book.title}》移出书架吗？`, { danger: true });
    if (ok) {
      Store.removeFromShelf(u.id, bid);
      UI.toast("已移出书架", "success");
      render();
    }
  }

  body.addEventListener("click", e => {
    const t = e.target.closest("[data-tab]");
    if (t) { tab = t.dataset.tab; render(); return; }
    const add = e.target.closest("[data-add]");
    if (add) {
      const res = Store.addToShelf(u.id, add.dataset.add);
      UI.toast(res.ok ? "已加入书架" : res.msg, res.ok ? "success" : "info");
      render();
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) { delBook(del.dataset.del); return; }
    const row = e.target.closest("[data-book]");
    if (row) { openProgress(row.dataset.book); return; }
  });

  render();
})();