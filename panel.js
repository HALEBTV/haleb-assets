var API = "https://haleb-panel.bdwa046.workers.dev";
var PW = localStorage.getItem("pw") || "";
// who is signed in: the seller ("admin", with the password of the panel) or a distributor ("dist", with his own key).
// The distributors' part of the page is in dist.js, which is loaded before this file.
var ROLE = localStorage.getItem("role") == "dist" ? "dist" : "admin";
var DK = localStorage.getItem("dk") || "";
var DU = localStorage.getItem("du") || "";
var LR = ROLE;
var S = [], D = [], C = {}, MSG = "", Q = "", DQ = "", T = 1;
var TABS = ["السيرفرات", "الأجهزة", "الموزعون", "الإعدادات"];
var HN = ["الهوست الأساسي", "البديل الثاني", "البديل الثالث", "البديل الرابع", "البديل الخامس"];

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function p2(n) { return n < 10 ? "0" + n : "" + n; }
function say(t) { var e = $("msg"); e.textContent = t; e.style.display = "block"; clearTimeout(say.t); say.t = setTimeout(function () { e.style.display = "none"; }, 2800); }
function fail(e) {
  var m = e && e.message, c = e && e.code;
  // what the Worker said ("points", "stopped", ...) has its own words (the table is in dist.js)
  if (c && typeof ERR !== "undefined" && ERR[c]) { say(ERR[c](e)); return; }
  say(m === "401" ? (ROLE == "dist" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "كلمة المرور غير صحيحة") : (/^\d+$/.test(m || "") ? "الخادم لم ينفّذ الطلب (" + m + ")، حاول بعد قليل" : "تعذّر الاتصال بالخادم"));
}
// a request to the Worker; an answer that is not "ok" is an error: the number of the answer is the message, and
// e.status, e.code (what the Worker called the problem) and e.data (its whole answer) say the rest
function api(p, m, b) {
  var h = { "content-type": "application/json" };
  if (ROLE == "dist") { h["x-dist-key"] = DK; if (DU) h["x-dist-user"] = DU; } else h["x-admin-password"] = PW;
  return fetch(API + p, {
    method: m || "GET",
    headers: h,
    body: b ? JSON.stringify(b) : undefined
  }).then(function (r) {
    return r.json().then(function (j) { return j; }, function () { return {}; }).then(function (j) {
      if (!r.ok) {
        var e = new Error(String(r.status));
        e.status = r.status;
        e.code = j && typeof j.error === "string" ? j.error : "";
        e.data = j && typeof j === "object" ? j : {};
        throw e;
      }
      return j;
    });
  });
}

function shell() {
  $("app").innerHTML = '<div class="wrap"><h1>HALEB-TV</h1>' +
    '<div id="login" class="card"><div class="seg" id="seg"></div><div id="pub"><label>اسم المستخدم</label><input class="mono" type="text" id="pu" autocomplete="username" autocapitalize="off" spellcheck="false"></div><label id="pwl"></label><input type="password" id="pw" autocomplete="off">' +
    '<div class="row" style="margin-top:10px"><button class="btn pri" onclick="login()">دخول</button></div>' +
    '<div id="lmsg" style="color:#c4121c;margin-top:8px"></div></div>' +
    '<div id="main" style="display:none"><div class="tabs" id="tabs"></div><div id="view"></div></div></div>' +
    '<div id="bulk" class="bulk"></div><div id="msg" class="msg"></div>';
  $("pw").addEventListener("keydown", function (e) { if (e.key == "Enter") login(); });
  loginRole(LR);
}
// the login box is one for both: the seller (the password of the panel) and a distributor (his own key)
function loginRole(r) {
  LR = r;
  $("seg").innerHTML = '<button class="' + (r == "admin" ? "on" : "") + '" onclick="loginRole(\'admin\')">المدير</button>' +
    '<button class="' + (r == "dist" ? "on" : "") + '" onclick="loginRole(\'dist\')">موزّع</button>';
  $("pwl").textContent = r == "dist" ? "كلمة المرور" : "كلمة مرور اللوحة";
  $("pub").style.display = r == "dist" ? "block" : "none";
  $("pw").type = "password";
  $("pw").className = r == "dist" ? "mono" : "";
  $("pw").value = "";
  $("pu").value = "";
  $("lmsg").textContent = "";
}
function tabs() {
  $("tabs").innerHTML = TABS.map(function (n, i) {
    return '<button class="' + (T == i + 1 ? "on" : "") + '" onclick="go(' + (i + 1) + ')">' + n + '</button>';
  }).join("");
}
function go(n) { T = n; tabs(); draw(); bulkBar(); }
function draw() { if (T == 1) rS(); else if (T == 2) rD(); else if (T == 3) rDist(); else rC(); }
function logout() {
  localStorage.removeItem("pw");
  localStorage.removeItem("dk");
  localStorage.removeItem("du");
  localStorage.removeItem("role");
  location.reload();
}

