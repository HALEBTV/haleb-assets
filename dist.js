// HALEB-TV panel: the distributors.
//   the seller's tab "الموزعون"  (dsXxx): create a distributor, give or take points, see the log, change or delete him
//   the page of a distributor    (dvXxx): his points, his devices, add a device, activate or renew it against points,
//                                         his customers' M3U subscriptions
// It uses the helpers of panel.js ($, esc, say, api, fmt, ago, stOf, ...), which is loaded after it: nothing here runs
// before the page has loaded.

// ---- what the Worker says, in words ------------------------------------------------------------------------
var ERR = {
  "unauthorized": function () { return ROLE == "dist" ? "اسم المستخدم أو كلمة المرور غير صحيحة" : "كلمة المرور غير صحيحة"; },
  "disabled": function () { return "حسابك معطّل، تواصل مع الإدارة"; },
  "points": function (e) { var d = e.data || {}; return "رصيدك لا يكفي: لديك " + pts(d.points) + " ونحتاج " + pts(d.need); },
  "not enough": function (e) { return "رصيد الموزع لا يكفي للخصم (عنده " + ((e.data || {}).points) + ")"; },
  "stopped": function () { return "الجهاز موقوف من الإدارة، تواصل معها"; },
  "not found": function () { return ROLE == "dist" ? "هذا الجهاز ليس في قائمتك" : "غير موجود"; },
  "changed": function () { return "تغيّرت الحالة، حدّث الصفحة وأعد المحاولة"; },
  "ref used": function () { return "تغيّرت الحالة، حدّث الصفحة وأعد المحاولة"; },
  "key": function () { return "المفتاح لا يطابق مفتاح الجهاز الظاهر على شاشة الزبون"; },
  "other": function () { return "هذا الجهاز مسجّل عند موزع آخر"; },
  "admin": function () { return "هذا الجهاز مسجّل عند الإدارة، تواصل معها"; },
  "bad mac": function () { return "الماك غير صحيح: 12 خانة من 0-9 و A-F"; },
  "bad plan": function () { return "مدة غير صحيحة"; },
  "bad name": function () { return "اكتب اسم الموزع"; },
  "bad phone": function () { return "رقم واتساب غير صحيح: اكتبه بالصيغة الدولية بدون + ولا صفر، مثل 905551234567"; },
  "bad code": function () { return "الرمز يجب أن يكون من 4 إلى 8 أرقام"; },
  "code taken": function () { return "هذا الرمز مستخدم عند موزع آخر"; },
  "bad password": function () { return "كلمة المرور يجب أن تكون من 4 إلى 64 حرفاً إنجليزياً أو رقماً أو رمزاً، بدون مسافات ولا حروف عربية"; },
  "bad username": function () { return "اسم المستخدم من 3 إلى 32 حرفاً إنجليزياً أو رقماً أو . _ -"; },
  "username taken": function () { return "اسم المستخدم هذا مستخدم عند موزع آخر"; },
  "need username": function () { return "اكتب اسم مستخدم للموزع مع كلمة المرور"; },
  "bad points": function () { return "عدد النقاط غير صحيح"; },
  "bad dist": function () { return "الموزع غير موجود"; }
};

// a number of points in words (3 to 10 take the plural)
function pts(n) {
  var a = Math.abs(Number(n) || 0);
  return a + " " + (a >= 3 && a <= 10 ? "نقاط" : "نقطة");
}
function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function randRef() {
  var a = "", i;
  try {
    var b = new Uint8Array(12);
    crypto.getRandomValues(b);
    for (i = 0; i < b.length; i++) a += (b[i] % 36).toString(36);
  } catch (e) {
    for (i = 0; i < 12; i++) a += Math.floor(Math.random() * 36).toString(36);
  }
  return "t" + a;
}
function copyText(t) {
  function old() {
    var x = document.createElement("textarea");
    x.value = t; x.style.position = "fixed"; x.style.opacity = "0";
    document.body.appendChild(x); x.select();
    try { document.execCommand("copy"); say("تم النسخ"); } catch (e) { say("تعذّر النسخ، انسخه بيدك"); }
    document.body.removeChild(x);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { say("تم النسخ"); }, old);
  else old();
}
function panelUrl() { return location.href.split("#")[0].split("?")[0]; }
function waUrl(phone, text) { return "https://wa.me/" + phone + (text ? "?text=" + encodeURIComponent(text) : ""); }

// the log of the points, one line each (the seller sees it for all, a distributor for himself)
function lgRows(list, withName) {
  if (!list.length) return '<div class="meta">لا توجد حركات بعد</div>';
  return list.map(function (l) {
    var what = l.kind == "add" ? "شحن رصيد" : (l.kind == "sub" ? "خصم" : "تفعيل " + (l.months == 12 ? "سنة" : l.months + " أشهر"));
    var sub = [];
    if (withName && l.name) sub.push(esc(l.name));
    if (l.mac) sub.push('<span class="mono">' + esc(l.mac) + '</span>');
    if (l.note) sub.push(esc(l.note));
    return '<div class="lgrow"><div><b>' + what + '</b><small>' + sub.join(" · ") + '</small><small>' + fmt(l.ts) + '</small></div>' +
      '<div class="lgn"><span class="' + (l.delta > 0 ? "plus" : "minus") + '">' + (l.delta > 0 ? "+" : "") + l.delta + '</span><small>الرصيد ' + l.balance + '</small></div></div>';
  }).join("");
}
function modal(html) {
  closeModal();
  var m = document.createElement("div");
  m.className = "modal"; m.id = "modal";
  m.innerHTML = '<div class="card">' + html + '</div>';
  m.addEventListener("click", function (e) { if (e.target === m) closeModal(); });
  document.body.appendChild(m);
}
function closeModal() { var m = $("modal"); if (m) m.parentNode.removeChild(m); }

