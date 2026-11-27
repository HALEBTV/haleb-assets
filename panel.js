var API = "https://haleb-panel.bdwa046.workers.dev";
var PW = localStorage.getItem("pw") || "";
var S = [], D = [], C = {}, MSG = "", Q = "", DQ = "", T = 1;
var TABS = ["السيرفرات", "الأجهزة", "الإعدادات"];
var HN = ["الهوست الأساسي", "البديل الثاني", "البديل الثالث", "البديل الرابع", "البديل الخامس"];

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function p2(n) { return n < 10 ? "0" + n : "" + n; }
function say(t) { var e = $("msg"); e.textContent = t; e.style.display = "block"; setTimeout(function () { e.style.display = "none"; }, 2500); }
function fail(e) { say(e && e.message === "401" ? "كلمة المرور غير صحيحة" : "تعذّر الاتصال بالخادم"); }
function api(p, m, b) {
  return fetch(API + p, {
    method: m || "GET",
    headers: { "content-type": "application/json", "x-admin-password": PW },
    body: b ? JSON.stringify(b) : undefined
  }).then(function (r) {
    if (r.status == 401) throw new Error("401");
    return r.json();
  });
}

function shell() {
  $("app").innerHTML = '<div class="wrap"><h1>HALEB-TV</h1>' +
    '<div id="login" class="card"><label>كلمة مرور اللوحة</label><input type="password" id="pw">' +
    '<div class="row" style="margin-top:10px"><button class="btn pri" onclick="login()">دخول</button></div>' +
    '<div id="lmsg" style="color:#c4121c;margin-top:8px"></div></div>' +
    '<div id="main" style="display:none"><div class="tabs" id="tabs"></div><div id="view"></div></div></div>' +
    '<div id="msg" class="msg"></div>';
}
function tabs() {
  $("tabs").innerHTML = TABS.map(function (n, i) {
    return '<button class="' + (T == i + 1 ? "on" : "") + '" onclick="go(' + (i + 1) + ')">' + n + '</button>';
  }).join("");
}
function go(n) { T = n; tabs(); draw(); }
function draw() { if (T == 1) rS(); else if (T == 2) rD(); else rC(); }
function logout() { localStorage.removeItem("pw"); location.reload(); }