function login() {
  if (LR == "dist") { dvLogin(); return; }
  ROLE = "admin";
  PW = $("pw").value;
  localStorage.setItem("pw", PW);
  localStorage.setItem("role", "admin");
  loadAll();
}
function loadAll() {
  // the distributors are a part of the panel that a Worker without them (or without its migration) does not have:
  // when that list cannot be read, the rest of the panel works as it always did
  var dl = api("/api/admin/distributors").then(function (l) { return l; }, function (e) {
    if (e && e.message === "401") throw e;
    return null;
  });
  Promise.all([api("/api/admin/servers"), api("/api/admin/devices"), api("/api/admin/config"), dl]).then(function (r) {
    S = r[0].map(function (s) {
      var h = (s.url || "").split(/[\s,;]+/).filter(Boolean);
      while (h.length < 3) h.push("");
      s.hosts = h;
      return s;
    });
    DSL = [];
    DSOK = r[3] != null;
    if (r[3]) dsMerge(r[3]);
    D = [];
    mergeD(r[1]);
    C = r[2];
    MSG = "";
    try {
      var o = JSON.parse(C.message || "");
      if (o && typeof o === "object") { MSG = o.m || ""; } else { MSG = C.message; }
    } catch (e) { MSG = C.message || ""; }
    $("login").style.display = "none";
    $("main").style.display = "block";
    tabs();
    draw();
  }).catch(function (e) {
    if (e && e.message === "401") localStorage.removeItem("pw");
    $("login").style.display = "block";
    $("main").style.display = "none";
    $("lmsg").textContent = e && e.message === "401" ? "كلمة المرور غير صحيحة" : "تعذّر الاتصال بالخادم";
  });
}

// ---- the packages ------------------------------------------------------------------------------------------
function fS(i, k, lab) {
  return '<label>' + lab + '</label><input type="text" value="' + esc(S[i][k]) + '" oninput="S[' + i + '].' + k + '=this.value">';
}
function countHosts(s) { return s.hosts.filter(function (x) { return x.trim(); }).length; }
function cnt(i) { $("cn" + i).textContent = countHosts(S[i]) + " هوست اتصال"; }

function cardS(s, i) {
  var logo = s.logoUrl ? '<img src="' + esc(s.logoUrl) + '" onerror="this.remove()">' : esc((s.nameEn || "?").charAt(0));
  var hosts = "";
  s.hosts.forEach(function (h, k) {
    hosts += '<label>' + HN[k] + '</label><input class="mono" type="text" value="' + esc(h) + '" oninput="S[' + i + '].hosts[' + k + ']=this.value;cnt(' + i + ')">';
  });
  var add = s.hosts.length < 5 ? '<button class="btn" onclick="addHost(' + i + ')">+ هوست بديل</button>' : "";
  var off = s.visible === false;
  return '<div class="card"><div class="head">' +
    '<div class="logo">' + logo + '</div><div class="num">' + p2(i + 1) + '</div>' +
    '<div class="names"><b>' + esc(s.nameEn || s.nameAr || "جديد") + '</b><small>' + esc(s.nameAr) + '</small></div>' +
    '<span class="pill' + (off ? " off" : "") + '">' + (off ? "مخفي" : "مفعّل") + '</span>' +
    '<button class="btn sm" onclick="mv(' + i + ',-1)">↑</button><button class="btn sm" onclick="mv(' + i + ',1)">↓</button>' +
    '<button class="btn sm" onclick="tgl(' + i + ')">✎</button><button class="btn sm x" onclick="del(' + i + ')">✕</button></div>' +
    '<div' + (s.open ? "" : ' style="display:none"') + '>' + fS(i, "nameAr", "الاسم بالعربي") + fS(i, "nameEn", "الاسم بالإنجليزي") + fS(i, "logoUrl", "رابط الشعار (https)") + '</div>' +
    hosts + '<div class="row" style="margin-top:10px">' + add + '</div>' +
    '<div class="foot"><label class="sw"><input type="checkbox" ' + (off ? "" : "checked") + ' onchange="S[' + i + '].visible=this.checked;listS()"> ظاهر في التطبيق</label>' +
    '<span id="cn' + i + '">' + countHosts(s) + ' هوست اتصال</span></div></div>';
}
function rS() {
  $("view").innerHTML = '<div class="bar"><input type="text" id="q" placeholder="ابحث عن سيرفر..." value="' + esc(Q) + '" oninput="Q=this.value;listS()">' +
    '<button class="btn sm" onclick="addS()">+</button><button class="btn pri sm" onclick="saveS()">حفظ</button></div><div id="list"></div>';
  listS();
}
function listS() {
  var q = Q.toLowerCase(), h = "";
  S.forEach(function (s, i) {
    var hay = (s.nameAr + " " + s.nameEn + " " + s.hosts.join(" ")).toLowerCase();
    if (q && hay.indexOf(q) < 0) return;
    h += cardS(s, i);
  });
  $("list").innerHTML = h || '<div class="card">لا توجد سيرفرات</div>';
}
function addS() {
  S.push({ id: String(Date.now()), nameAr: "", nameEn: "", logoUrl: "", url: "", visible: true, hosts: ["", "", ""], open: true });
  Q = "";
  $("q").value = "";
  listS();
  window.scrollTo(0, document.body.scrollHeight);
}
function addHost(i) { S[i].hosts.push(""); listS(); }
function tgl(i) { S[i].open = !S[i].open; listS(); }
function del(i) { if (confirm("حذف هذا السيرفر؟")) { S.splice(i, 1); listS(); } }
function mv(i, d) {
  var j = i + d;
  if (j < 0 || j >= S.length) return;
  var t = S[i]; S[i] = S[j]; S[j] = t;
  listS();
}
function saveS() {
  var out = S.map(function (s) {
    return {
      id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, logoUrl: s.logoUrl,
      url: s.hosts.map(function (x) { return x.trim(); }).filter(Boolean).join(","),
      visible: s.visible !== false
    };
  });
  api("/api/admin/servers", "PUT", out).then(function () { say("تم حفظ السيرفرات"); }).catch(fail);
}