// =====================================================================================================
// the seller's tab
// =====================================================================================================
var DSL = [], DSO = {}, DSP = {}, DSNEW = false, DSBUSY = false, DSOK = false;

function dsFind(id) {
  for (var i = 0; i < DSL.length; i++) if (DSL[i].id === id) return DSL[i];
  return null;
}
function distName(id) {
  var x = dsFind(id);
  return x ? x.name : "";
}
// the list from the server joins the list in the page; a distributor with typing that is not saved yet keeps it
function dsMerge(list) {
  var old = {}, i, out = [];
  for (i = 0; i < DSL.length; i++) old[DSL[i].id] = DSL[i];
  for (i = 0; i < list.length; i++) {
    var n = list[i], o = old[n.id];
    if (o && o._dirty) {
      o.points = n.points; o.devices = n.devices; o.live = n.live; o.last_login = n.last_login;
      out.push(o);
    } else out.push(n);
  }
  DSL = out;
}
function dsReload(quiet) {
  var b = $("dsref");
  if (b) b.disabled = true;
  return api("/api/admin/distributors").then(function (l) {
    dsMerge(l);
    DSOK = true;
    if (T == 3) dsDraw();
    if (b) b.disabled = false;
    if (!quiet) say("تم التحديث");
  }).catch(function (e) {
    if (b) b.disabled = false;
    if (!quiet) fail(e);
  });
}

function rDist() {
  $("view").innerHTML = '<div class="row" style="margin-bottom:10px"><button class="btn pri" style="flex:1" onclick="dsNewForm()">+ موزع جديد</button>' +
    '<button class="btn" onclick="dsLog(\'\')">سجل النقاط</button><button class="btn sm" id="dsref" onclick="dsReload()" title="تحديث">↻</button></div>' +
    '<div id="dsnew"></div><div id="dssum"></div><div id="dsl"></div>';
  dsDraw();
  dsReload(true);
}
function dsDraw() {
  if (!$("dsl")) return;
  var tot = 0, h = "";
  DSL.forEach(function (x) { tot += x.points; });
  $("dsnew").innerHTML = DSNEW ? dsNewHtml() : "";
  $("dssum").innerHTML = DSL.length ? '<div class="selrow"><span>' + DSL.length + ' موزع</span><span>مجموع النقاط عندهم: <b>' + money(tot) + '</b></span></div>' : "";
  DSL.forEach(function (x) { h += dsCard(x); });
  // the list could not be read (a Worker without the distributors, or one whose database has not been migrated yet)
  $("dsl").innerHTML = h || '<div class="card">' + (DSOK ? "لا يوجد موزعون بعد. اضغط «+ موزع جديد»." : "تعذّر تحميل الموزعين. اضغط ↻ للمحاولة، فإن استمر فالخادم لم يُحدَّث لهذه الميزة بعد.") + '</div>';
}
function dsCard(x) {
  var k = "'" + x.id + "'";
  var open = DSO[x.id], pf = DSP[x.id];
  return '<div class="card dst" id="ds-' + x.id + '"><div class="head">' +
    '<div class="logo">' + esc((x.name || "?").charAt(0)) + '</div>' +
    '<div class="names"><b>' + esc(x.name) + '</b><small>' + (x.username ? 'المستخدم <span class="mono">' + esc(x.username) + '</span> · ' : '') + 'واتساب <span class="mono">+' + esc(x.phone) + '</span></small></div>' +
    '<span class="pill' + (x.active ? "" : " off") + '">' + (x.active ? "فعّال" : "معطّل") + '</span></div>' +
    '<div class="meta"><b class="bal2">' + money(x.points) + '</b> ' + (x.points >= 3 && x.points <= 10 ? "نقاط" : "نقطة") + ' · أجهزته ' + x.devices + ' (فعّالة ' + x.live + ') · آخر دخول: ' + (x.last_login ? ago(x.last_login) : "لم يدخل بعد") + '</div>' +
    '<div class="acts"><button class="btn go" onclick="dsPts(' + k + ')">' + (pf ? "إخفاء ⌃" : "شحن / خصم نقاط") + '</button>' +
    '<button class="btn" onclick="dsLog(' + k + ')">السجل</button>' +
    '<button class="btn" onclick="dsOpen(' + k + ')">' + (open ? "إخفاء ⌃" : "تفاصيل ⌄") + '</button></div>' +
    (pf ? dsPtsForm(x) : "") + (open ? dsDetails(x) : "") + '</div>';
}