function login() { PW = $("pw").value; localStorage.setItem("pw", PW); loadAll(); }
function loadAll() {
  Promise.all([api("/api/admin/servers"), api("/api/admin/devices"), api("/api/admin/config")]).then(function (r) {
    S = r[0].map(function (s) {
      var h = (s.url || "").split(/[\s,;]+/).filter(Boolean);
      while (h.length < 3) h.push("");
      s.hosts = h;
      return s;
    });
    D = r[1];
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

function newId() { return Math.random().toString(36).slice(2, 8); }

// the M3U subscriptions of one device: a name (shown to the customer in the app) and a link each
function plBlock(i) {
  var h = "";
  (D[i].playlists || []).forEach(function (p, j) {
    h += '<div class="pl"><input type="text" placeholder="اسم الاشتراك (يظهر للزبون)" value="' + esc(p.name) + '" oninput="D[' + i + '].playlists[' + j + '].name=this.value">' +
      '<div class="row" style="margin-top:6px;flex-wrap:nowrap"><input class="mono" type="text" placeholder="http://...get.php?username=...&password=..." value="' + esc(p.url) + '" oninput="D[' + i + '].playlists[' + j + '].url=this.value" style="flex:1;min-width:0">' +
      '<button class="btn sm x" onclick="delPL(' + i + ',' + j + ')">✕</button></div></div>';
  });
  return h;
}
function addPL(i) {
  if (!D[i].playlists) D[i].playlists = [];
  D[i].playlists.push({ id: newId(), name: "", url: "" });
  $("pl" + i).innerHTML = plBlock(i);
}
function delPL(i, j) {
  if (!confirm("حذف هذا الاشتراك من الجهاز؟")) return;
  D[i].playlists.splice(j, 1);
  $("pl" + i).innerHTML = plBlock(i);
}

function cardD(d, i) {
  var days = Math.ceil((new Date(d.expiry).getTime() - Date.now()) / 86400000);
  var st = d.active === false ? '<span class="pill off">موقوف</span>' : (days < 0 ? '<span class="pill off">منتهٍ</span>' : '<span class="pill">' + days + ' يوم</span>');
  var n = (d.playlists || []).length;
  return '<div class="card"><div class="head"><div class="mac names">' + esc(d.mac) + '</div>' + (n ? '<span class="pill">M3U ' + n + '</span>' : '') + st + '</div>' +
    '<label>Device Key: ' + esc(d.key) + '</label>' +
    '<label>انتهاء التفعيل</label><input type="date" value="' + esc((d.expiry || "").slice(0, 10)) + '" onchange="setExp(' + i + ',this.value)">' +
    '<label>ملاحظة (اسم الزبون)</label><input type="text" value="' + esc(d.note) + '" oninput="D[' + i + '].note=this.value">' +
    '<label>اشتراكات M3U (تظهر للزبون أول القائمة ويدخلها بضغطة واحدة)</label>' +
    '<div id="pl' + i + '">' + plBlock(i) + '</div>' +
    '<div class="row" style="margin-top:8px"><button class="btn" onclick="addPL(' + i + ')">+ إضافة اشتراك M3U</button></div>' +
    '<div class="foot"><label class="sw"><input type="checkbox" ' + (d.active !== false ? "checked" : "") + ' onchange="D[' + i + '].active=this.checked"> مفعّل</label>' +
    '<span class="row"><button class="btn" onclick="ext(' + i + ',30)">+30</button><button class="btn" onclick="ext(' + i + ',365)">+سنة</button>' +
    '<button class="btn pri" onclick="saveD(' + i + ')">حفظ</button></span></div></div>';
}
function rD() {
  $("view").innerHTML = '<div class="bar"><input type="text" id="dq" placeholder="ابحث بالماك أو الاسم أو المفتاح..." value="' + esc(DQ) + '" oninput="DQ=this.value;listD()"></div><div id="dlist"></div>';
  listD();
}
function listD() {
  var q = DQ.trim().toLowerCase(), h = "";
  D.forEach(function (d, i) {
    var names = (d.playlists || []).map(function (p) { return p.name; }).join(" ");
    var hay = ((d.mac || "") + " " + (d.key || "") + " " + (d.note || "") + " " + names).toLowerCase();
    if (q && hay.indexOf(q) < 0) return;
    h += cardD(d, i);
  });
  $("dlist").innerHTML = h || '<div class="card">' + (D.length ? "لا توجد نتائج" : "لا توجد أجهزة بعد.") + '</div>';
}
function setExp(i, v) { if (v) D[i].expiry = v + "T23:59:59.000Z"; }
function ext(i, n) {
  var b = Math.max(Date.now(), new Date(D[i].expiry).getTime());
  D[i].expiry = new Date(b + n * 86400000).toISOString();
  listD();
}
function saveD(i) {
  var d = D[i], pl = [];
  // a row without a link is dropped; a link written without http:// gets it
  (d.playlists || []).forEach(function (p) {
    var u = (p.url || "").trim();
    if (!u) return;
    if (u.indexOf("://") < 0) u = "http://" + u;
    pl.push({ id: p.id || newId(), name: (p.name || "").trim(), url: u });
  });
  d.playlists = pl;
  api("/api/admin/devices", "PUT", d).then(function () { say("تم حفظ الجهاز"); listD(); }).catch(fail);
}

function fc(k, lab, t) {
  return '<label>' + lab + '</label><input type="' + t + '" value="' + esc(C[k]) + '" oninput="C.' + k + '=this.value">';
}
function rC() {
  $("view").innerHTML = '<div class="card">' + fc("version", "رقم إصدار التطبيق", "text") + fc("updateUrl", "رابط تحديث التطبيق (APK)", "text") +
    '<label>رسالة لكل المستخدمين</label><input type="text" value="' + esc(MSG) + '" oninput="MSG=this.value">' +
    fc("trialDays", "أيام التجربة للجهاز الجديد", "number") + fc("speedTestUrl", "رابط ملف اختبار السرعة (اختياري)", "text") +
    '<div class="row" style="margin-top:12px"><button class="btn pri" onclick="saveC()">حفظ الإعدادات</button><button class="btn" onclick="logout()">خروج</button></div></div>';
}
function saveC() {
  // "matches" stays in the stored message as an empty list: old app versions read that key
  var body = {
    version: C.version, updateUrl: C.updateUrl, trialDays: C.trialDays, speedTestUrl: C.speedTestUrl,
    message: JSON.stringify({ m: MSG, matches: [] })
  };
  api("/api/admin/config", "PUT", body).then(function () { say("تم الحفظ"); }).catch(fail);
}

shell();
if (PW) loadAll();