// ---- the devices -------------------------------------------------------------------------------------------
// A device is "active" (works), "stopped" (the seller stopped it), "expired" (its time is over) or "waiting"
// (new, with no trial: it waits for the seller to activate it). The Worker decides the same way.
var DAY = 86400000;
var DF = "all", DS = "new", DSHOW = 50, DLOAD = 0, ADD = false, BUSY = false, DDF = "";
var SEL = {};
var CHIPS = [["all", "الكل"], ["active", "فعّال"], ["expired", "منتهٍ"], ["stopped", "موقوف"], ["waiting", "بانتظار التفعيل"], ["new", "جديد"]];
var SORTS = [["new", "الأحدث تسجيلاً"], ["seen", "آخر ظهور"], ["exp", "الأقرب انتهاءً"], ["mac", "الماك"]];
var LENGTHS = [[30, "30 يوم"], [90, "3 أشهر"], [180, "6 أشهر"], [365, "سنة"]];

function newId() { return Math.random().toString(36).slice(2, 8); }
function validMac(m) { return /^[0-9A-F:]{11,17}$/.test(m); }
function kid(m) { return m.replace(/:/g, ""); }
function find(m) {
  for (var i = 0; i < D.length; i++) if (D[i].mac === m) return D[i];
  return null;
}
function drop(m) {
  for (var i = 0; i < D.length; i++) if (D[i].mac === m) { D.splice(i, 1); break; }
  delete SEL[m];
}
function t0(s) { var t = Date.parse(s); return t == t ? t : 0; }

function stOf(d) {
  if (d.active === false) return "stopped";
  var e = Date.parse(d.expiry);
  if (e > Date.now()) return "active";
  return Math.abs(e - Date.parse(d.created)) < 60000 ? "waiting" : "expired";
}
function isNew(d) { return Date.now() - Date.parse(d.created) < 2 * DAY; }
function prep(d) {
  d.active = d.active !== false;
  d.key = d.key || "";
  d.note = d.note || "";
  d.dist = d.dist || "";
  d.playlists = d.playlists || [];
  d._st = stOf(d);
  return d;
}
// the list from the server joins the list in the page; a device with changes that are not saved yet keeps them
function mergeD(list) {
  var old = {}, i;
  for (i = 0; i < D.length; i++) old[D[i].mac] = D[i];
  var out = [];
  for (i = 0; i < list.length; i++) {
    var n = list[i];
    if (!validMac(n.mac)) continue;
    var o = old[n.mac];
    if (o && (o._dirty || o._busy)) { o.last_seen = n.last_seen; o.key = n.key || o.key; out.push(o); continue; }
    if (o) n._open = o._open;
    out.push(prep(n));
  }
  D = out;
  for (var k in SEL) if (!find(k)) delete SEL[k];
  DLOAD = Date.now();
}

function ago(iso) {
  if (!iso) return "غير مسجّل بعد";
  var s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (!(s >= 0)) s = 0;
  if (s < 120) return "الآن";
  var m = Math.floor(s / 60);
  if (m < 60) return "منذ " + m + " د";
  var h = Math.floor(m / 60);
  if (h < 48) return "منذ " + h + " س";
  return "منذ " + Math.floor(h / 24) + " يوم";
}
function fmt(iso) {
  var t = new Date(iso);
  if (isNaN(t.getTime())) return "—";
  return t.getFullYear() + "-" + p2(t.getMonth() + 1) + "-" + p2(t.getDate()) + " " + p2(t.getHours()) + ":" + p2(t.getMinutes());
}
function daysLeft(d) { return Math.ceil((Date.parse(d.expiry) - Date.now()) / DAY); }