// ---- a new distributor ----
function dsNewHtml() {
  return '<div class="card"><label>اسم الموزع</label><input type="text" id="dsn" autocomplete="off">' +
    '<label>رقم واتساب الموزع (دولي بدون + ولا صفر، مثل 905551234567)</label><input class="mono" type="text" id="dsp" inputmode="numeric" autocomplete="off">' +
    '<label>اسم المستخدم للدخول (3 إلى 32 حرفاً إنجليزياً أو رقماً أو . _ -)</label><input class="mono" type="text" id="dsu" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<label>كلمة المرور (' + PWHINT + ')</label><input class="mono" type="text" id="dspw" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<div class="row" style="margin-top:10px"><button class="btn pri" onclick="dsCreate()">إنشاء</button><button class="btn" onclick="dsNewForm()">إلغاء</button></div></div>';
}
function dsNewForm() {
  DSNEW = !DSNEW;
  dsDraw();
  if (DSNEW && $("dsn")) $("dsn").focus();
}
function dsCreate() {
  var name = $("dsn").value.trim(), phone = $("dsp").value.trim(), code = "";
  var pw = dsPass($("dspw").value), un = dsUser($("dsu").value);
  if (!name) { say("اكتب اسم الموزع"); return; }
  if (un === null) { say(ERR["bad username"]()); return; }
  if (pw === null) { say(ERR["bad password"]()); return; }
  if (!un || !pw) { say("اكتب اسم المستخدم وكلمة المرور للموزع"); return; }
  if (!phone) { say("اكتب رقم واتساب الموزع"); return; }
  if (DSBUSY) return;
  DSBUSY = true;
  api("/api/admin/distributors", "PUT", { name: name, phone: phone, code: code, active: true, username: un, password: pw }).then(function (r) {
    DSBUSY = false; DSNEW = false;
    // the key exists nowhere but in this answer: it is shown first, before anything else (the list) can fail
    dsCred({ name: name, phone: phoneOf(phone), username: r.username }, r.secret, r.code, true);
    dsReload(true);
  }).catch(function (e) { DSBUSY = false; fail(e); });
}
// a password the seller chose: Arabic digits are read as digits; 4 to 64 Latin letters, digits or symbols, no spaces
// (the Worker checks the same). "" when nothing was typed, null when what was typed cannot be used.
function dsPass(v) {
  var t = String(v || "").replace(/[٠-٩۰-۹]/g, function (c) {
    var n = c.charCodeAt(0);
    return String(n >= 0x06f0 ? n - 0x06f0 : n - 0x0660);
  }).trim();
  if (!t) return "";
  return /^[\x21-\x7e]{4,64}$/.test(t) ? t : null;
}
// the user name of a distributor: "" when empty, null when it cannot be used
function dsUser(v) {
  var t = String(v || "").replace(/[٠-٩۰-۹]/g, function (c) {
    var n = c.charCodeAt(0);
    return String(n >= 0x06f0 ? n - 0x06f0 : n - 0x0660);
  }).trim().toLowerCase();
  if (!t) return "";
  return /^[a-z0-9._-]{3,32}$/.test(t) ? t : null;
}
var PWHINT = "4 إلى 64 حرفاً إنجليزياً أو رقماً أو رمزاً، بدون مسافات. الأحرف الكبيرة والصغيرة مختلفة";

// a number the way wa.me wants it, for the link that is made in the page (the Worker keeps its own clean copy)
function phoneOf(p) {
  var t = String(p || "").replace(/[٠-٩۰-۹]/g, function (c) {
    var n = c.charCodeAt(0);
    return String(n >= 0x06f0 ? n - 0x06f0 : n - 0x0660);
  }).replace(/\D/g, "");
  return t.indexOf("00") === 0 ? t.slice(2) : t;
}

// the secret of a distributor is shown once: here, to copy or to send to him on WhatsApp
function dsCred(x, secret, code, isNew) {
  var name = x ? x.name : "", phone = x ? x.phone : "";
  var msg = "مرحباً " + name + "،\nهذه بيانات دخولك إلى لوحة حلب سات:\nالرابط: " + panelUrl() + (x && x.username ? "\nاسم المستخدم: " + x.username : "") + "\nكلمة المرور: " + secret +
    "\nاحتفظ بكلمة المرور ولا تشاركها مع أحد.";
  window.DSMSG = msg;
  modal('<h3 style="margin:0 0 6px">' + (isNew ? "تم إنشاء الموزع" : "بيانات دخول جديدة") + ': ' + esc(name) + '</h3>' +
    '<div class="meta">كلمة المرور تظهر هذه المرة فقط. انسخها أو أرسلها للموزع الآن.</div>' +
    (x && x.username ? '<div class="meta">اسم المستخدم: <b class="mono">' + esc(x.username) + '</b></div>' : '') +
    '<div class="secret" id="dssecret">' + esc(secret) + '</div>' +
    '<div class="row" style="margin-top:12px"><button class="btn pri" onclick="copyText(window.DSMSG)">نسخ الرسالة</button>' +
    '<a class="btn go" id="dswa" target="_blank" rel="noopener" href="' + esc(waUrl(phone, msg)) + '" style="text-decoration:none">إرسال عبر واتساب</a>' +
    '<button class="btn" onclick="closeModal()">تم</button></div>');
}

// ---- points ----
function dsPts(id) {
  if (DSP[id]) delete DSP[id]; else DSP[id] = { amount: "", note: "" };
  dsDraw();
}
function dsPtsForm(x) {
  var f = DSP[x.id], k = "'" + x.id + "'";
  var q = [5, 10, 20, 50, 100].map(function (n) { return '<button class="btn" onclick="dsQuick(' + k + ',' + n + ')">+' + n + '</button>'; }).join("");
  return '<div class="pick"><span>شحن رصيد الموزع (اكتب رقماً بالسالب للخصم)</span>' + q +
    '<input type="number" id="dsa-' + x.id + '" placeholder="عدد النقاط" value="' + esc(f.amount) + '" oninput="DSP[\'' + x.id + '\'].amount=this.value" style="flex-basis:100%">' +
    '<input type="text" id="dsb-' + x.id + '" placeholder="ملاحظة (مثال: دفعة 40$)" value="' + esc(f.note) + '" oninput="DSP[\'' + x.id + '\'].note=this.value" style="flex-basis:100%">' +
    '<button class="btn pri" style="flex-basis:100%" onclick="dsApply(' + k + ')"' + (DSBUSY ? " disabled" : "") + '>تنفيذ</button></div>';
}
function dsQuick(id, n) {
  if (!DSP[id]) return;
  DSP[id].amount = String(n);
  var e = $("dsa-" + id);
  if (e) e.value = String(n);
}
function dsApply(id) {
  var x = dsFind(id), f = DSP[id];
  if (!x || !f || DSBUSY) return;
  var n = Number(String(f.amount).trim());
  if (!n || n != Math.floor(n) || String(f.amount).trim() === "") { say("اكتب عدد نقاط صحيحاً (رقم لا يساوي صفراً)"); return; }
  var sure = n > 0 ? "إضافة " + pts(n) : "خصم " + pts(-n);
  if (!confirm(sure + " للموزع " + x.name + " ؟\nرصيده الآن " + pts(x.points) + " وبعدها " + (x.points + n) + ".")) return;
  DSBUSY = true;
  api("/api/admin/points", "PUT", { id: id, delta: n, note: (f.note || "").trim() }).then(function (r) {
    DSBUSY = false;
    x.points = r.points;
    delete DSP[id];
    dsDraw();
    say((n > 0 ? "تمت إضافة " + pts(n) : "تم خصم " + pts(-n)) + " · الرصيد الآن " + r.points);
  }).catch(function (e) { DSBUSY = false; dsDraw(); fail(e); });
}
function dsLog(id) {
  api("/api/admin/points" + (id ? "?id=" + encodeURIComponent(id) : "")).then(function (l) {
    var x = id ? dsFind(id) : null;
    modal('<h3 style="margin:0 0 6px">سجل النقاط' + (x ? ": " + esc(x.name) : "") + '</h3>' + lgRows(l, !id) +
      '<div class="row" style="margin-top:12px"><button class="btn" onclick="closeModal()">إغلاق</button></div>');
  }).catch(fail);
}

