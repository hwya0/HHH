/* 马原刷题 - 前端交互 */
(function () {
  "use strict";

  const $ = (s, el) => (el || document).querySelector(s);
  const TOKEN_KEY = "mayuan_token";

  let state = {
    token: localStorage.getItem(TOKEN_KEY) || "",
    user: null,          // {username, activated, progress}
    config: null,        // {pay_qr, price, total, trial_count}
    tab: "quiz",
    mode: "sequential",
    quiz: null,          // 当前 /api/quiz 响应
    selected: [],        // 当前题选中的字母
    showResult: false,   // 是否已提交并显示解析
    lastAnswer: null,    // 最近一次答题结果 {correct, answer, analysis}
    wrongList: [],
    stats: null,
  };

  /* ---------- API ---------- */
  async function api(path, opts) {
    opts = opts || {};
    const headers = {};
    let body = opts.body;
    if (body !== undefined) {
      body = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    if (state.token) headers["Authorization"] = "Bearer " + state.token;
    let resp;
    try {
      resp = await fetch(path, { method: opts.method || "GET", headers, body });
    } catch (e) {
      toast("网络错误，请稍后重试");
      throw e;
    }
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (resp.status === 401) {
      if (data && data.code === "need_login") {
        // token 失效
        state.token = ""; localStorage.removeItem(TOKEN_KEY); state.user = null;
        if (!location.hash.includes("auth")) { toast("请先登录"); }
        render();
      }
      return { status: resp.status, data };
    }
    if (resp.status === 402) {
      return { status: resp.status, data }; // need_pay
    }
    if (resp.status >= 400) {
      return { status: resp.status, data };
    }
    return { status: resp.status, data };
  }

  function toast(msg) {
    const root = $("#toast-root");
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  function letterOf(opt) {
    const m = String(opt).match(/^([A-Z])[\.、\s]/);
    return m ? m[1] : String(opt).trim();
  }

  /* ---------- 渲染入口 ---------- */
  function render() {
    renderTopbar();
    const main = $("#main");
    const tabbar = $("#tabbar");
    // 未登录 → 登录/注册面板（隐藏底部 tab）
    if (!state.token) {
      tabbar.classList.add("hidden");
      renderAuth();
      return;
    }
    tabbar.classList.remove("hidden");
    // 已登录但未激活 → 默认显示付费激活；若用户切到错题/统计也引导付费
    if (state.user && !state.user.activated) {
      // 允许试用：尝试拉取 quiz，若 200 则在试用中
      tabbar.classList.remove("hidden");
      if (state.tab === "quiz") {
        loadQuiz(true);
      } else {
        main.innerHTML = '<div class="card"><div class="pay-box" style="text-align:center;padding:30px 0"><div style="font-size:40px">🔒</div><p style="margin:12px 0;color:#666">激活后可使用错题本与统计</p><button class="btn" style="max-width:200px;margin:0 auto" onclick="goPay()">立即激活</button></div></div>';
      }
      return;
    }
    // 已激活
    if (state.tab === "quiz") loadQuiz(false);
    else if (state.tab === "wrong") loadWrong();
    else if (state.tab === "stats") loadStats();
  }

  function renderTopbar() {
    const box = $("#userBox");
    document.querySelectorAll(".tabbar .tab").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === state.tab);
    });
    if (!state.token) { box.innerHTML = '<span>未登录</span>'; return; }
    const name = (state.user && state.user.username) || "用户";
    const act = state.user && state.user.activated ? '<span style="font-size:11px;background:rgba(255,255,255,.25);padding:2px 7px;border-radius:8px">已激活</span>' : '<span style="font-size:11px;background:rgba(255,255,255,.25);padding:2px 7px;border-radius:8px">未激活</span>';
    box.innerHTML = act + '<span>' + name + '</span><button class="logout" onclick="doLogout()">退出</button>';
  }

  /* ---------- 登录 / 注册 ---------- */
  let authMode = "login"; // login | register
  function renderAuth() {
    const main = $("#main");
    main.innerHTML = `
      <div style="max-width:380px;margin:30px auto">
        <div class="panel">
          <div class="logo">★ 马原刷题</div>
          <div class="sub">${authMode === "login" ? "登录后开始刷题" : "注册账号，开启备考"}</div>
          <div class="field"><label>用户名</label><input id="au" type="text" placeholder="2-20 个字符" maxlength="20"></div>
          <div class="field"><label>密码</label><input id="ap" type="password" placeholder="至少 6 位" maxlength="32"></div>
          <div id="aerr" class="err"></div>
          <button class="btn" onclick="submitAuth()">${authMode === "login" ? "登 录" : "注 册"}</button>
          <div class="switch">${authMode === "login" ? '还没有账号？<b onclick="switchAuth()">去注册</b>' : '已有账号？<b onclick="switchAuth()">去登录</b>'}</div>
          <div class="switch"><b onclick="goPay()">激活码激活</b></div>
        </div>
      </div>`;
    setTimeout(() => $("#au").focus(), 50);
  }

  window.switchAuth = function () { authMode = authMode === "login" ? "register" : "login"; renderAuth(); };
  window.goPay = function () { renderPay(); };

  window.submitAuth = async function () {
    const u = $("#au").value.trim();
    const p = $("#ap").value;
    const err = $("#aerr");
    err.textContent = "";
    if (!u) { err.textContent = "请输入用户名"; return; }
    if (p.length < 6) { err.textContent = "密码至少 6 位"; return; }
    const path = authMode === "login" ? "/api/login" : "/api/register";
    const r = await api(path, { method: "POST", body: { username: u, password: p } });
    if (r.status === 200 && r.data && r.data.ok) {
      if (authMode === "register") {
        toast("注册成功，请登录"); authMode = "login"; renderAuth();
        $("#au").value = u; return;
      }
      state.token = r.data.token; localStorage.setItem(TOKEN_KEY, state.token);
      state.user = { username: r.data.username, activated: r.data.activated, progress: r.data.progress };
      toast("登录成功"); render();
    } else {
      err.textContent = (r.data && r.data.error) || "操作失败";
    }
  };

  /* ---------- 付费激活 ---------- */
  async function renderPay() {
    if (!state.config) { const r = await api("/api/config"); if (r.status === 200) state.config = r.data; }
    const cfg = state.config || {};
    const price = cfg.price || "9.9";
    const qr = cfg.pay_qr || "";
    const trialTotal = cfg.trial_count || 0;
    const main = $("#main");
    main.innerHTML = `
      <div style="max-width:400px;margin:20px auto">
        <div class="panel pay-box">
          <div class="logo">★ 马原刷题</div>
          <div class="pay-price">¥${price} <small>永久使用</small></div>
          <div class="sub">激活后解锁全部 ${cfg.total || ""} 道题目 · 错题本 · 答题统计</div>
          ${qr ? `<img class="qr" src="${qr}" alt="收款码" onerror="this.style.display='none';document.getElementById('qrph').style.display='block'">
                 <div id="qrph" class="pay-tip" style="display:none">扫码支付 ¥${price}，付款后联系获取激活码</div>`
               : `<div class="qr" style="display:flex;align-items:center;justify-content:center;color:#bbb;font-size:13px;line-height:1.6;padding:10px">收款码加载中<br>请联系管理员</div>`}
          <div class="pay-tip">微信 / 支付宝扫码支付 ¥${price}，付款后获取激活码</div>
          <div class="field"><label>输入激活码</label><input id="actcode" type="text" placeholder="MY-XXXX-XXXX" style="text-align:center;letter-spacing:1px"></div>
          <div id="acterr" class="err"></div>
          <button class="btn" onclick="doActivate()">立即激活</button>
          ${trialTotal > 0 ? `<div class="trial-note">未激活可免费试用 ${trialTotal} 题</div>` : ""}
          <div class="switch" style="margin-top:16px"><b onclick="render()">返回</b></div>
        </div>
      </div>`;
    setTimeout(() => { const el = $("#actcode"); if (el) el.focus(); }, 50);
  }

  window.doActivate = async function () {
    const code = ($("#actcode").value || "").trim();
    const err = $("#acterr");
    err.textContent = "";
    if (!code) { err.textContent = "请输入激活码"; return; }
    const r = await api("/api/activate", { method: "POST", body: { code: code } });
    if (r.status === 200 && r.data && r.data.ok) {
      toast("激活成功！");
      // 刷新用户信息
      const me = await api("/api/me");
      if (me.status === 200) state.user = me.data;
      render();
    } else {
      err.textContent = (r.data && r.data.error) || "激活失败";
    }
  };

  window.doLogout = async function () {
    await api("/api/logout", { method: "POST", body: {} });
    state.token = ""; localStorage.removeItem(TOKEN_KEY); state.user = null;
    toast("已退出登录"); render();
  };

  /* ---------- 刷题 ---------- */
  async function loadQuiz(isTrial) {
    const r = await api("/api/quiz?mode=" + state.mode);
    if (r.status === 402) {
      // 试用完毕或未激活 → 付费面板
      renderPay();
      return;
    }
    if (r.status !== 200 || !r.data) { render(); return; }
    state.quiz = r.data;
    state.selected = [];
    state.showResult = false;
    state.lastAnswer = null;
    renderQuiz(isTrial);
  }

  function renderQuiz(isTrial) {
    const q = state.quiz.question;
    const main = $("#main");
    if (!q) {
      main.innerHTML = '<div class="empty">暂无题目</div>';
      return;
    }
    const typeLabel = { single: "单选题", multi: "多选题", judge: "判断题" }[q.type] || q.type;
    const opts = q.options || [];
    let optsHtml = opts.map((opt, i) => {
      const letter = letterOf(opt);
      let cls = "opt";
      if (state.showResult) {
        const ans = (state.lastAnswer && state.lastAnswer.answer) || [];
        const isAns = ans.indexOf(letter) !== -1;
        const isSel = state.selected.indexOf(letter) !== -1;
        if (isAns) cls += " correct";
        else if (isSel) cls += " wrong";
      } else if (state.selected.indexOf(letter) !== -1) {
        cls += " sel";
      }
      const disabled = state.showResult ? "disabled" : "";
      return `<button class="${cls}" ${disabled} onclick="pickOption('${letter}', '${q.type}')"><span class="letter">${letter}.</span>${String(opt).replace(/^[A-Z][\.、]\s*/, "")}</button>`;
    }).join("");

    const prog = (state.quiz.progress || {});
    const total = state.quiz.total || 0;
    const idx = (state.quiz.index || 0) + 1;
    const pct = total ? Math.round((idx / total) * 100) : 0;

    let resultHtml = "";
    if (state.showResult && state.lastAnswer) {
      const la = state.lastAnswer;
      resultHtml = `<div class="feedback ${la.correct ? "right" : "wrong"}">
        ${la.correct ? "✓ 回答正确" : "✗ 回答错误"} 正确答案：<span class="ans">${(la.answer || []).join("、")}</span>
      </div>`;
      if (la.analysis) resultHtml += `<div class="analysis"><b>解析</b><br>${la.analysis}</div>`;
    }

    main.innerHTML = `
      <div class="mode-switch">
        <button class="${state.mode === "sequential" ? "active" : ""}" onclick="setMode('sequential')">顺序练习</button>
        <button class="${state.mode === "random" ? "active" : ""}" onclick="setMode('random')">随机练习</button>
      </div>
      ${isTrial && state.config && state.config.trial_count > 0 ? '<div class="trial-note">试用模式，激活后解锁全部题目</div>' : ""}
      <div class="card">
        <div class="q-meta">
          <span class="tag">${typeLabel}</span>
          <span class="tag ch">${q.chapter || ""}</span>
          <span class="q-index">第 ${idx} / ${total} 题</span>
        </div>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="q-stem">${q.question}</div>
        <div id="opts">${optsHtml}</div>
        ${resultHtml}
        <div class="actions">
          <button class="btn ghost" onclick="navQuiz('prev')">上一题</button>
          ${state.showResult
            ? `<button class="btn" onclick="navQuiz('next')">下一题</button>`
            : `<button class="btn" onclick="submitAnswer()">提交答案</button>`}
        </div>
        <div class="progress-text">已答 ${prog.answered || 0} 题 · 正确 ${prog.correct || 0} · 正确率 ${(prog.accuracy || 0).toFixed(1)}%</div>
      </div>`;
  }

  window.pickOption = function (letter, type) {
    if (state.showResult) return;
    if (type === "multi") {
      const i = state.selected.indexOf(letter);
      if (i === -1) state.selected.push(letter); else state.selected.splice(i, 1);
    } else {
      state.selected = [letter];
    }
    renderQuiz(state.user && !state.user.activated);
  };

  window.submitAnswer = async function () {
    if (!state.selected.length) { toast("请先选择答案"); return; }
    const q = state.quiz.question;
    const r = await api("/api/answer", { method: "POST", body: { id: q.id, selected: state.selected } });
    if (r.status === 402) { renderPay(); return; }
    if (r.status !== 200 || !r.data) { toast((r.data && r.data.error) || "提交失败"); return; }
    state.lastAnswer = r.data;
    state.showResult = true;
    // 刷新进度
    const qz = await api("/api/quiz?mode=" + state.mode);
    if (qz.status === 200) state.quiz = qz.data;
    renderQuiz(state.user && !state.user.activated);
  };

  window.navQuiz = async function (action) {
    const r = await api("/api/navigate", { method: "POST", body: { action: action } });
    if (r.status === 402) { renderPay(); return; }
    loadQuiz(state.user && !state.user.activated);
  };

  window.setMode = async function (mode) {
    state.mode = mode;
    await api("/api/mode", { method: "POST", body: { mode: mode } });
    loadQuiz(state.user && !state.user.activated);
  };

  /* ---------- 错题本 ---------- */
  async function loadWrong() {
    const r = await api("/api/wrong");
    if (r.status === 402) { $("#main").innerHTML = '<div class="card"><div class="empty">激活后可查看错题本</div></div>'; return; }
    if (r.status !== 200 || !r.data) return;
    state.wrongList = r.data.questions || [];
    const main = $("#main");
    if (!state.wrongList.length) {
      main.innerHTML = `<div class="card"><div class="empty">🎉 暂无错题，继续加油！</div></div>`;
      return;
    }
    const list = state.wrongList.map((q, i) => {
      const typeLabel = { single: "单选", multi: "多选", judge: "判断" }[q.type] || q.type;
      return `<div class="wrong-item" onclick="openWrong(${i})">
        <div class="wq">${q.question}</div>
        <div class="wmeta"><span>${typeLabel}</span><span>${q.chapter || ""}</span></div>
      </div>`;
    }).join("");
    main.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="color:#666;font-size:14px">共 ${r.data.count} 道错题</span>
        <button class="btn small ghost" onclick="clearWrong()">清空错题</button>
      </div>
      ${list}`;
  }

  window.openWrong = function (i) {
    const q = state.wrongList[i];
    if (!q) return;
    // 用模态框作答这道错题
    const typeLabel = { single: "单选题", multi: "多选题", judge: "判断题" }[q.type] || q.type;
    let sel = [];
    const pick = (letter) => {
      if (q.type === "multi") { const k = sel.indexOf(letter); if (k === -1) sel.push(letter); else sel.splice(k, 1); }
      else sel = [letter];
      draw();
    };
    const draw = () => {
      const mask = $("#wm"); if (!mask) return;
      const opts = (q.options || []).map((opt) => {
        const letter = letterOf(opt);
        return `<button class="opt ${sel.indexOf(letter) !== -1 ? "sel" : ""}" onclick="wmPick('${letter}')"><span class="letter">${letter}.</span>${String(opt).replace(/^[A-Z][\.、]\s*/, "")}</button>`;
      }).join("");
      mask.querySelector(".modal-body").innerHTML = `
        <div class="q-meta"><span class="tag">${typeLabel}</span><span class="tag ch">${q.chapter || ""}</span></div>
        <div class="q-stem">${q.question}</div>${opts}
        <div class="actions"><button class="btn" onclick="wmSubmit()">提交</button><button class="btn ghost" onclick="closeWm()">关闭</button></div>`;
    };
    window.wmPick = pick;
    window.wmSubmit = async () => {
      if (!sel.length) { toast("请选择答案"); return; }
      const r = await api("/api/answer", { method: "POST", body: { id: q.id, selected: sel } });
      closeWm();
      if (r.status === 200 && r.data) {
        showAnswerModal(q, r.data, sel);
      } else { toast((r.data && r.data.error) || "提交失败"); }
    };
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-mask" id="wm"><div class="modal"><h3>错题重做</h3><div class="modal-body"></div></div></div>`;
    draw();
  };

  function showAnswerModal(q, result, sel) {
    const opts = (q.options || []).map((opt) => {
      const letter = letterOf(opt);
      const ans = result.answer || [];
      const isAns = ans.indexOf(letter) !== -1;
      const isSel = sel.indexOf(letter) !== -1;
      let cls = "opt";
      if (isAns) cls += " correct"; else if (isSel) cls += " wrong";
      return `<div class="${cls}" style="cursor:default"><span class="letter">${letter}.</span>${String(opt).replace(/^[A-Z][\.、]\s*/, "")}</div>`;
    }).join("");
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-mask" onclick="if(event.target===this)closeWm()"><div class="modal">
      <h3>${result.correct ? "✓ 回答正确" : "✗ 回答错误"}</h3>
      <div class="feedback ${result.correct ? "right" : "wrong"}" style="margin-bottom:8px">正确答案：<span class="ans">${(result.answer || []).join("、")}</span></div>
      ${result.analysis ? `<div class="analysis"><b>解析</b><br>${result.analysis}</div>` : ""}
      <div style="margin-top:10px">${opts}</div>
      <div class="actions" style="margin-top:12px"><button class="btn" onclick="closeWm();loadWrong()">完成</button></div>
    </div></div>`;
  }
  window.closeWm = function () { $("#modal-root").innerHTML = ""; };

  window.clearWrong = async function () {
    if (!confirm("确定清空所有错题吗？")) return;
    await api("/api/wrong/clear", { method: "POST", body: {} });
    toast("已清空错题"); loadWrong();
  };

  /* ---------- 统计 ---------- */
  async function loadStats() {
    const r = await api("/api/stats");
    if (r.status === 402) { $("#main").innerHTML = '<div class="card"><div class="empty">激活后可查看统计</div></div>'; return; }
    if (r.status !== 200 || !r.data) return;
    state.stats = r.data;
    const s = r.data;
    const sum = s.summary || {};
    const pct = sum.total ? Math.round((sum.answered / sum.total) * 100) : 0;
    const acc = (sum.accuracy || 0).toFixed(1);

    const chRows = Object.entries(s.by_chapter || {}).map(([name, v]) => {
      const p = v.total ? Math.round((v.done / v.total) * 100) : 0;
      return `<div class="bar-row"><span class="name" title="${name}">${name}</span><div class="bar"><div style="width:${p}%"></div></div><span class="val">${v.done}/${v.total} · ${(v.accuracy || 0).toFixed(0)}%</span></div>`;
    }).join("");

    const typeRows = Object.entries(s.by_type || {}).map(([name, v]) => {
      const label = { single: "单选题", multi: "多选题", judge: "判断题" }[name] || name;
      const p = v.total ? Math.round((v.done / v.total) * 100) : 0;
      return `<div class="bar-row"><span class="name">${label}</span><div class="bar"><div style="width:${p}%"></div></div><span class="val">${v.done}/${v.total} · ${(v.accuracy || 0).toFixed(0)}%</span></div>`;
    }).join("");

    $("#main").innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${sum.answered || 0}</div><div class="lbl">已答题数</div></div>
        <div class="stat-box"><div class="num">${acc}%</div><div class="lbl">正确率</div></div>
        <div class="stat-box"><div class="num">${sum.total || 0}</div><div class="lbl">题目总数</div></div>
      </div>
      <div class="card"><h2>答题进度</h2>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="progress-text">完成 ${sum.answered || 0} / ${sum.total || 0}（${pct}%）· 正确 ${sum.correct || 0} 题</div>
      </div>
      <div class="card"><h2>各章节</h2>${chRows || '<div class="empty">暂无数据</div>'}</div>
      <div class="card"><h2>各题型</h2>${typeRows || '<div class="empty">暂无数据</div>'}</div>
      <button class="btn ghost" onclick="resetProgress()" style="margin-top:6px">重置我的答题进度</button>`;
  }

  window.resetProgress = async function () {
    if (!confirm("确定重置全部答题进度吗？此操作不可恢复。")) return;
    await api("/api/reset", { method: "POST", body: {} });
    toast("已重置"); loadStats();
  };

  /* ---------- tab 切换 ---------- */
  document.querySelectorAll(".tabbar .tab").forEach(t => {
    t.addEventListener("click", () => {
      state.tab = t.dataset.tab;
      render();
    });
  });

  /* ---------- 启动 ---------- */
  async function init() {
    const cr = await api("/api/config");
    if (cr.status === 200) state.config = cr.data;
    if (state.token) {
      const me = await api("/api/me");
      if (me.status === 200) state.user = me.data;
      else { state.token = ""; localStorage.removeItem(TOKEN_KEY); }
    }
    render();
  }
  window.render = render;
  init();
})();