function pillOf(d) {
  var s = d._st;
  if (s == "active") return '<span class="pill">فعّال · ' + daysLeft(d) + ' يوم</span>';
  if (s == "stopped") return '<span class="pill off">موقوف</span>';
  if (s == "waiting") return '<span class="pill wait">بانتظار التفعيل</span>';
  var gone = Math.floor((Date.now() - Date.parse(d.expiry)) / DAY);
  return '<span class="pill off">منتهٍ' + (gone >= 1 ? " منذ " + gone + " يوم" : "") + '</span>';
}
function metaOf(d) {
  var p = [], rec = d.last_seen && Date.now() - Date.parse(d.last_seen) < 600000;
  p.push((rec ? '<span class="dot"></span>' : "") + "آخر ظهور: " + ago(d.last_seen));
  if (d._st == "stopped" && Date.parse(d.expiry) > Date.now()) p.push("متبقٍ " + daysLeft(d) + " يوم");
  if (d.playlists.length) p.push("M3U " + d.playlists.length);
  // the seller sees whose device it is (a distributor's page has only his own devices, and no such field)
  if (ROLE == "admin" && d.dist) p.push('<span class="tag dtag">' + esc(distName(d.dist) || "موزع محذوف") + '</span>');
  if (isNew(d)) p.push('<span class="tag">جديد</span>');
  return p.join(" · ");
}

function plBlock(d) {
  var k = "'" + d.mac + "'", h = "";
  d.playlists.forEach(function (p, j) { h += plRow(p, k, j, "edPL", "delPL"); });
  return h;
}
function pickBox(d) {
  var k = "'" + d.mac + "'";
  var h = '<div class="pick"><span>' + (d._st == "active" ? "تمديد بـ" : "تفعيل لمدة") + '</span>';
  LENGTHS.forEach(function (x) { h += '<button class="btn" onclick="addDays(' + k + ',' + x[0] + ')">' + x[1] + '</button>'; });
  return h + '</div>';
}
// who owns the device: the seller himself or one of the distributors (their points pay for the activations they make)
function distPick(d) {
  var k = "'" + d.mac + "'", known = false, o = "";
  DSL.forEach(function (x) {
    if (x.id === d.dist) known = true;
    o += '<option value="' + esc(x.id) + '"' + (x.id === d.dist ? " selected" : "") + '>' + esc(x.name) + (x.active ? "" : " (معطّل)") + '</option>';
  });
  if (d.dist && !known) o += '<option value="' + esc(d.dist) + '" selected>موزع غير معروف</option>';
  return '<label>الموزع صاحب الجهاز</label><select onchange="edDist(' + k + ',this.value)" style="width:100%">' +
    '<option value=""' + (d.dist ? "" : " selected") + '>— بدون موزع (لي) —</option>' + o + '</select>';
}
function edDist(m, v) {
  var d = find(m);
  if (!d) return;
  d.dist = v; d._distSet = true; d._dirty = true;
}
function detailsOf(d) {
  var k = "'" + d.mac + "'";
  return '<div class="det"><label>Device Key: ' + esc(d.key || "—") + '</label><label>سُجّل: ' + fmt(d.created) + '</label>' +
    '<label>انتهاء التفعيل</label><input type="date" value="' + esc((d.expiry || "").slice(0, 10)) + '" onchange="setExp(' + k + ',this.value)">' +
    '<label>ملاحظة (اسم الزبون)</label><input type="text" value="' + esc(d.note) + '" oninput="ed(' + k + ',\'note\',this.value)">' +
    (DSOK ? distPick(d) : "") +
    '<label>اشتراكات M3U (تظهر للزبون أول القائمة ويدخلها بضغطة واحدة)</label>' +
    '<div id="pl-' + kid(d.mac) + '">' + plBlock(d) + '</div>' +
    '<div class="row" style="margin-top:8px"><button class="btn go" onclick="addPL(' + k + ',1)">' + PLBTN + '</button><button class="btn" onclick="addPL(' + k + ')">+ رابط M3U</button></div>' +
    '<div class="foot"><label class="sw"><input type="checkbox" ' + (d.active !== false ? "checked" : "") + ' onchange="ed(' + k + ',\'active\',this.checked)"> مفعّل</label>' +
    '<span class="row"><button class="btn x" onclick="delD(' + k + ')">حذف نهائي</button><button class="btn pri" onclick="saveD(' + k + ')">حفظ</button></span></div></div>';
}
function cardD(d) {
  var m = d.mac, k = "'" + m + "'", s = d._st, b = d._busy ? " disabled" : "", acts;
  if (s == "active") acts = '<button class="btn" onclick="pickD(' + k + ')"' + b + '>تمديد</button><button class="btn stop" onclick="stopD(' + k + ')"' + b + '>إيقاف</button>';
  else if (s == "stopped") acts = '<button class="btn go" onclick="startD(' + k + ')"' + b + '>تفعيل</button>';
  else acts = '<button class="btn go" onclick="pickD(' + k + ')"' + b + '>تفعيل</button>';
  acts += '<button class="btn" onclick="openD(' + k + ')">' + (d._open ? "إخفاء ⌃" : "تفاصيل ⌄") + '</button>';
  return '<div class="card dev' + (SEL[m] ? " sel" : "") + '" id="dv-' + kid(m) + '"><div class="head">' +
    '<label class="chk"><input type="checkbox"' + (SEL[m] ? " checked" : "") + ' onchange="selD(' + k + ',this.checked)"></label>' +
    '<div class="names"><div class="mac">' + esc(m) + '</div><small>' + (d.note ? esc(d.note) : "بدون ملاحظة") + '</small></div>' + pillOf(d) + '</div>' +
    '<div class="meta">' + metaOf(d) + '</div><div class="acts">' + acts + '</div>' +
    (d._pick ? pickBox(d) : "") + (d._open ? detailsOf(d) : "") + '</div>';
}