// ---- the details of a distributor ----
function dsOpen(id) {
  DSO[id] = !DSO[id];
  dsDraw();
}
function dsEd(id, k, v) {
  var x = dsFind(id);
  if (!x) return;
  x[k] = v; x._dirty = true;
}
function dsDetails(x) {
  var k = "'" + x.id + "'";
  return '<div class="det"><label>الاسم</label><input type="text" value="' + esc(x.name) + '" oninput="dsEd(' + k + ',\'name\',this.value)">' +
    '<label>رقم واتساب (دولي بدون + ولا صفر)</label><input class="mono" type="text" inputmode="numeric" value="' + esc(x.phone) + '" oninput="dsEd(' + k + ',\'phone\',this.value)">' +
    '<label>ملاحظة</label><input type="text" value="' + esc(x.note) + '" oninput="dsEd(' + k + ',\'note\',this.value)">' +
    '<div class="foot"><label class="sw"><input type="checkbox" ' + (x.active ? "checked" : "") + ' onchange="dsEd(' + k + ',\'active\',this.checked)"> مفعّل</label>' +
    '<span class="row"><button class="btn" onclick="dsTest(' + k + ')">اختبار الرقم</button><button class="btn x" onclick="dsDel(' + k + ')">حذف</button></span></div>' +
    '<div class="row" style="margin-top:8px"><button class="btn" onclick="dsReset(' + k + ')">مفتاح عشوائي جديد</button><button class="btn pri" onclick="dsSave(' + k + ')">حفظ</button></div>' +
    '<label>اسم المستخدم للدخول</label><input class="mono" type="text" id="dsu-' + x.id + '" value="' + esc(x.username) + '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<label>كلمة مرور جديدة (' + PWHINT + ')</label><input class="mono" type="text" id="dspw-' + x.id + '" autocomplete="off" autocapitalize="off" spellcheck="false">' +
    '<div class="row" style="margin-top:8px"><button class="btn go" onclick="dsSetPw(' + k + ')">حفظ اسم المستخدم وكلمة المرور</button></div></div>';
}
function dsBody(x, extra) {
  var o = { id: x.id, name: (x.name || "").trim(), phone: String(x.phone || "").trim(), code: String(x.code || "").trim(), active: x.active !== false, note: (x.note || "").trim(), username: x.username || "" };
  for (var k in extra) o[k] = extra[k];
  return o;
}
function dsSave(id) {
  var x = dsFind(id);
  if (!x || DSBUSY) return;
  DSBUSY = true;
  api("/api/admin/distributors", "PUT", dsBody(x, {})).then(function () {
    DSBUSY = false; x._dirty = false; DSO[id] = false;
    return dsReload(true).then(function () { say("تم حفظ الموزع"); });
  }).catch(function (e) { DSBUSY = false; fail(e); });
}
function dsReset(id) {
  var x = dsFind(id);
  if (!x || DSBUSY) return;
  if (!confirm("إنشاء مفتاح دخول جديد للموزع " + x.name + " ؟\nالمفتاح القديم يتوقف فوراً.")) return;
  DSBUSY = true;
  api("/api/admin/distributors", "PUT", dsBody(x, { resetSecret: true })).then(function (r) {
    DSBUSY = false; x._dirty = false;
    dsCred(x, r.secret, r.code, false);
    dsReload(true);
  }).catch(function (e) { DSBUSY = false; fail(e); });
}
function dsSetPw(id) {
  var x = dsFind(id), e = $("dspw-" + id), eu = $("dsu-" + id);
  if (!x || !e || !eu || DSBUSY) return;
  var pw = dsPass(e.value), un = dsUser(eu.value);
  if (!un) { say(un === null ? ERR["bad username"]() : "اكتب اسم المستخدم"); return; }
  if (!pw) { say(pw === null ? ERR["bad password"]() : "اكتب كلمة المرور الجديدة"); return; }
  if (!confirm("حفظ اسم المستخدم «" + un + "» وكلمة مرور جديدة للموزع " + x.name + " ؟\nدخوله القديم يتوقف فوراً.")) return;
  DSBUSY = true;
  api("/api/admin/distributors", "PUT", dsBody(x, { username: un, password: pw })).then(function (r) {
    DSBUSY = false; x._dirty = false;
    x.username = r.username || un;
    dsCred(x, r.secret, r.code, false);
    dsReload(true);
  }).catch(function (e) { DSBUSY = false; fail(e); });
}
function dsDel(id) {
  var x = dsFind(id);
  if (!x || DSBUSY) return;
  if (!confirm("حذف الموزع " + x.name + " نهائياً؟\nأجهزته (" + x.devices + ") تعود إليك كما هي، ورصيده (" + pts(x.points) + ") يُلغى، ويتوقف مفتاح دخوله.\nلا يمكن التراجع.")) return;
  DSBUSY = true;
  api("/api/admin/distributors?id=" + encodeURIComponent(id), "DELETE").then(function () {
    DSBUSY = false;
    delete DSO[id]; delete DSP[id];
    return Promise.all([dsReload(true), reloadD(true)]).then(function () { say("تم حذف الموزع"); });
  }).catch(function (e) { DSBUSY = false; fail(e); });
}
function dsTest(id) {
  var x = dsFind(id);
  if (x) window.open(waUrl(String(x.phone || "").replace(/\D/g, "")), "_blank");
}

// ---- a subscription of a device: an M3U link, or a server of the seller with a user name and a password ----
// (shared by the seller's devices and the distributor's devices). A row of a server has "server" (its id, "" until one
// is chosen), "user" and "pass"; the Worker makes the link from the server's host, so a distributor never sees it.
function plServers() {
  if (ROLE == "dist") return DVSRV;
  return (S || []).filter(function (s) { return s.visible !== false; });
}
// who locked a subscription against the one looking at it ("" when he may change it): the Worker keeps the same rule
function plLock(p, d) {
  if (!p || !p.by) return "";
  // the seller may change or remove any subscription; a distributor not the seller's
  return ROLE == "dist" && p.by === "admin" ? "الإدارة" : "";
}
function plSrvName(id) {
  var l = plServers();
  for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i].nameAr || l[i].nameEn || "";
  return "";
}
function plRow(p, k, j, edFn, delFn, lock) {
  if (lock) {
    var what = p.server != null ? (plSrvName(p.server) || "سيرفر") + (p.user ? ' · <span class="mono">' + esc(p.user) + '</span>' : "") : '<span class="mono">M3U</span>';
    return '<div class="pl lk"><div class="row" style="flex-wrap:nowrap"><span class="lkic">🔒</span><div style="flex:1;min-width:0"><b>' + esc(p.name || plSrvName(p.server) || "اشتراك") + '</b>' +
      '<small>' + what + ' · أضافه ' + esc(lock) + '، ولا يحذفه أو يعدّله غيره</small></div></div></div>';
  }
  var x = '<button class="btn sm x" onclick="' + delFn + '(' + k + ',' + j + ')">✕</button>';
  var srv = p.server != null;
  var nm = '<input type="text" placeholder="اسم الاشتراك (يظهر للزبون' + (srv ? '، فارغ = اسم السيرفر' : '') + ')" value="' + esc(p.name) + '" oninput="' + edFn + '(' + k + ',' + j + ',\'name\',this.value)">';
  if (!srv) {
    return '<div class="pl">' + nm +
      '<div class="row" style="margin-top:6px;flex-wrap:nowrap"><input class="mono" type="text" placeholder="http://...get.php?username=...&password=..." value="' + esc(p.url) + '" oninput="' + edFn + '(' + k + ',' + j + ',\'url\',this.value)" style="flex:1;min-width:0">' + x + '</div></div>';
  }
  var ops = '<option value="">— اختر السيرفر —</option>', found = false;
  plServers().forEach(function (s) {
    var on = String(s.id) === String(p.server);
    if (on) found = true;
    ops += '<option value="' + esc(s.id) + '"' + (on ? " selected" : "") + '>' + esc(s.nameAr || s.nameEn || s.id) + (s.nameEn && s.nameAr ? " · " + esc(s.nameEn) : "") + '</option>';
  });
  if (p.server && !found) ops += '<option value="' + esc(p.server) + '" selected>سيرفر محذوف أو مخفي</option>';
  return '<div class="pl"><div class="row" style="flex-wrap:nowrap"><select onchange="' + edFn + '(' + k + ',' + j + ',\'server\',this.value)" style="flex:1;min-width:0">' + ops + '</select>' + x + '</div>' +
    '<div class="row" style="margin-top:6px;flex-wrap:nowrap"><input class="mono" type="text" placeholder="اسم المستخدم" value="' + esc(p.user) + '" autocapitalize="off" spellcheck="false" oninput="' + edFn + '(' + k + ',' + j + ',\'user\',this.value)" style="flex:1;min-width:0">' +
    '<input class="mono" type="text" placeholder="كلمة المرور" value="' + esc(p.pass) + '" autocapitalize="off" spellcheck="false" oninput="' + edFn + '(' + k + ',' + j + ',\'pass\',this.value)" style="flex:1;min-width:0"></div>' +
    '<div style="margin-top:6px">' + nm + '</div></div>';
}
// what is sent: a link row needs its link, a server row its server, user name and password. A row that is half
// filled is an error (null is returned and the reason is said), an empty one is dropped.
function plClean(list, d) {
  var out = [], bad = "";
  list.forEach(function (p) {
    // a locked one goes back as it is (the Worker keeps its own copy of it anyway)
    if (plLock(p, d)) { out.push(p); return; }
    var name = (p.name || "").trim();
    if (p.server != null) {
      var u = (p.user || "").trim(), w = (p.pass || "").trim();
      if (!p.server && !u && !w) return;
      if (!p.server) { bad = bad || "اختر السيرفر لكل اشتراك"; return; }
      if (!u || !w) { bad = bad || "اكتب اسم المستخدم وكلمة المرور لكل اشتراك"; return; }
      if (/\s/.test(u + w)) { bad = bad || "اسم المستخدم وكلمة المرور بدون مسافات"; return; }
      out.push({ id: p.id || newId(), name: name, server: String(p.server), user: u, pass: w });
      return;
    }
    var l = (p.url || "").trim();
    if (!l) return;
    if (l.indexOf("://") < 0) l = "http://" + l;
    out.push({ id: p.id || newId(), name: name, url: l });
  });
  if (bad) { say(bad); return null; }
  return out;
}
var PLBTN = "+ اشتراك من سيرفر";