var CMP = {
  "new": function (a, b) { return t0(b.created) - t0(a.created); },
  "seen": function (a, b) { return t0(b.last_seen) - t0(a.last_seen); },
  "exp": function (a, b) {
    var x = a._st == "active" ? 0 : 1, y = b._st == "active" ? 0 : 1;
    if (x != y) return x - y;
    return x == 0 ? t0(a.expiry) - t0(b.expiry) : t0(b.expiry) - t0(a.expiry);
  },
  "mac": function (a, b) { return a.mac < b.mac ? -1 : (a.mac > b.mac ? 1 : 0); }
};
function inFilter(d) { return DF == "all" || (DF == "new" ? isNew(d) : d._st == DF); }
// DDF: "" every device, "-" the seller's own, otherwise the id of one distributor
function inOwner(d) { return DDF === "" || (DDF === "-" ? !d.dist : d.dist === DDF); }
function viewD() {
  var q = DQ.trim().toLowerCase(), qn = q.replace(/[:\s-]/g, ""), out = [];
  for (var i = 0; i < D.length; i++) {
    var d = D[i];
    if (!inFilter(d) || !inOwner(d)) continue;
    if (q) {
      var names = d.playlists.map(function (p) { return p.name; }).join(" ");
      var hay = (d.mac + " " + d.mac.replace(/:/g, "") + " " + d.key + " " + d.note + " " + names).toLowerCase();
      if (hay.indexOf(q) < 0 && (!qn || hay.indexOf(qn) < 0)) continue;
    }
    out.push(d);
  }
  return out.sort(CMP[DS]);
}
function counts() {
  var c = { all: 0, active: 0, expired: 0, stopped: 0, waiting: 0, "new": 0 };
  D.forEach(function (d) { c.all++; c[d._st]++; if (isNew(d)) c["new"]++; });
  return c;
}