// =====================================================================================================
// the page of a distributor
// =====================================================================================================
var DVSRV = [], DVM = null, DVL = [], DVLOG = [], DVPLANS = [], DVF = "all", DVQ = "", DVSHOW = 50, DVLOAD = 0, DVADD = false, DVLG = false, DVBUSY = false;

function dvFind(m) {
  for (var i = 0; i < DVL.length; i++) if (DVL[i].mac === m) return DVL[i];
  return null;
}
function dvLogin() {
  var k = $("pw").value.replace(/[٠-٩۰-۹]/g, function (c) {
    var n = c.charCodeAt(0);
    return String(n >= 0x06f0 ? n - 0x06f0 : n - 0x0660);
  }).trim();
  var u = dsUser($("pu").value);
  if (!u || !k) { $("lmsg").textContent = "اكتب اسم المستخدم وكلمة المرور"; return; }
  if (!/^[\x20-\x7e]+$/.test(k) || u === null) { $("lmsg").textContent = "اسم المستخدم أو كلمة المرور غير صحيحة"; return; }
  ROLE = "dist";
  DK = k; DU = u;
  localStorage.setItem("dk", DK);
  if (DU) localStorage.setItem("du", DU); else localStorage.removeItem("du");
  lgBusy(true);
  localStorage.setItem("role", "dist");
  distLoad();
}
// the state from the server: the devices join the ones in the page (what is typed and not saved stays)
function dvMerge(list) {
  var old = {}, i, out = [];
  for (i = 0; i < DVL.length; i++) old[DVL[i].mac] = DVL[i];
  for (i = 0; i < list.length; i++) {
    var n = list[i], o = old[n.mac];
    if (o && (o._dirty || o._busy)) { o.last_seen = n.last_seen; out.push(o); continue; }
    if (o) { n._open = o._open; n._pick = o._pick; n._ref = o._ref; }
    out.push(prep(n));
  }
  DVL = out;
  DVLOAD = Date.now();
}
// the state of the distributor from the Worker (his points, his devices, his log); true when it was read
function distLoad(quiet) {
  return api("/api/dist/state").then(function (r) {
    DVM = r.me; DVPLANS = r.plans; DVLOG = r.log; DVSRV = r.servers || [];
    dvMerge(r.devices);
    $("login").style.display = "none";
    $("main").style.display = "block";
    $("tabs").style.display = "none";
    dvDraw();
    return true;
  }).catch(function (e) {
    if (quiet) { fail(e); return false; }
    // only a key that the Worker does not know is forgotten (a disabled account may be enabled again)
    if (e && e.status === 401) { localStorage.removeItem("dk"); localStorage.removeItem("du"); }
    $("login").style.display = "block";
    $("main").style.display = "none";
    $("lmsg").textContent = e && e.status === 401 ? "اسم المستخدم أو كلمة المرور غير صحيحة" : (e && e.code === "disabled" ? "حسابك معطّل، تواصل مع الإدارة" : "تعذّر الاتصال بالخادم");
    lgBusy(false);
    return false;
  });
}
function dvReload(quiet) {
  var b = $("dvref");
  if (b) b.disabled = true;
  return distLoad(true).then(function (ok) {
    var b2 = $("dvref");
    if (b2) b2.disabled = false;
    if (!quiet && ok) say("تم التحديث");
  });
}
// coming back to the page after a while (from WhatsApp, say): it brings itself up to date
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && ROLE == "dist" && DK && DVLOAD && Date.now() - DVLOAD > 60000 && !DVBUSY) distLoad(true);
});

function dvPlanLabel(p) { return p.months == 12 ? "سنة" : p.months + " أشهر"; }
function dvPrices() {
  return DVPLANS.map(function (p) { return dvPlanLabel(p) + " = " + pts(p.points); }).join(" · ");
}