// the devices of one distributor only (shown when there are distributors)
function ownerSel() {
  if (!DSOK || !DSL.length) return "";
  var o = '<option value=""' + (DDF === "" ? " selected" : "") + '>كل الأجهزة</option><option value="-"' + (DDF === "-" ? " selected" : "") + '>أجهزتي بدون موزع</option>';
  DSL.forEach(function (x) { o += '<option value="' + esc(x.id) + '"' + (DDF === x.id ? " selected" : "") + '>' + esc(x.name) + '</option>'; });
  return '<select id="dd" onchange="DDF=this.value;DSHOW=50;listD()">' + o + '</select>';
}
function rD() {
  var so = SORTS.map(function (x) { return '<option value="' + x[0] + '"' + (DS == x[0] ? " selected" : "") + '>' + x[1] + '</option>'; }).join("");
  $("view").innerHTML = '<div class="bar"><input type="text" id="dq" placeholder="ابحث بالماك أو الاسم أو المفتاح..." value="' + esc(DQ) + '" oninput="DQ=this.value;DSHOW=50;listD()">' +
    '<button class="btn sm" id="dref" onclick="reloadD()" title="تحديث">↻</button></div>' +
    '<div class="row" style="margin-bottom:8px"><button class="btn" onclick="toggleAdd()">+ إضافة جهاز</button>' +
    '<select id="ds" onchange="DS=this.value;DSHOW=50;listD()">' + so + '</select>' + ownerSel() + '</div>' +
    '<div id="dadd">' + (ADD ? addForm() : "") + '</div>' +
    '<div class="chips" id="dchips"></div><div id="dsel"></div><div id="dlist"></div><div id="dmore"></div>';
  listD();
}
function listD() {
  var v = viewD(), cn = counts(), n = Math.min(v.length, DSHOW), h = "", i, all = v.length > 0;
  $("dchips").innerHTML = CHIPS.map(function (c) {
    return '<button class="chip' + (DF == c[0] ? " on" : "") + '" onclick="DF=\'' + c[0] + '\';DSHOW=50;listD()">' + c[1] + ' <b>' + cn[c[0]] + '</b></button>';
  }).join("");
  for (i = 0; i < v.length; i++) if (!SEL[v[i].mac]) { all = false; break; }
  $("dsel").innerHTML = v.length ? '<div class="selrow"><label class="sw"><input type="checkbox" id="sall"' + (all ? " checked" : "") + ' onchange="selAll(this.checked)"> تحديد الكل (' + v.length + ')</label>' +
    '<small id="dtime">عرض ' + n + ' من ' + v.length + ' · آخر تحديث ' + p2(new Date(DLOAD).getHours()) + ":" + p2(new Date(DLOAD).getMinutes()) + '</small></div>' : "";
  for (i = 0; i < n; i++) h += cardD(v[i]);
  $("dlist").innerHTML = h || '<div class="card">' + (D.length ? "لا توجد نتائج" : "لا توجد أجهزة بعد.") + '</div>';
  $("dmore").innerHTML = v.length > n ? '<button class="btn" style="width:100%;margin-bottom:12px" onclick="DSHOW+=50;listD()">عرض المزيد (' + (v.length - n) + ')</button>' : "";
  bulkBar();
}

function reloadD(quiet) {
  var b = $("dref");
  if (b) b.disabled = true;
  return api("/api/admin/devices").then(function (list) {
    mergeD(list);
    if (T == 2) listD();
    if (b) b.disabled = false;
    if (!quiet) say("تم التحديث");
  }).catch(function (e) {
    if (b) b.disabled = false;
    if (!quiet) fail(e);
  });
}
// coming back to the page after a while (from WhatsApp, say): the list is brought up to date by itself
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && PW && T == 2 && DLOAD && Date.now() - DLOAD > 60000 && !BUSY) reloadD(true);
});

function body(d, withLists) {
  var o = { mac: d.mac, expiry: d.expiry, active: d.active !== false, note: (d.note || "").trim() };
  if (withLists) o.playlists = d.playlists;
  // the owner is sent only when the seller changed it in the details: "" gives the device back to him
  if (d._distSet) o.dist = d.dist || null;
  return o;
}
// one change of a device, saved at once; when the server does not accept it, the change is taken back
function quick(d, change, msg) {
  if (d._busy || BUSY) return;
  var o = { expiry: d.expiry, active: d.active };
  change();
  d._busy = true; d._pick = false; d._st = stOf(d);
  listD();
  api("/api/admin/devices", "PUT", body(d, false)).then(function () {
    d._busy = false; listD(); say(typeof msg == "function" ? msg() : msg);
  }).catch(function (e) {
    d.expiry = o.expiry; d.active = o.active; d._busy = false; d._st = stOf(d); listD(); fail(e);
  });
}
function pickD(m) {
  var d = find(m);
  if (!d) return;
  d._pick = !d._pick;
  listD();
}
function openD(m) {
  var d = find(m);
  if (!d) return;
  d._open = !d._open;
  listD();
}
function stopD(m) {
  var d = find(m);
  if (!d || !confirm("إيقاف الجهاز " + m + (d.note ? " (" + d.note + ")" : "") + " ؟")) return;
  quick(d, function () { d.active = false; }, "تم إيقاف الجهاز");
}
function startD(m) {
  var d = find(m);
  if (!d) return;
  if (Date.parse(d.expiry) > Date.now()) quick(d, function () { d.active = true; }, "تم تفعيل الجهاز");
  else pickD(m);
}
function addDays(m, n) {
  var d = find(m);
  if (!d) return;
  quick(d, function () {
    d.expiry = new Date(Math.max(Date.now(), t0(d.expiry)) + n * DAY).toISOString();
    d.active = true;
  }, function () { return "تم التفعيل حتى " + d.expiry.slice(0, 10); });
}