// The page is built once (so that what the distributor has typed in the search box or in the form of a new device
// is never wiped by a refresh); a refresh only redraws what comes from the Worker: the header, the list and the log.
function dvDraw() {
  if (!$("dvlist")) {
    $("view").innerHTML = '<div class="card hdr" id="dvhead"></div>' +
      '<div class="row" style="margin-bottom:8px"><button class="btn" id="dvaddb" onclick="dvToggleAdd()">+ إضافة جهاز</button>' +
      '<input type="text" id="dvq" placeholder="ابحث بالماك أو الاسم..." value="' + esc(DVQ) + '" oninput="DVQ=this.value;DVSHOW=50;dvList()" style="flex:1;min-width:120px">' +
      '<button class="btn sm" id="dvref" onclick="dvReload()" title="تحديث">↻</button></div>' +
      '<div id="dvadd">' + (DVADD ? dvAddForm() : "") + '</div>' +
      '<div class="chips" id="dvchips"></div><div id="dvlist"></div><div id="dvmore"></div>' +
      '<div class="card" id="dvlog"></div>';
  }
  dvHead();
  dvList();
  dvLogBox();
}
function dvHead() {
  var me = DVM;
  $("dvhead").innerHTML = '<div class="row" style="justify-content:space-between"><b style="font-size:17px">' + esc(me.name) + '</b>' +
    '<button class="btn sm" onclick="logout()">خروج</button></div>' +
    '<div class="bal"><span>رصيدك</span><b id="dvbal">' + money(me.points) + '</b><span>' + (me.points >= 3 && me.points <= 10 ? "نقاط" : "نقطة") + '</span></div>' +
    '<div class="meta">' + dvPrices() + '</div>' +
    '<div class="meta">رقم واتساب الظاهر في الـQR لزبائنك: <span class="mono">+' + esc(me.phone) + '</span></div>';
}
function dvLogBox() {
  $("dvlog").innerHTML = '<div class="row" style="justify-content:space-between"><b>سجل نقاطك</b><button class="btn sm" onclick="DVLG=!DVLG;dvLogBox()">' + (DVLG ? "إخفاء ⌃" : "عرض ⌄") + '</button></div>' +
    (DVLG ? lgRows(DVLOG, false) : "");
}
function dvCounts() {
  var c = { all: 0, active: 0, expired: 0, stopped: 0, waiting: 0, "new": 0 };
  DVL.forEach(function (d) { c.all++; c[d._st]++; if (isNew(d)) c["new"]++; });
  return c;
}
function dvView() {
  var q = DVQ.trim().toLowerCase(), qn = q.replace(/[:\s-]/g, ""), out = [];
  DVL.forEach(function (d) {
    if (!(DVF == "all" || (DVF == "new" ? isNew(d) : d._st == DVF))) return;
    if (q) {
      var names = d.playlists.map(function (p) { return p.name; }).join(" ");
      var hay = (d.mac + " " + d.mac.replace(/:/g, "") + " " + d.note + " " + names).toLowerCase();
      if (hay.indexOf(q) < 0 && (!qn || hay.indexOf(qn) < 0)) return;
    }
    out.push(d);
  });
  return out.sort(function (a, b) { return t0(b.created) - t0(a.created); });
}
function dvList() {
  if (!$("dvlist")) return;
  var cn = dvCounts(), v = dvView(), n = Math.min(v.length, DVSHOW), h = "", i;
  $("dvchips").innerHTML = CHIPS.map(function (c) {
    return '<button class="chip' + (DVF == c[0] ? " on" : "") + '" onclick="DVF=\'' + c[0] + '\';DVSHOW=50;dvList()">' + c[1] + ' <b>' + cn[c[0]] + '</b></button>';
  }).join("");
  for (i = 0; i < n; i++) h += dvCard(v[i]);
  $("dvlist").innerHTML = h || '<div class="card">' + (DVL.length ? "لا توجد نتائج" : "لا توجد أجهزة بعد. اضغط «+ إضافة جهاز»، أو اطلب من زبائنك كتابة رمزك في التطبيق فتظهر أجهزتهم هنا.") + '</div>';
  $("dvmore").innerHTML = v.length > n ? '<button class="btn" style="width:100%;margin-bottom:12px" onclick="DVSHOW+=50;dvList()">عرض المزيد (' + (v.length - n) + ')</button>' : "";
}

function dvCard(d) {
  var m = d.mac, k = "'" + m + "'", s = d._st, b = d._busy ? " disabled" : "", acts;
  if (s == "stopped") acts = '<span class="meta" style="margin:0">موقوف من الإدارة: لا يمكن تفعيله، تواصل معها</span>';
  else acts = '<button class="btn go" onclick="dvPick(' + k + ')"' + b + '>' + (s == "active" ? "تمديد" : "تفعيل") + '</button>';
  acts += '<button class="btn" onclick="dvOpen(' + k + ')">' + (d._open ? "إخفاء ⌃" : "تفاصيل ⌄") + '</button>';
  return '<div class="card dev" id="dv-' + kid(m) + '"><div class="head">' +
    '<div class="names"><div class="mac">' + esc(m) + '</div><small>' + (d.note ? esc(d.note) : "بدون ملاحظة") + '</small></div>' + pillOf(d) + '</div>' +
    '<div class="meta">' + metaOf(d) + '</div><div class="acts">' + acts + '</div>' +
    (d._pick && s != "stopped" ? dvPickBox(d) : "") + (d._open ? dvDetails(d) : "") + '</div>';
}
function dvPickBox(d) {
  var k = "'" + d.mac + "'", poor = DVM.points;
  var h = '<div class="pick"><span>' + (d._st == "active" ? "تمديد بـ (يُضاف إلى المدة المتبقية)" : "تفعيل لمدة") + ' · رصيدك ' + pts(poor) + '</span>';
  DVPLANS.forEach(function (p) {
    var no = p.points > poor || d._busy;
    h += '<button class="btn" onclick="dvActivate(' + k + ',' + p.months + ')"' + (no ? " disabled" : "") + '>' + dvPlanLabel(p) + '<small>' + pts(p.points) + '</small></button>';
  });
  return h + '</div>';
}
function dvPick(m) {
  var d = dvFind(m);
  if (!d) return;
  d._pick = !d._pick;
  // one reference for the whole tap, so that a double tap or a retry is paid once
  if (d._pick) d._ref = randRef();
  dvList();
}
function dvOpen(m) {
  var d = dvFind(m);
  if (!d) return;
  d._open = !d._open;
  dvList();
}
function dvActivate(m, months) {
  var d = dvFind(m), p = null;
  if (!d || d._busy || DVBUSY) return;
  DVPLANS.forEach(function (x) { if (x.months == months) p = x; });
  if (!p) return;
  if (!confirm((d._st == "active" ? "تمديد" : "تفعيل") + " الجهاز " + m + (d.note ? " (" + d.note + ")" : "") + " لمدة " + dvPlanLabel(p) + " مقابل " + pts(p.points) + "؟\nرصيدك بعد العملية: " + pts(DVM.points - p.points) + ".")) return;
  if (!d._ref) d._ref = randRef();
  d._busy = true; DVBUSY = true;
  dvList();
  api("/api/dist/activate", "PUT", { mac: m, months: months, ref: d._ref }).then(function (r) {
    d._busy = false; DVBUSY = false; d._pick = false; d._ref = "";
    d.expiry = r.expiry; d.active = true; d._st = stOf(d);
    DVM.points = r.points;
    var e = $("dvbal");
    if (e) e.textContent = money(r.points);
    dvList();
    say((r.replay ? "كان مدفوعاً من قبل: " : "تم التفعيل: ") + "حتى " + String(r.expiry).slice(0, 10) + " · رصيدك " + r.points);
    distLoad(true);   // the log and the balance, as the server has them
  }).catch(function (e) {
    d._busy = false; DVBUSY = false;
    // the reference of this tap was paid already for another length (an answer that was lost): a new tap, a new reference
    if (e && e.code === "ref used") { d._ref = ""; d._pick = false; }
    dvList(); fail(e);
    if (e && (e.code === "changed" || e.code === "stopped" || e.code === "ref used")) distLoad(true);
  });
}