// the details of a device (what is typed stays in the page until "حفظ")
function ed(m, k, v) {
  var d = find(m);
  if (!d) return;
  d[k] = v; d._dirty = true;
  d._st = stOf(d);
}
function setExp(m, v) {
  var d = find(m);
  if (!d || !v) return;
  d.expiry = v + "T23:59:59.000Z"; d._dirty = true;
  d._st = stOf(d);
}
function edPL(m, j, k, v) {
  var d = find(m);
  if (!d || !d.playlists[j]) return;
  d.playlists[j][k] = v; d._dirty = true;
}
function addPL(m, srv) {
  var d = find(m);
  if (!d) return;
  d.playlists.push(srv ? { id: newId(), name: "", server: "", user: "", pass: "" } : { id: newId(), name: "", url: "" });
  d._dirty = true;
  $("pl-" + kid(m)).innerHTML = plBlock(d);
}
function delPL(m, j) {
  var d = find(m);
  if (!d || !confirm("حذف هذا الاشتراك من الجهاز؟")) return;
  d.playlists.splice(j, 1);
  d._dirty = true;
  $("pl-" + kid(m)).innerHTML = plBlock(d);
}
function saveD(m) {
  var d = find(m);
  if (!d || d._busy) return;
  var pl = plClean(d.playlists);
  if (!pl) return;
  d.playlists = pl;
  d._busy = true;
  api("/api/admin/devices", "PUT", body(d, true)).then(function () {
    d._busy = false; d._dirty = false; d._open = false; d._st = stOf(d);
    var moved = d._distSet;
    d._distSet = false;
    listD(); say("تم حفظ الجهاز");
    if (moved) dsReload(true);   // the count of devices of each distributor
  }).catch(function (e) { d._busy = false; listD(); fail(e); });
}
function delD(m) {
  var d = find(m);
  if (!d || !confirm("حذف الجهاز " + m + (d.note ? " (" + d.note + ")" : "") + " نهائياً؟\nيُمحى كل ما عليه (الملاحظة والاشتراكات) ولا يمكن التراجع.\nإن فتح التطبيق من جديد يُسجَّل كجهاز جديد.")) return;
  api("/api/admin/devices?mac=" + encodeURIComponent(m), "DELETE").then(function () {
    drop(m); listD(); say("تم حذف الجهاز");
  }).catch(fail);
}

// a device added by hand: the seller knows the MAC of the customer before the customer opens the app
function normMac(s) {
  var t = String(s || "").trim();
  if (!/^[0-9a-f]{2}([:\-. ]?[0-9a-f]{2}){5}$/i.test(t)) return "";
  return t.toUpperCase().replace(/[^0-9A-F]/g, "").match(/.{2}/g).join(":");
}
function addForm() {
  var o = LENGTHS.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join("");
  return '<div class="card"><label>الماك (12 خانة، بالنقطتين أو بدونهما)</label>' +
    '<input class="mono" type="text" id="nm" placeholder="AA:BB:CC:DD:EE:FF" autocapitalize="characters" autocomplete="off">' +
    '<label>اسم الزبون (اختياري)</label><input type="text" id="nn">' +
    '<label>مدة التفعيل</label><select id="nd">' + o + '</select>' +
    '<div class="row" style="margin-top:10px"><button class="btn pri" onclick="addDev()">إضافة</button><button class="btn" onclick="toggleAdd()">إلغاء</button></div></div>';
}
function toggleAdd() {
  ADD = !ADD;
  $("dadd").innerHTML = ADD ? addForm() : "";
  if (ADD) $("nm").focus();
}
function addDev() {
  var m = normMac($("nm").value);
  if (!m) { say("الماك غير صحيح: 12 خانة من 0-9 و A-F"); return; }
  if (find(m)) {
    DQ = m; DF = "all"; DSHOW = 50; ADD = false; rD();
    say("هذا الجهاز موجود، هذه بطاقته");
    return;
  }
  var exp = new Date(Date.now() + (Number($("nd").value) || 30) * DAY).toISOString();
  api("/api/admin/devices", "PUT", { mac: m, expiry: exp, active: true, note: $("nn").value.trim().slice(0, 500) }).then(function () {
    DQ = m; DF = "all"; DSHOW = 50; ADD = false;
    return api("/api/admin/devices").then(function (list) { mergeD(list); if (T == 2) rD(); say("تمت إضافة الجهاز وتفعيله"); });
  }).catch(fail);
}

// the selection: one action for many devices
function selD(m, on) {
  if (on) SEL[m] = 1; else delete SEL[m];
  var e = $("dv-" + kid(m));
  if (e) e.className = "card dev" + (on ? " sel" : "");
  var a = $("sall");
  if (a && !on) a.checked = false;
  bulkBar();
}
function selAll(on) {
  viewD().forEach(function (d) { if (on) SEL[d.mac] = 1; else delete SEL[d.mac]; });
  listD();
}
function clearSel() { SEL = {}; listD(); }
function bulkBar() {
  var n = 0, k, e = $("bulk");
  for (k in SEL) n++;
  var on = T == 2 && n > 0;
  document.body.className = on ? "hasbulk" : "";
  e.style.display = on ? "flex" : "none";
  e.innerHTML = on ? '<b>محدد: ' + n + '</b>' +
    '<button class="btn go" onclick="bulk(\'start\')"' + (BUSY ? " disabled" : "") + '>تفعيل +30 يوم</button>' +
    '<button class="btn" onclick="bulk(\'stop\')"' + (BUSY ? " disabled" : "") + '>إيقاف</button>' +
    '<button class="btn x" onclick="bulk(\'del\')"' + (BUSY ? " disabled" : "") + '>حذف</button>' +
    '<button class="btn" onclick="clearSel()">إلغاء</button>' : "";
}
function bulkOne(m, kind) {
  var d = find(m);
  if (!d) return Promise.resolve(false);
  if (kind == "del") {
    return api("/api/admin/devices?mac=" + encodeURIComponent(m), "DELETE").then(function () { drop(m); return true; }, function () { return false; });
  }
  var ex = d.expiry, ac = d.active;
  if (kind == "stop") ac = false;
  else { ac = true; ex = new Date(Math.max(Date.now(), t0(d.expiry)) + 30 * DAY).toISOString(); }
  return api("/api/admin/devices", "PUT", { mac: m, expiry: ex, active: ac, note: (d.note || "").trim() }).then(function () {
    d.expiry = ex; d.active = ac; d._st = stOf(d); delete SEL[m];
    return true;
  }, function () { return false; });
}
function bulk(kind) {
  var ms = [], k;
  for (k in SEL) if (find(k)) ms.push(k);
  if (!ms.length || BUSY) return;
  var what = { start: "تفعيل " + ms.length + " جهاز لمدة 30 يوم (يُضاف إلى المدة المتبقية)", stop: "إيقاف " + ms.length + " جهاز",
    del: "حذف " + ms.length + " جهاز نهائياً؟\nلا يمكن التراجع. إن فتح أحدها التطبيق من جديد يُسجَّل كجهاز جديد" }[kind];
  if (!confirm(what + " ؟")) return;
  BUSY = true; bulkBar();
  var i = 0, running = 0, done = 0, okN = 0;
  function finish() {
    BUSY = false;
    listD();
    say("تم: " + okN + (okN < ms.length ? " · لم ينجح: " + (ms.length - okN) + " (ما زالت محددة)" : ""));
  }
  function next() {
    while (running < 6 && i < ms.length) {
      running++;
      bulkOne(ms[i++], kind).then(function (r) {
        running--; done++;
        if (r) okN++;
        say("جارٍ التنفيذ... " + done + " / " + ms.length);
        if (done == ms.length) finish(); else next();
      });
    }
  }
  next();
}

// ---- the settings ------------------------------------------------------------------------------------------
function fc(k, lab, t, hint) {
  return '<label>' + lab + '</label><input type="' + t + '" value="' + esc(C[k]) + '" oninput="C.' + k + '=this.value">' +
    (hint ? '<small class="hint">' + hint + '</small>' : "");
}
function rC() {
  $("view").innerHTML = '<div class="card">' + fc("version", "رقم إصدار التطبيق", "text") + fc("updateUrl", "رابط تحديث التطبيق (APK)", "text") +
    '<label>رسالة لكل المستخدمين</label><input type="text" value="' + esc(MSG) + '" oninput="MSG=this.value">' +
    fc("trialDays", "أيام التجربة للجهاز الجديد", "number", "0 = بلا تجربة: الجهاز الجديد يظهر في «الأجهزة» بحالة «بانتظار التفعيل» ولا يعمل حتى تفعّله أنت.") +
    fc("speedTestUrl", "رابط ملف اختبار السرعة (اختياري)", "text") +
    (C.contactPhone !== undefined ? fc("contactPhone", "رقم واتساب الإدارة (يفتحه رمز QR في التطبيق)", "text",
      "بالصيغة الدولية بدون + ولا صفر في أولها، مثل 905374566687. الزبون الذي ليس له موزع يتواصل مع هذا الرقم، وزبائن كل موزع يتواصلون مع رقم موزعهم.") : "") +
    '<div class="row" style="margin-top:12px"><button class="btn pri" onclick="saveC()">حفظ الإعدادات</button><button class="btn" onclick="logout()">خروج</button></div></div>';
}
function saveC() {
  // "matches" stays in the stored message as an empty list: old app versions read that key
  var body = {
    version: C.version, updateUrl: C.updateUrl, trialDays: C.trialDays, speedTestUrl: C.speedTestUrl,
    message: JSON.stringify({ m: MSG, matches: [] })
  };
  // sent only when the Worker has told this panel the number (an older Worker does not know it)
  if (C.contactPhone !== undefined) body.contactPhone = String(C.contactPhone || "").trim();
  api("/api/admin/config", "PUT", body).then(function () { say("تم الحفظ"); }).catch(fail);
}

shell();
if (ROLE == "dist") { if (DK) distLoad(); } else if (PW) loadAll();