// ---- the details of a device: its name and its M3U subscriptions ----
function dvDetails(d) {
  var k = "'" + d.mac + "'";
  return '<div class="det"><label>سُجّل: ' + fmt(d.created) + '</label>' +
    '<label>ملاحظة (اسم الزبون)</label><input type="text" value="' + esc(d.note) + '" oninput="dvEd(' + k + ',\'note\',this.value)">' +
    '<label>اشتراكات M3U للزبون (تظهر له أول القائمة ويدخلها بضغطة واحدة)</label>' +
    '<div id="dvpl-' + kid(d.mac) + '">' + dvPlBlock(d) + '</div>' +
    '<div class="row" style="margin-top:8px"><button class="btn go" onclick="dvAddPL(' + k + ',1)">' + PLBTN + '</button><button class="btn" onclick="dvAddPL(' + k + ')">+ رابط M3U</button></div>' +
    '<div class="foot"><span class="meta" style="margin:0">لا تستهلك النقاط</span><button class="btn pri" onclick="dvSave(' + k + ')"' + (d._busy ? " disabled" : "") + '>حفظ</button></div></div>';
}
function dvPlBlock(d) {
  var k = "'" + d.mac + "'", h = "";
  d.playlists.forEach(function (p, j) { h += plRow(p, k, j, "dvEdPL", "dvDelPL", plLock(p, d)); });
  return h;
}
function dvEd(m, k, v) {
  var d = dvFind(m);
  if (!d) return;
  d[k] = v; d._dirty = true;
}
function dvEdPL(m, j, k, v) {
  var d = dvFind(m);
  if (!d || !d.playlists[j]) return;
  d.playlists[j][k] = v; d._dirty = true;
}
function dvAddPL(m, srv) {
  var d = dvFind(m);
  if (!d) return;
  d.playlists.push(srv ? { id: newId(), name: "", server: "", user: "", pass: "", by: DVM && DVM.id } : { id: newId(), name: "", url: "", by: DVM && DVM.id });
  d._dirty = true;
  $("dvpl-" + kid(m)).innerHTML = dvPlBlock(d);
}
function dvDelPL(m, j) {
  var d = dvFind(m);
  if (!d || !confirm("حذف هذا الاشتراك من الجهاز؟")) return;
  d.playlists.splice(j, 1);
  d._dirty = true;
  $("dvpl-" + kid(m)).innerHTML = dvPlBlock(d);
}
function dvSave(m) {
  var d = dvFind(m);
  if (!d || d._busy) return;
  var pl = plClean(d.playlists, d);
  if (!pl) return;
  d.playlists = pl;
  d._busy = true;
  api("/api/dist/device", "PUT", { mac: m, note: (d.note || "").trim(), playlists: pl }).then(function () {
    d._busy = false; d._dirty = false; d._open = false;
    dvList(); say("تم حفظ الجهاز");
  }).catch(function (e) { d._busy = false; dvList(); fail(e); });
}

// ---- add a device ----
function dvAddForm() {
  return '<div class="card"><label>الماك (من شاشة الزبون، بالنقطتين أو بدونهما)</label>' +
    '<input class="mono" type="text" id="dvm" placeholder="AA:BB:CC:DD:EE:FF" autocapitalize="characters" autocomplete="off">' +
    '<label>المفتاح Device Key (6 أرقام من شاشة الزبون)</label>' +
    '<input class="mono" type="text" id="dvk" inputmode="numeric" maxlength="12" autocomplete="off">' +
    '<small class="hint">المفتاح مطلوب إن كان الزبون قد فتح التطبيق من قبل. لجهاز جديد لم يفتح التطبيق بعد يمكن تركه فارغاً.</small>' +
    '<label>اسم الزبون (اختياري)</label><input type="text" id="dvn">' +
    '<div class="row" style="margin-top:10px"><button class="btn pri" onclick="dvAdd()">إضافة</button><button class="btn" onclick="dvToggleAdd()">إلغاء</button></div>' +
    '<small class="hint">بدل ذلك يمكن للزبون كتابة رمزك في التطبيق (الإعدادات ← رمز الموزع) فيظهر جهازه هنا تلقائياً.</small></div>';
}
function dvToggleAdd() {
  DVADD = !DVADD;
  $("dvadd").innerHTML = DVADD ? dvAddForm() : "";
  if (DVADD) $("dvm").focus();
}
function dvAdd() {
  var m = normMac($("dvm").value);
  if (!m) { say("الماك غير صحيح: 12 خانة من 0-9 و A-F"); return; }
  var key = $("dvk").value.trim();
  if (DVBUSY) return;
  DVBUSY = true;
  api("/api/dist/devices", "PUT", { mac: m, key: key, note: $("dvn").value.trim().slice(0, 500) }).then(function (r) {
    DVBUSY = false; DVADD = false;
    DVQ = m; DVF = "all"; DVSHOW = 50;
    // the page is not rebuilt by a refresh: the form is closed and the search shows the new device
    $("dvadd").innerHTML = "";
    $("dvq").value = m;
    return distLoad(true).then(function () {
      say(r.created ? "تمت إضافة الجهاز وهو بانتظار التفعيل" : (r.mine ? "هذا الجهاز موجود في قائمتك" : "تمت إضافة جهاز الزبون إلى قائمتك"));
    });
  }).catch(function (e) { DVBUSY = false; fail(e); });
}
