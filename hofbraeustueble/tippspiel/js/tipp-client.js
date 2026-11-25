/*
 * Hofbräustüble – Tippspiel-Client  (window.TippAPI)
 * Vertrag: tippspiel/SPEC.md
 *
 *   await TippAPI.init({ base: '../cms/tipp-api.php', adminCsrf: '…' })
 *   TippAPI.mode                       // 'live' | 'demo'
 *   await TippAPI.call(action, data)   // wirft Error(message) mit .status und .data bei ok:false
 *   TippAPI.demoReset()                // Demo-Daten neu erzeugen
 *   TippAPI.scoreTip(tip, result, settings)  // → {points, kind} | null
 *   TippAPI.admin                      // true = Verwaltung angemeldet → Wirt-Ansicht (nur lesen) möglich
 *   TippAPI.demoSetOwner(true|false)   // Demo: Wirt „anmelden“ (sessionStorage; auch per URL ?wirt=1)
 *
 * Live-Modus: fetch auf cms/tipp-api.php (Cookies, X-CSRF-Token).
 * Demo-Modus: vollständige Nachbildung im Browser (localStorage "hbs_tipp_demo_v3") mit denselben Regeln.
 * Automatischer Abruf (OpenLigaDB) wird im Demo-Modus nur simuliert – keine Netzwerkanfragen.
 * Keine Abhängigkeiten, läuft per einfachem <script>-Tag.
 */
(function (global) {
  'use strict';

  var DEMO_KEY = 'hbs_tipp_demo_v3'; // v3: Bundesliga-Wettbewerb mit automatischem Abruf (OpenLigaDB)
  var DEMO_VERSION = 1;
  var DEMO_MAX_AGE_MS = 3 * 24 * 3600 * 1000; // ältere Demo-Daten werden neu erzeugt (damit „kommende Spiele“ kommend bleiben)
  var DEFAULT_SETTINGS = { points_exact: 4, points_diff: 3, points_tendency: 2, show_logos: true };
  var MAX_GOALS = 20;
  var INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var PW_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
  var NICK_RE = /^[A-Za-z0-9ÄÖÜäöüß _.\-]+$/;
  var NICK_HAS_ALNUM = /[A-Za-z0-9ÄÖÜäöüß]/;
  var GET_ACTIONS = { status: 1, invite_check: 1, matches: 1, leaderboard: 1, stats: 1, player_tips: 1, admin_overview: 1,
    admin_source_preview: 1, admin_cron_info: 1, cron_sync: 1, admin_stats: 1, admin_match_tips: 1, kasse: 1, admin_kasse: 1 };
  // Globale Schalter (content.json → features): fehlt einer, gilt tippspiel = an, preise/kasse = aus
  var DEFAULT_FEATURES = { tippspiel: true, preise: false, kasse: false };
  var OFF_MESSAGE = 'Das Tippspiel ist im Moment ausgeschaltet.';
  // Spieler-Aktionen, die bei ausgeschaltetem Tippspiel 403 liefern (Lese-Aktionen: siehe requireReader)
  var NEEDS_ON = { invite_check: 1, register: 1, login: 1, tip: 1, bonus_tip: 1, stats: 1, change_password: 1 };
  var KASSE_MAX_CENTS = 10000000;
  var KASSE_OFF_ADMIN = 'Die Stammtischkasse ist ausgeschaltet – einschalten unter „Funktionen“.';
  var DEMO_OWNER_KEY = 'hbs_tipp_demo_owner'; // sessionStorage: Demo-Wirt „angemeldet“ (Wirt-Ansicht)
  var LEAGUE_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var SYNC_WINDOW_MAX = 90;
  var SYNC_LAZY_AFTER = 110, SYNC_LAZY_EVERY = 10, SYNC_LAZY_DAYS = 3; // Minuten / Minuten / Tage – wie im PHP-Backend
  var DEMO_SYNC_MSG = 'Demo: Abruf simuliert – im echten Betrieb kommen die Daten von OpenLigaDB';
  var DEMO_LOGO_MSG = 'Demo: ohne Netzwerk keine Vereinslogos – im echten Betrieb lädt der Server sie einmal von den OpenLigaDB-Quellen und liefert sie selbst aus';

  /* ================================================================ Hilfen */

  function ApiError(message, status, data) {
    var e = new Error(message);
    e.status = status || 400;
    e.data = data || { ok: false, error: message };
    return e;
  }
  function fail(message, status, extra) {
    var data = { ok: false, api: 'hbs-tipp', error: message };
    if (extra) for (var k in extra) data[k] = extra[k];
    throw ApiError(message, status || 400, data);
  }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function lower(s) { return String(s).toLowerCase(); }
  function strLen(s) { return Array.from(String(s)).length; }
  function cmpStr(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Kaufmännisch gerundet auf dec Stellen – rein ganzzahlig, identisch zur PHP-Funktion ratio() */
  function ratio(num, den, dec) {
    if (dec === undefined) dec = 2;
    if (!(den > 0)) return 0;
    var f = Math.pow(10, dec);
    return Math.floor((num * f * 2 + den) / (2 * den)) / f;
  }

  function bonusNorm(s) { return lower(String(s == null ? '' : s).replace(/\s+/g, '')); }

  /* ============================================== Gemeinsame Punkte-Logik (rein) */

  /** Tore aus {home, away} bzw. {home_goals, away_goals} lesen; primary = bevorzugte Schlüssel */
  function goalsOf(obj, primary) {
    if (!obj || typeof obj !== 'object') return null;
    var alt = primary === 'tip' ? ['home_goals', 'away_goals'] : ['home', 'away'];
    var keys = primary === 'tip' ? ['home', 'away'] : ['home_goals', 'away_goals'];
    if (!(keys[0] in obj) && !(keys[1] in obj)) keys = alt;
    var h = obj[keys[0]], w = obj[keys[1]];
    if (h === null || h === undefined || h === '' || w === null || w === undefined || w === '') return null;
    h = Number(h); w = Number(w);
    if (!isFinite(h) || !isFinite(w)) return null;
    return [h, w];
  }

  /**
   * Punkte für einen Tipp.
   * tip: {home, away} (oder {home_goals, away_goals}); result: {home_goals, away_goals} (oder {home, away});
   * settings: {points_exact, points_diff, points_tendency}.
   * → {points, kind: 'exact'|'diff'|'tendency'|'miss'} oder null, wenn Tipp oder Ergebnis fehlt.
   */
  function scoreTip(tip, result, settings) {
    var s = settings || DEFAULT_SETTINGS;
    var t = goalsOf(tip, 'tip');
    var r = goalsOf(result, 'result');
    if (!t || !r) return null;
    if (t[0] === r[0] && t[1] === r[1]) return { points: +s.points_exact, kind: 'exact' };
    var tt = Math.sign(t[0] - t[1]);
    var rt = Math.sign(r[0] - r[1]);
    if (tt !== rt) return { points: 0, kind: 'miss' };
    if (rt !== 0 && (t[0] - t[1]) === (r[0] - r[1])) return { points: +s.points_diff, kind: 'diff' };
    return { points: +s.points_tendency, kind: 'tendency' };
  }

  function hasResult(m) { return m.home_goals !== null && m.home_goals !== undefined && m.away_goals !== null && m.away_goals !== undefined; }

  /**
   * Punkte je Spieler. players: [{id, nickname}], matches: Spiele (nur die mit Ergebnis zählen),
   * tips: [{player_id, match_id, home_goals, away_goals}], comps: Wettbewerbe (Bonus), bonusTips: [{player_id, competition_id, answer}]
   */
  function tally(players, matches, tips, comps, bonusTips, s, withBonus) {
    var t = {};
    players.forEach(function (p) {
      t[p.id] = { points: 0, match_points: 0, bonus: 0, exact: 0, diff: 0, tendency: 0, miss: 0, tips: 0 };
    });
    var byId = {};
    matches.forEach(function (m) { if (hasResult(m)) byId[m.id] = m; });
    tips.forEach(function (tp) {
      var m = byId[tp.match_id];
      var row = t[tp.player_id];
      if (!m || !row) return;
      var sc = scoreTip({ home: tp.home_goals, away: tp.away_goals }, m, s);
      row.tips++;
      row[sc.kind]++;
      row.match_points += sc.points;
    });
    if (withBonus !== false) {
      var answers = {};
      (comps || []).forEach(function (c) {
        if (c.bonus_question != null && String(c.bonus_question).trim() !== '' && bonusNorm(c.bonus_answer) !== '') {
          answers[c.id] = [bonusNorm(c.bonus_answer), +c.bonus_points];
        }
      });
      (bonusTips || []).forEach(function (b) {
        var a = answers[b.competition_id];
        if (a && t[b.player_id] && bonusNorm(b.answer) === a[0]) t[b.player_id].bonus += a[1];
      });
    }
    Object.keys(t).forEach(function (k) { t[k].points = t[k].match_points + t[k].bonus; });
    return t;
  }

  /** Rangliste: Punkte ↓, exakte ↓, Tordifferenz ↓, Nickname; Gleichstand = gleicher Rang */
  function rankRows(players, t, meId) {
    var rows = players.map(function (p) {
      var x = t[p.id];
      return {
        rank: 0, nickname: p.nickname, points: x.points, exact: x.exact, diff: x.diff, tendency: x.tendency,
        tips: x.tips, bonus: x.bonus, is_me: meId != null && p.id === meId, _id: p.id
      };
    });
    rows.sort(function (a, b) {
      return (b.points - a.points) || (b.exact - a.exact) || (b.diff - a.diff) || cmpStr(lower(a.nickname), lower(b.nickname));
    });
    var prev = null;
    rows.forEach(function (r, i) {
      if (prev && prev.points === r.points && prev.exact === r.exact && prev.diff === r.diff) r.rank = prev.rank;
      else r.rank = i + 1;
      prev = r;
    });
    return rows;
  }

  /** Community-Quote (nur nach Tippschluss zeigen) */
  function tendency(tips) {
    var n = tips.length;
    if (!n) return null;
    var h = 0, d = 0, a = 0, res = {};
    tips.forEach(function (t) {
      if (t.home_goals > t.away_goals) h++; else if (t.home_goals === t.away_goals) d++; else a++;
      var k = t.home_goals + ':' + t.away_goals;
      res[k] = (res[k] || 0) + 1;
    });
    var top = null;
    Object.keys(res).forEach(function (k) {
      if (top === null || res[k] > res[top] || (res[k] === res[top] && k < top)) top = k;
    });
    return { home: ratio(h * 100, n, 0), draw: ratio(d * 100, n, 0), away: ratio(a * 100, n, 0), top: top };
  }

  function sortMatches(list) {
    return list.slice().sort(function (a, b) { return cmpStr(a.kickoff, b.kickoff) || (a.id - b.id); });
  }

  /** scope: {comps, players:[{id,nickname}], matches, tips, bonus} */
  function leaderboardOf(scope, s, meId) {
    var t = tally(scope.players, scope.matches.filter(hasResult), scope.tips, scope.comps, scope.bonus, s);
    var rows = rankRows(scope.players, t, meId);
    var meRank = null;
    rows.forEach(function (r) { if (r.is_me) meRank = r.rank; delete r._id; });
    return { rows: rows, me_rank: meRank };
  }

  function statsOf(scope, s, meId) {
    var players = scope.players;
    var scored = sortMatches(scope.matches.filter(hasResult));
    var t = tally(players, scored, scope.tips, scope.comps, scope.bonus, s);
    var me = t[meId] || { points: 0, match_points: 0, bonus: 0, exact: 0, diff: 0, tendency: 0, miss: 0, tips: 0 };
    var myTips = scope.tips.filter(function (x) { return x.player_id === meId; });
    var allMP = 0, allScored = 0;
    Object.keys(t).forEach(function (k) { allMP += t[k].match_points; allScored += t[k].tips; });

    var compNames = {};
    scope.comps.forEach(function (c) { compNames[c.id] = c.name; });
    var groups = [], gIndex = {};
    scored.forEach(function (m) {
      var key = m.competition_id + '|' + (m.round || '');
      if (!gIndex[key]) { gIndex[key] = { cid: m.competition_id, round: m.round || '', matches: [] }; groups.push(gIndex[key]); }
      gIndex[key].matches.push(m);
    });
    var cids = {};
    groups.forEach(function (g) { cids[g.cid] = 1; });
    var multi = Object.keys(cids).length > 1;

    var byRound = [], rankHistory = [], cum = [], best = null;
    groups.forEach(function (g) {
      var label = g.round !== '' ? g.round : 'Ohne Runde';
      if (multi) label = (compNames[g.cid] || '') + ' · ' + label;
      var ids = {};
      g.matches.forEach(function (m) { ids[m.id] = 1; });
      var gTips = scope.tips.filter(function (x) { return ids[x.match_id]; });
      var gt = tally(players, g.matches, gTips, [], [], s, false);
      var sum = 0, n = 0;
      Object.keys(gt).forEach(function (k) { if (gt[k].tips > 0) { sum += gt[k].match_points; n++; } });
      var mine = gt[meId] ? gt[meId].match_points : 0;
      byRound.push({ round: label, points: mine, avg_all: ratio(sum, n) });
      if (best === null || mine > best.points) best = { round: label, points: mine };
      cum = cum.concat(g.matches);
      var ct = tally(players, cum, scope.tips, [], [], s, false);
      var rank = null;
      rankRows(players, ct, meId).forEach(function (r) { if (r.is_me) rank = r.rank; });
      rankHistory.push({ label: label, rank: rank });
    });

    var fav = {}, favorite = null;
    myTips.forEach(function (x) { var k = x.home_goals + ':' + x.away_goals; fav[k] = (fav[k] || 0) + 1; });
    Object.keys(fav).forEach(function (k) {
      if (favorite === null || fav[k] > fav[favorite] || (fav[k] === fav[favorite] && k < favorite)) favorite = k;
    });

    var hits = me.exact + me.diff + me.tendency;
    return {
      points: me.points, bonus: me.bonus, tips: myTips.length, scored_tips: me.tips,
      exact: me.exact, diff: me.diff, tendency: me.tendency, miss: me.miss,
      hit_rate: ratio(hits * 100, me.tips, 1), avg_points: ratio(me.match_points, me.tips),
      avg_points_all: ratio(allMP, allScored), best_round: best, by_round: byRound,
      favorite_tip: favorite, rank_history: rankHistory
    };
  }

  /** Gewertete Spiele nach Runde gruppieren (chronologisch), Beschriftung wie statsOf() – identisch zu round_groups() in PHP */
  function roundGroups(scored, comps) {
    var compNames = {};
    comps.forEach(function (c) { compNames[c.id] = c.name; });
    var groups = [], gIndex = {}, cids = {};
    scored.forEach(function (m) {
      var key = m.competition_id + '|' + (m.round || '');
      if (!gIndex[key]) { gIndex[key] = { cid: m.competition_id, round: m.round || '', matches: [] }; groups.push(gIndex[key]); }
      gIndex[key].matches.push(m);
      cids[m.competition_id] = 1;
    });
    var multi = Object.keys(cids).length > 1;
    groups.forEach(function (g) {
      g.label = g.round !== '' ? g.round : 'Ohne Runde';
      if (multi) g.label = (compNames[g.cid] || '') + ' · ' + g.label;
    });
    return groups;
  }

  /** Häufigstes Ergebnis (Gleichstand: alphabetisch kleinstes) → {tip, count} | null */
  function topTip(tips) {
    var res = {}, top = null;
    tips.forEach(function (t) { var k = t.home_goals + ':' + t.away_goals; res[k] = (res[k] || 0) + 1; });
    Object.keys(res).forEach(function (k) {
      if (top === null || res[k] > res[top] || (res[k] === res[top] && k < top)) top = k;
    });
    return top === null ? null : { tip: top, count: res[top] };
  }

  /** Stammtisch-Statistik für die Wirt-Ansicht (admin_stats) */
  function ownerStatsOf(scope, s) {
    var players = scope.players;
    var scored = sortMatches(scope.matches.filter(hasResult));
    var t = tally(players, scored, scope.tips, scope.comps, scope.bonus, s);
    var sum = { points: 0, match_points: 0, bonus: 0, exact: 0, diff: 0, tendency: 0, miss: 0, tips: 0 };
    Object.keys(t).forEach(function (k) { Object.keys(sum).forEach(function (f) { sum[f] += t[k][f]; }); });
    var tippers = {};
    scope.tips.forEach(function (x) { tippers[x.player_id] = 1; });
    var nick = {};
    players.forEach(function (p) { nick[p.id] = p.nickname; });
    var byRound = roundGroups(scored, scope.comps).map(function (g) {
      var ids = {};
      g.matches.forEach(function (m) { ids[m.id] = 1; });
      var gTips = scope.tips.filter(function (x) { return ids[x.match_id]; });
      var gt = tally(players, g.matches, gTips, [], [], s, false);
      var pts = 0, n = 0, max = 0;
      Object.keys(gt).forEach(function (k) { if (gt[k].tips > 0) { pts += gt[k].match_points; n++; if (gt[k].match_points > max) max = gt[k].match_points; } });
      var best = [];
      if (max > 0) {
        Object.keys(gt).forEach(function (k) { if (gt[k].tips > 0 && gt[k].match_points === max) best.push(nick[k]); });
        best.sort(function (a, b) { return cmpStr(lower(a), lower(b)); });
      }
      return { round: g.label, matches: g.matches.length, tips: gTips.length, avg_points: ratio(pts, n), best: max > 0 ? { nicknames: best, points: max } : null };
    });
    var hits = sum.exact + sum.diff + sum.tendency;
    return {
      players: players.length, tippers: Object.keys(tippers).length, matches: scope.matches.length, scored_matches: scored.length,
      tips: scope.tips.length, scored_tips: sum.tips, exact: sum.exact, diff: sum.diff, tendency: sum.tendency, miss: sum.miss,
      hit_rate: ratio(hits * 100, sum.tips, 1), points: sum.points, bonus: sum.bonus,
      avg_points_tip: ratio(sum.match_points, sum.tips), avg_points_player: ratio(sum.points, players.length),
      favorite_tip: topTip(scope.tips), by_round: byRound
    };
  }

  /* ================================================================== Zeit */

  /** Aktuelle Ortszeit Europe/Berlin als "YYYY-MM-DD HH:MM:SS" */
  function berlinNow(date) {
    date = date || new Date();
    try {
      var f = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      var p = {};
      f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
      var hh = p.hour === '24' ? '00' : p.hour;
      return p.year + '-' + p.month + '-' + p.day + ' ' + hh + ':' + p.minute + ':' + p.second;
    } catch (e) {
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
        pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
    }
  }
  function nowMin() { return berlinNow().slice(0, 16); }
  function nowFull() { return berlinNow(); }
  function today() { return berlinNow().slice(0, 10); }

  /** "naive" Zeitrechnung: Berliner Wanduhrzeit als UTC-Zahl */
  function naiveMs(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/.exec(str);
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }
  function fmtNaive(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }

  /* ============================================================ Validierung */

  function vInt(v, min, max, label) {
    var n;
    if (typeof v === 'number' && isFinite(v) && Math.floor(v) === v && Math.abs(v) < 1e9) n = v;
    else if (typeof v === 'string' && /^\s*-?\d{1,9}\s*$/.test(v)) n = parseInt(v.trim(), 10);
    else fail(label + ': bitte eine ganze Zahl angeben.', 400);
    if (n < min || n > max) fail(label + ' muss zwischen ' + min + ' und ' + max + ' liegen.', 400);
    return n;
  }
  function vId(v, label) { return vInt(v, 1, 2147483647, label || 'ID'); }
  function vGoals(v, label) { return vInt(v, 0, MAX_GOALS, label); }
  function vBool(v, label) {
    if (v === true || v === 1 || v === '1' || v === 'true') return 1;
    if (v === false || v === 0 || v === '0' || v === 'false') return 0;
    fail(label + ': ungültiger Wert (ja/nein erwartet).', 400);
  }
  function vStr(v, min, max, label, multiline) {
    if (v === null || v === undefined) v = '';
    if (typeof v === 'number') v = String(v);
    if (typeof v !== 'string') fail(label + ': ungültiger Text.', 400);
    v = v.replace(/\r\n|\r/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F​-‏‪-‮⁦-⁩﻿]/g, '');
    v = multiline ? v.replace(/\t/g, ' ') : v.replace(/\s+/g, ' ');
    v = v.trim();
    var len = strLen(v);
    if (len < min) fail(min <= 1 ? 'Bitte ' + label + ' angeben.' : label + ' muss mindestens ' + min + ' Zeichen lang sein.', 400);
    if (len > max) fail(label + ' ist zu lang (höchstens ' + max + ' Zeichen).', 400);
    return v;
  }
  function vOptStr(v, max, label) { var s = vStr(v, 0, max, label); return s === '' ? null : s; }
  function checkDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    var dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return d <= dim;
  }
  function parseKickoff(v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    var m, y, mo, d, h, mi;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::00)?$/.exec(v))) { y = +m[1]; mo = +m[2]; d = +m[3]; h = +m[4]; mi = +m[5]; }
    else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4}),? (\d{1,2}):(\d{2})$/.exec(v))) { d = +m[1]; mo = +m[2]; y = +m[3]; h = +m[4]; mi = +m[5]; }
    else return null;
    if (y < 2000 || y > 2100 || !checkDate(y, mo, d) || h > 23 || mi > 59) return null;
    return y + '-' + pad(mo) + '-' + pad(d) + ' ' + pad(h) + ':' + pad(mi);
  }
  function vKickoff(v) {
    var k = parseKickoff(v);
    if (k === null) fail('Anstoß: bitte im Format JJJJ-MM-TT HH:MM angeben (z. B. 2026-06-14 21:00).', 400);
    return k;
  }
  function vExpires(v) {
    if (v === null || v === undefined || v === '') return null;
    var m;
    if (typeof v === 'string' && (m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim())) && checkDate(+m[1], +m[2], +m[3])) return v.trim();
    var k = parseKickoff(v);
    if (k === null) fail('Ablaufdatum: bitte im Format JJJJ-MM-TT angeben.', 400);
    return k;
  }
  function vNickname(v) {
    var n = vStr(v, 2, 24, 'Nickname');
    if (!NICK_RE.test(n) || !NICK_HAS_ALNUM.test(n)) fail('Der Nickname darf nur Buchstaben (auch Umlaute), Ziffern, Leerzeichen sowie _ - . enthalten.', 400);
    return n;
  }
  function vNewPassword(v, label) {
    label = label || 'Das Passwort';
    if (typeof v !== 'string') fail(label + ' ist ungültig.', 400);
    if (strLen(v) < 8) fail(label + ' muss mindestens 8 Zeichen lang sein.', 400);
    if (unescape(encodeURIComponent(v)).length > 200) fail(label + ' ist zu lang (höchstens 200 Zeichen).', 400);
    return v;
  }
  function vEmail(v) {
    var e = vStr(v, 0, 150, 'E-Mail');
    if (e === '') return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('Die E-Mail-Adresse ist ungültig.', 400);
    return e;
  }
  function normCode(v) {
    if (typeof v !== 'string') return '';
    var c = v.replace(/[\s\-]+/g, '').toUpperCase();
    return /^[A-Z0-9]{4,16}$/.test(c) ? c : '';
  }
  function present(data, k) { return data[k] !== undefined && data[k] !== null && data[k] !== ''; }

  function randomString(alphabet, len) {
    var out = '', i, buf = null;
    var c = global.crypto || (typeof crypto !== 'undefined' ? crypto : null);
    if (c && c.getRandomValues) { buf = new Uint32Array(len); c.getRandomValues(buf); }
    for (i = 0; i < len; i++) {
      var r = buf ? buf[i] : Math.floor(Math.random() * 4294967296);
      out += alphabet[r % alphabet.length];
    }
    return out;
  }

  /* ============================================================ Live-Modus */

  var state = {
    mode: null,
    base: '../cms/tipp-api.php',
    csrf: null,
    adminCsrf: null,
    player: null,
    admin: false,
    settings: clone(DEFAULT_SETTINGS),
    features: clone(DEFAULT_FEATURES),
    featuresSet: false, // Demo: per setFeatures() vorgegeben (z. B. von der Verwaltung)
    status: null
  };

  /** Schalter normalisieren (wie features() in PHP) */
  function normFeatures(src) {
    src = src && typeof src === 'object' ? src : {};
    var on = function (v) { return v === true || v === 1 || v === '1' || v === 'true'; };
    var off = function (v) { return v === false || v === 0 || v === '0' || v === 'false'; };
    return {
      tippspiel: !(Object.prototype.hasOwnProperty.call(src, 'tippspiel') && off(src.tippspiel)),
      preise: Object.prototype.hasOwnProperty.call(src, 'preise') && on(src.preise),
      kasse: Object.prototype.hasOwnProperty.call(src, 'kasse') && on(src.kasse)
    };
  }

  function buildQuery(data) {
    var parts = [];
    Object.keys(data || {}).forEach(function (k) {
      var v = data[k];
      if (v === undefined || v === null) return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return parts.length ? '&' + parts.join('&') : '';
  }

  function rememberStatus(res) {
    if (res && res.api === 'hbs-tipp' && 'player' in res) {
      state.player = res.player || null;
      state.csrf = res.csrf || null;
      if ('admin' in res) state.admin = !!res.admin;
      if (res.settings) state.settings = res.settings;
      if (res.features) state.features = normFeatures(res.features);
      state.status = res;
    }
  }

  async function liveFetch(action, data, timeoutMs) {
    var isGet = !!GET_ACTIONS[action];
    var url = state.base + (state.base.indexOf('?') >= 0 ? '&' : '?') + 'action=' + encodeURIComponent(action) + (isGet ? buildQuery(data) : '');
    var headers = { 'Accept': 'application/json' };
    var opts = { method: isGet ? 'GET' : 'POST', credentials: 'include', headers: headers, cache: 'no-store' };
    if (!isGet) {
      headers['Content-Type'] = 'application/json';
      var token = action.indexOf('admin_') === 0 ? state.adminCsrf : state.csrf;
      if (token) headers['X-CSRF-Token'] = token;
      opts.body = JSON.stringify(data || {});
    }
    var ctrl = null, timer = null;
    if (timeoutMs && typeof AbortController !== 'undefined') {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
    }
    try {
      var resp = await fetch(url, opts);
      var text = await resp.text();
      var json = null;
      try { json = JSON.parse(text); } catch (e) { json = null; }
      return { http: resp.status, json: json };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function liveCall(action, data) {
    var r;
    try {
      r = await liveFetch(action, data, 20000);
    } catch (e) {
      throw ApiError('Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.', 0);
    }
    var j = r.json;
    if (!j || typeof j !== 'object') throw ApiError('Der Server hat eine ungültige Antwort geschickt.', r.http || 500);
    if (!j.ok) {
      if (r.http === 401 && j.owner) state.admin = false; // Wirt-Ansicht: Verwaltung abgemeldet
      else if (r.http === 401 && action.indexOf('admin_') !== 0) { state.player = null; state.csrf = null; }
      throw ApiError(j.error || 'Unbekannter Fehler.', r.http, j);
    }
    if (action === 'status' || action === 'login' || action === 'register') rememberStatus(j);
    if (action === 'logout' || action === 'delete_account') { state.player = null; state.csrf = null; }
    if ((action === 'admin_settings_save' || action === 'admin_logos_save') && j.settings) state.settings = j.settings;
    return j;
  }

  /* ============================================================ Demo-Modus */

  var memoryStore = null; // Fallback, falls localStorage nicht verfügbar ist

  function storageGet() {
    try { return global.localStorage ? global.localStorage.getItem(DEMO_KEY) : null; } catch (e) { return null; }
  }
  function storageSet(str) {
    try { if (global.localStorage) { global.localStorage.setItem(DEMO_KEY, str); return true; } } catch (e) { /* voll/gesperrt */ }
    return false;
  }

  function demoHash(pw) { // nur Demo – keine echte Kryptografie
    var h = 0x811c9dc5, s = 'hbs-demo|' + pw;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return 'demo$' + h.toString(16);
  }
  function stamp(p) { return p.pw; }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function emptyDb() {
    return {
      v: DEMO_VERSION, seededAt: Date.now(), seq: { competitions: 0, matches: 0, players: 0 },
      settings: clone(DEFAULT_SETTINGS), competitions: [], matches: [], players: [], invites: [], tips: [], bonus_tips: [], session: null,
      cron_token: null, cron_last: null,
      kasse: { seq: 0, entries: [], purpose: '', show_names: false }
    };
  }

  function seedDb() {
    var db = emptyDb();
    var rnd = mulberry32(20260611);
    var now = berlinNow();
    var nowMs = naiveMs(now);
    var day = 24 * 3600 * 1000;
    var todayMs = naiveMs(now.slice(0, 10) + ' 00:00');
    var at = function (dayOffset, hh, mm) { return fmtNaive(todayMs + dayOffset * day + (hh * 60 + (mm || 0)) * 60000); };
    var created = fmtNaive(todayMs - 20 * day + 19 * 3600000) + ':00';

    db.competitions.push({ id: 1, name: 'Demo-Turnier', active: 1, sort: 0, bonus_question: 'Wer gewinnt das Turnier?', bonus_answer: null, bonus_points: 10, created: created,
      source: null, source_league: null, source_season: null, sync_window_days: 14, last_sync: null, last_sync_status: null });
    db.seq.competitions = 1;

    var A = 'Gruppe A · 1. Spieltag', B = 'Gruppe B · 1. Spieltag', A2 = 'Gruppe A · 2. Spieltag', B2 = 'Gruppe B · 2. Spieltag',
      A3 = 'Gruppe A · 3. Spieltag', B3 = 'Gruppe B · 3. Spieltag';
    var running = fmtNaive(Math.floor((nowMs - 30 * 60000) / 60000) * 60000);
    var plan = [
      // vergangene Spiele mit Ergebnis
      [at(-9, 18), 'Deutschland', 'Schweiz', A, 2, 1],
      [at(-9, 21), 'Spanien', 'Kroatien', A, 1, 1],
      [at(-8, 18), 'Italien', 'Österreich', A, 0, 2],
      [at(-8, 21), 'Frankreich', 'Dänemark', B, 3, 0],
      [at(-7, 18), 'Portugal', 'Belgien', B, 1, 2],
      [at(-7, 21), 'England', 'Niederlande', B, 2, 2],
      [at(-5, 18), 'Deutschland', 'Spanien', A2, 1, 0],
      [at(-5, 21), 'Schweiz', 'Italien', A2, 0, 0],
      [at(-4, 21), 'Kroatien', 'Österreich', A2, 4, 1],
      // läuft gerade (gesperrt, noch kein Ergebnis)
      [running, 'Frankreich', 'Portugal', B2, null, null],
      // kommende Spiele
      [at(1, 18), 'Dänemark', 'Belgien', B2, null, null],
      [at(1, 21), 'Niederlande', 'England', B2, null, null],
      [at(2, 18), 'Österreich', 'Deutschland', A3, null, null],
      [at(2, 21), 'Italien', 'Spanien', A3, null, null],
      [at(3, 21), 'Kroatien', 'Schweiz', A3, null, null],
      [at(4, 18), 'Belgien', 'Frankreich', B3, null, null],
      [at(4, 21), 'England', 'Portugal', B3, null, null],
      [at(5, 21), 'Dänemark', 'Niederlande', B3, null, null]
    ];
    plan.forEach(function (p, i) {
      db.matches.push({ id: i + 1, competition_id: 1, round: p[3], kickoff: p[0], home: p[1], away: p[2], home_goals: p[4], away_goals: p[5],
        external_id: null, external_group: null, result_source: p[4] !== null ? 'manual' : null });
    });
    db.seq.matches = plan.length;

    // Bundesliga-Saison: letzter (abgeschlossener) und nächster Spieltag, Fr–So wie im echten Spielplan
    db.competitions[0].sort = 1;
    // … mit automatischem Abruf (im Demo-Modus nur simuliert)
    db.competitions.push({ id: 2, name: 'Bundesliga 2026/27', active: 1, sort: 0, bonus_question: 'Wer wird Deutscher Meister?', bonus_answer: null, bonus_points: 10, created: created,
      source: 'openligadb', source_league: 'bl1', source_season: 2026, sync_window_days: 14,
      last_sync: fmtNaive(nowMs - 25 * 60000) + ':00', last_sync_status: 'OK – keine Änderungen' });
    db.seq.competitions = 2;
    var dow = new Date(Date.UTC(+now.slice(0, 4), +now.slice(5, 7) - 1, +now.slice(8, 10))).getUTCDay();
    var nextFri = (5 - dow + 7) % 7 || 7;
    var lastFri = nextFri - 7;
    if (lastFri + 2 >= 0) lastFri -= 7;
    var blSlots = function (fri) {
      return [at(fri, 20, 30), at(fri + 1, 15, 30), at(fri + 1, 15, 30), at(fri + 1, 15, 30), at(fri + 1, 15, 30), at(fri + 1, 15, 30),
        at(fri + 1, 18, 30), at(fri + 2, 15, 30), at(fri + 2, 17, 30)];
    };
    var past = blSlots(lastFri), next = blSlots(nextFri);
    var bl = [
      [past[0], 'Eintracht Frankfurt', 'Mainz 05', 2, 1], [past[1], 'Bayern München', 'SC Freiburg', 3, 0],
      [past[2], 'VfB Stuttgart', 'TSG Hoffenheim', 2, 2], [past[3], 'Werder Bremen', 'VfL Wolfsburg', 1, 0],
      [past[4], 'FC Augsburg', 'Union Berlin', 0, 0], [past[5], '1. FC Heidenheim', 'Mönchengladbach', 1, 3],
      [past[6], 'Borussia Dortmund', 'RB Leipzig', 2, 1], [past[7], 'FC St. Pauli', '1. FC Köln', 1, 1],
      [past[8], 'Hamburger SV', 'Bayer Leverkusen', 0, 2],
      [next[0], 'TSG Hoffenheim', 'Werder Bremen', null, null], [next[1], 'RB Leipzig', 'Bayern München', null, null],
      [next[2], 'SC Freiburg', 'VfB Stuttgart', null, null], [next[3], 'VfL Wolfsburg', 'FC Augsburg', null, null],
      [next[4], 'Union Berlin', '1. FC Heidenheim', null, null], [next[5], 'Mainz 05', 'FC St. Pauli', null, null],
      [next[6], 'Bayer Leverkusen', 'Borussia Dortmund', null, null], [next[7], '1. FC Köln', 'Eintracht Frankfurt', null, null],
      [next[8], 'Mönchengladbach', 'Hamburger SV', null, null]
    ];
    bl.forEach(function (p, i) {
      db.matches.push({ id: db.seq.matches + 1, competition_id: 2, round: (i < 9 ? 12 : 13) + '. Spieltag', kickoff: p[0], home: p[1], away: p[2], home_goals: p[3], away_goals: p[4],
        external_id: String(83240 + i), external_group: i < 9 ? 12 : 13, result_source: p[3] !== null ? 'auto' : null });
      db.seq.matches++;
    });

    db.invites.push({ code: 'DEMO2026', note: 'Demo-Einladung (für alle)', max_uses: 100, uses: 9, expires: null, revoked: 0, created: created });
    db.invites.push({ code: 'THEKE4UH', note: 'Aushang an der Theke', max_uses: 50, uses: 0, expires: at(30, 0).slice(0, 10), revoked: 0, created: created });
    db.invites.push({ code: 'KALLE7KX', note: 'Kalle (persönlich)', max_uses: 1, uses: 1, expires: null, revoked: 0, created: created });
    db.invites.push({ code: 'ALT3RCDE', note: 'Alter Code (zurückgezogen)', max_uses: 10, uses: 0, expires: null, revoked: 1, created: created });

    var names = ['Gast', 'Kalle', 'Uschi_66', 'Theken-Toni', 'Moni', 'Schorsch', 'Jürgen W.', 'Biggi', 'Hansi', 'Dr. Elfmeter'];
    var champs = ['Deutschland', 'Frankreich', 'Spanien', 'Deutschland', 'England', 'Portugal', 'Deutschland', 'Niederlande', 'Spanien', 'Frankreich'];
    var blChamps = ['Bayern München', 'Bayern München', 'Borussia Dortmund', 'Bayern München', 'Bayer Leverkusen', 'VfB Stuttgart', 'Bayern München', 'RB Leipzig', 'Bayer Leverkusen', 'Borussia Dortmund'];
    var goals = [0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];
    var firstKick = db.matches[0].kickoff;
    var nowFullStr = now;
    names.forEach(function (n, i) {
      var id = i + 1;
      var lastLogin = fmtNaive(nowMs - Math.floor(rnd() * 5 * day)) + ':00';
      db.players.push({
        id: id, nickname: n, pw: demoHash(n === 'Gast' ? 'demo1234' : 'stammgast-' + id), email: null, active: 1,
        created: created, last_login: lastLogin, invite_code: id === 2 ? 'KALLE7KX' : 'DEMO2026'
      });
      db.bonus_tips.push({ player_id: id, competition_id: 1, answer: champs[i], updated: fmtNaive(naiveMs(firstKick) - (i + 2) * 3600000) + ':00' });
      db.bonus_tips.push({ player_id: id, competition_id: 2, answer: blChamps[i], updated: fmtNaive(naiveMs(past[0]) - (i + 30) * 3600000) + ':00' });
      db.matches.forEach(function (m, mi) {
        var upcoming = m.kickoff > nowFullStr.slice(0, 16);
        if (n === 'Gast') {
          if (upcoming && (mi > 11 || m.competition_id === 2)) return; // ein paar kommende Spiele bleiben zum Ausprobieren offen
          if (!upcoming && mi === 4) return;       // einmal vergessen
        } else if (upcoming ? rnd() < 0.35 : rnd() < 0.08) {
          return;
        }
        var h, a;
        if (m.home_goals !== null && rnd() < 0.22) { h = m.home_goals; a = m.away_goals; }
        else { h = goals[Math.floor(rnd() * goals.length)]; a = goals[Math.floor(rnd() * goals.length)]; if (rnd() < 0.3 && h === a) h++; }
        var upd = fmtNaive(naiveMs(m.kickoff) - Math.floor(1 + rnd() * 48) * 3600000);
        if (upd > nowFullStr.slice(0, 16)) upd = fmtNaive(nowMs - Math.floor(rnd() * 120) * 60000);
        db.tips.push({ player_id: id, match_id: m.id, home_goals: h, away_goals: a, updated: upd + ':00' });
      });
    });
    db.seq.players = names.length;

    // Preise (sichtbar nur mit features.preise) – vom Haus spendiert
    db.competitions[1].prize_1 = '30-€-Gutschein fürs Stüble';
    db.competitions[1].prize_2 = 'Eine Runde aufs Haus';
    db.competitions[1].prize_3 = 'Ein Stüble-Bierkrug';
    db.competitions[1].prize_note = 'Übergabe bei der Saisonabschluss-Feier';
    // Stammtischkasse (sichtbar nur mit features.kasse) – ohne jeden Bezug zum Tippspiel
    var kd = function (off) { return at(off, 0).slice(0, 10); };
    db.kasse = { seq: 3, purpose: 'für die Saisonabschluss-Feier', show_names: false, entries: [
      { id: 1, kind: 'in', amount_cents: 5000, day: kd(-20), name: 'Stammtisch-Runde', purpose: '', note: 'Sparschwein an der Theke', created: created, updated: created },
      { id: 2, kind: 'in', amount_cents: 2000, day: kd(-12), name: 'Kalle', purpose: '', note: '', created: created, updated: created },
      { id: 3, kind: 'in', amount_cents: 1500, day: kd(-6), name: 'Uschi_66', purpose: '', note: '', created: created, updated: created }
    ] };
    return db;
  }

  var demoDb = null;

  /* --- Demo-Wirt (Wirt-Ansicht): „angemeldet“ per URL ?wirt=1 oder TippAPI.demoSetOwner(true), gilt für diesen Tab */
  var demoOwnerMem = false;
  function demoOwner() {
    try {
      if (global.location && /[?&]wirt=1(&|$)/.test(global.location.search || '')) demoSetOwner(true);
    } catch (e) { /* kein location */ }
    try { if (global.sessionStorage) return global.sessionStorage.getItem(DEMO_OWNER_KEY) === '1'; } catch (e) { /* gesperrt */ }
    return demoOwnerMem;
  }
  function demoSetOwner(on) {
    demoOwnerMem = !!on;
    try {
      if (global.sessionStorage) {
        if (on) global.sessionStorage.setItem(DEMO_OWNER_KEY, '1'); else global.sessionStorage.removeItem(DEMO_OWNER_KEY);
      }
    } catch (e) { /* gesperrt – Speicher im Tab */ }
    if (state.mode === 'demo') state.admin = !!on;
    return !!on;
  }

  function demoLoad() {
    var raw = storageGet();
    var parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    if (!parsed) parsed = demoDb || memoryStore;
    if (!parsed || parsed.v !== DEMO_VERSION || !(Date.now() - (parsed.seededAt || 0) < DEMO_MAX_AGE_MS)) {
      demoDb = seedDb();
      demoSave();
      return demoDb;
    }
    demoDb = parsed;
    return demoDb;
  }
  function demoSave() {
    var str = JSON.stringify(demoDb);
    if (!storageSet(str)) memoryStore = JSON.parse(str);
  }

  function demoReset(opts) {
    demoDb = (opts && opts.empty) ? emptyDb() : seedDb();
    demoSave();
    if (state.mode === 'demo') { state.player = null; state.csrf = null; }
    return true;
  }

  /* --- Demo-Datenzugriff --- */

  function dbSettings(db) {
    return {
      points_exact: +db.settings.points_exact, points_diff: +db.settings.points_diff, points_tendency: +db.settings.points_tendency,
      show_logos: db.settings.show_logos === undefined ? true : !!db.settings.show_logos
    };
  }
  function findComp(db, id) { return db.competitions.filter(function (c) { return c.id === id; })[0] || null; }
  function findMatch(db, id) { return db.matches.filter(function (m) { return m.id === id; })[0] || null; }
  function findPlayer(db, id) { return db.players.filter(function (p) { return p.id === id; })[0] || null; }
  function findPlayerByNick(db, nick) {
    var k = lower(nick);
    return db.players.filter(function (p) { return lower(p.nickname) === k; })[0] || null;
  }
  function compsSorted(db) {
    return db.competitions.slice().sort(function (a, b) { return (a.sort - b.sort) || (a.id - b.id); });
  }
  function firstKickoffs(db) {
    var out = {};
    db.matches.forEach(function (m) { if (!out[m.competition_id] || m.kickoff < out[m.competition_id]) out[m.competition_id] = m.kickoff; });
    return out;
  }
  function bonusLocked(cid, fk) { return !!fk[cid] && nowMin() >= fk[cid]; }
  function compOut(c, fk) {
    return {
      id: c.id, name: c.name, active: !!c.active, sort: c.sort, bonus_question: c.bonus_question, bonus_answer: c.bonus_answer,
      bonus_points: c.bonus_points, bonus_locked: bonusLocked(c.id, fk), source: c.source || null, prizes: prizesOut(c)
    };
  }
  /** Preise nur mit features.preise und wenn mindestens ein Preis eingetragen ist (wie prizes_out in PHP) */
  function prizesOut(c) {
    if (!state.features.preise) return null;
    var p = {};
    [['first', 'prize_1'], ['second', 'prize_2'], ['third', 'prize_3'], ['note', 'prize_note']].forEach(function (x) {
      var v = c[x[1]];
      p[x[0]] = v != null && String(v).trim() !== '' ? String(v) : null;
    });
    return p.first === null && p.second === null && p.third === null ? null : p;
  }
  function compAdminOut(c, fk) {
    var o = compOut(c, fk);
    o.source_league = c.source_league == null ? null : c.source_league;
    o.source_season = c.source_season == null ? null : +c.source_season;
    o.sync_window_days = c.sync_window_days == null ? 14 : +c.sync_window_days;
    o.last_sync = c.last_sync || null;
    o.last_sync_status = c.last_sync_status || null;
    o.prize_1 = c.prize_1 == null ? null : c.prize_1;
    o.prize_2 = c.prize_2 == null ? null : c.prize_2;
    o.prize_3 = c.prize_3 == null ? null : c.prize_3;
    o.prize_note = c.prize_note == null ? null : c.prize_note;
    return o;
  }
  function matchBase(m) {
    return {
      id: m.id, competition_id: m.competition_id, round: m.round, kickoff: m.kickoff, home: m.home, away: m.away,
      home_goals: m.home_goals, away_goals: m.away_goals, locked: nowMin() >= m.kickoff, result_source: m.result_source || null,
      home_logo: null, away_logo: null // Demo: ohne Netzwerk keine Vereinslogos (die App zeigt die Kürzel)
    };
  }
  function inviteValid(inv) {
    if (inv.revoked || inv.uses >= inv.max_uses) return false;
    if (!inv.expires) return true;
    return inv.expires.length === 10 ? today() <= inv.expires : nowMin() < inv.expires;
  }
  function inviteOut(i) {
    return { code: i.code, note: i.note, max_uses: i.max_uses, uses: i.uses, expires: i.expires, revoked: !!i.revoked, created: i.created, valid: inviteValid(i) };
  }
  function scopeOf(db, compId, onlyActive) {
    var comps = compId != null ? db.competitions.filter(function (c) { return c.id === compId; }) : compsSorted(db);
    var cids = {};
    comps.forEach(function (c) { cids[c.id] = 1; });
    var players = db.players.filter(function (p) { return !onlyActive || p.active; })
      .sort(function (a, b) { return a.id - b.id; })
      .map(function (p) { return { id: p.id, nickname: p.nickname }; });
    var pids = {};
    players.forEach(function (p) { pids[p.id] = 1; });
    var matches = sortMatches(db.matches.filter(function (m) { return cids[m.competition_id]; }));
    var mids = {};
    matches.forEach(function (m) { mids[m.id] = 1; });
    return {
      comps: comps, players: players, matches: matches,
      tips: db.tips.filter(function (t) { return mids[t.match_id] && pids[t.player_id]; }),
      bonus: db.bonus_tips.filter(function (b) { return cids[b.competition_id] && pids[b.player_id]; })
    };
  }

  function demoCurrentPlayer(db) {
    var s = db.session;
    if (!s) return null;
    var p = findPlayer(db, s.pid);
    if (!p || !p.active || s.stamp !== stamp(p)) { db.session = null; return null; }
    return p;
  }
  function demoStatus(db, p) {
    return {
      ok: true, api: 'hbs-tipp',
      player: p ? { id: p.id, nickname: p.nickname, email: p.email } : null,
      csrf: p ? db.session.csrf : null, settings: dbSettings(db), features: clone(state.features), serverTime: nowFull(), admin: demoOwner(), demo: true
    };
  }
  function demoLogin(db, p) {
    db.session = { pid: p.id, stamp: stamp(p), csrf: randomString('0123456789abcdef', 64) };
  }
  function requirePlayer(db) {
    var p = demoCurrentPlayer(db);
    if (!p) fail('Bitte melde dich an.', 401, { loggedIn: false });
    return p;
  }
  /** wie require_reader() in PHP: Spieler hat Vorrang; ohne Spieler oder mit view=owner → Wirt-Ansicht (nur lesen) */
  function requireReader(db, d) {
    var force = d && d.view === 'owner';
    if (!state.features.tippspiel) {
      if (demoOwner()) return { player: null, owner: true };
      fail(OFF_MESSAGE, 403, { disabled: true });
    }
    if (!force) {
      var p = demoCurrentPlayer(db);
      if (p) return { player: p, owner: false };
    }
    if (demoOwner()) return { player: null, owner: true };
    if (force) fail('Die Wirt-Ansicht braucht eine Anmeldung in der Verwaltung.', 401, { loggedIn: false, owner: true });
    fail('Bitte melde dich an.', 401, { loggedIn: false });
  }
  function optCompId(db, data) {
    if (!present(data, 'competition_id')) return null;
    var id = vId(data.competition_id, 'Wettbewerb');
    if (!findComp(db, id)) fail('Wettbewerb nicht gefunden.', 404);
    return id;
  }
  function compOr404(db, id) { var c = findComp(db, id); if (!c) fail('Wettbewerb nicht gefunden.', 404); return c; }
  function matchOr404(db, id) { var m = findMatch(db, id); if (!m) fail('Spiel nicht gefunden.', 404); return m; }
  function playerOr404(db, id) { var p = findPlayer(db, id); if (!p) fail('Spieler nicht gefunden.', 404); return p; }
  function removePlayer(db, id) {
    db.tips = db.tips.filter(function (t) { return t.player_id !== id; });
    db.bonus_tips = db.bonus_tips.filter(function (b) { return b.player_id !== id; });
    db.players = db.players.filter(function (p) { return p.id !== id; });
  }
  function ok(obj) { var o = { ok: true }; for (var k in obj) o[k] = obj[k]; return o; }

  /* --- Automatischer Abruf (Demo: Simulation ohne Netzwerk) */

  function vLeague(v) {
    var l = typeof v === 'string' ? v.trim() : '';
    if (!LEAGUE_RE.test(l)) fail('Liga-Kürzel: bitte nur Buchstaben, Ziffern, _ und - (z. B. bl1).', 400);
    return l;
  }
  function vSeason(v) {
    var s = typeof v === 'number' ? String(v) : (typeof v === 'string' ? v.trim() : '');
    if (!/^\d{4}$/.test(s) || +s < 2000 || +s > 2100) fail('Saison: bitte das Startjahr angeben (z. B. 2026 für 2026/27).', 400);
    return +s;
  }
  function seasonLabel(y) { return y + '/' + pad((y + 1) % 100); }
  function demoStatusText(r, mode) {
    var parts = [];
    if (r.inserted) parts.push(r.inserted + ' neu');
    if (r.updated) parts.push(r.updated + ' geändert');
    if (r.results) parts.push(r.results + (r.results === 1 ? ' Ergebnis' : ' Ergebnisse'));
    if (r.skipped_manual) parts.push(r.skipped_manual + ' von Hand behalten');
    if (r.errors && r.errors.length) parts.push(r.errors.length + ' Hinweis' + (r.errors.length === 1 ? '' : 'e'));
    return 'OK' + (mode === 'results' ? ' (Ergebnisse)' : '') + ' – ' + (parts.length ? parts.join(', ') : 'keine Änderungen');
  }
  /** Plausibles (für jedes Spiel immer gleiches) Ergebnis */
  function demoResult(m) {
    var r = mulberry32(7919 * m.id + 20261124);
    var g = [0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4];
    return [g[Math.floor(r() * g.length)], g[Math.floor(r() * g.length)]];
  }
  /** Simulierter Abruf: angepfiffene Spiele ohne Ergebnis bekommen eines – von Hand eingetragene bleiben unangetastet. */
  function demoSimulate(db, c, minAfterKickoff, minKickoff) {
    var now = nowMin(), nowMs = naiveMs(now);
    var res = { results: 0, skipped_manual: 0 };
    db.matches.forEach(function (m) {
      if (m.competition_id !== c.id || now < m.kickoff) return;
      if (naiveMs(m.kickoff) + minAfterKickoff * 60000 > nowMs) return;
      if (minKickoff && m.kickoff < minKickoff) return;
      if (m.result_source === 'manual' && m.home_goals !== null) {
        var r0 = demoResult(m);
        if (r0[0] !== m.home_goals || r0[1] !== m.away_goals) res.skipped_manual++;
        return;
      }
      if (m.home_goals !== null) return;
      var r = demoResult(m);
      m.home_goals = r[0]; m.away_goals = r[1]; m.result_source = 'auto';
      res.results++;
    });
    return res;
  }
  /** wie lazy_sync() im PHP-Backend: fehlende Ergebnisse ≥ 110 Min. nach Anstoß, höchstens alle 10 Min. je Wettbewerb */
  function demoLazySync(db) {
    var nowMs = naiveMs(berlinNow());
    var limit = fmtNaive(nowMs - SYNC_LAZY_AFTER * 60000), oldest = fmtNaive(nowMs - SYNC_LAZY_DAYS * 24 * 3600000);
    var every = fmtNaive(nowMs - SYNC_LAZY_EVERY * 60000) + ':' + berlinNow().slice(17, 19);
    db.competitions.forEach(function (c) {
      if (c.source !== 'openligadb' || !c.active || (c.last_sync && c.last_sync > every)) return;
      var due = db.matches.some(function (m) {
        return m.competition_id === c.id && m.external_id && m.home_goals === null && m.kickoff <= limit && m.kickoff >= oldest;
      });
      if (!due) return;
      var r = demoSimulate(db, c, SYNC_LAZY_AFTER, oldest);
      c.last_sync = nowFull();
      c.last_sync_status = demoStatusText({ inserted: 0, updated: 0, results: r.results, skipped_manual: 0, errors: [] }, 'results');
    });
  }
  /** Vereinslogos im Demo-Modus: keine Downloads – alle Mannschaften ohne Logo */
  function demoLogoStats(db) {
    var seen = {}, n = 0;
    db.matches.forEach(function (m) { [m.home, m.away].forEach(function (t) { var k = lower(t); if (!seen[k]) { seen[k] = 1; n++; } }); });
    return { ok: 0, failed: 0, pending: 0, none: n, teams: n, failed_list: [], show: dbSettings(db).show_logos, gd: false, demo: true };
  }
  function demoLogoRun() { return { loaded: 0, failed: 0, paused: 0, remaining: 0, errors: [] }; }

  function demoCronInfo(db) {
    if (!db.cron_token) db.cron_token = randomString('0123456789abcdef', 48);
    var base = 'https://www.example.de/cms/tipp-api.php';
    try { if (global.location && /^https?:$/.test(global.location.protocol)) base = new URL(state.base, global.location.href).href.split('?')[0]; } catch (e) { /* Standard */ }
    return { url_with_token: base + '?action=cron_sync&token=' + db.cron_token, last_cron: db.cron_last ? clone(db.cron_last) : null, demo: true };
  }
  var DEMO_PREVIEWS = {
    bl1: { name: '1. Fußball-Bundesliga %S', count: 306, rounds: 34, teams: 18, finished: 90, first: '-08-28 20:30', last: [1, '-05-22 15:30'], current: '10. Spieltag', order: 10, round: '11. Spieltag',
      next: [[3, 1230, 'SV Werder Bremen', 'Borussia Mönchengladbach'], [4, 930, 'FC Bayern München', 'VfL Wolfsburg'], [4, 930, 'Bayer 04 Leverkusen', '1. FC Köln'], [4, 1110, 'Borussia Dortmund', 'VfB Stuttgart'], [5, 930, 'Eintracht Frankfurt', 'SC Freiburg']] },
    bl2: { name: '2. Fußball-Bundesliga %S', count: 306, rounds: 34, teams: 18, finished: 108, first: '-08-07 20:30', last: [1, '-05-23 15:30'], current: '13. Spieltag', order: 13, round: '14. Spieltag',
      next: [[3, 1110, 'Hertha BSC', 'FC Schalke 04'], [4, 780, 'Hannover 96', '1. FC Nürnberg'], [4, 780, 'Fortuna Düsseldorf', 'Karlsruher SC'], [5, 810, 'SV Darmstadt 98', 'SC Paderborn 07'], [5, 810, 'Holstein Kiel', 'Hamburger SV']] },
    dfb: { name: 'DFB Pokal %S', count: 56, rounds: 3, teams: 64, finished: 48, first: '-08-21 18:00', last: [0, '-12-02 20:45'], current: 'Achtelfinale', order: 3, round: 'Achtelfinale',
      next: [[7, 1080, 'VfB Stuttgart', 'Dynamo Dresden'], [7, 1245, 'FC Bayern München', 'Hertha BSC'], [8, 1080, 'SC Freiburg', 'Eintracht Frankfurt'], [8, 1245, 'Borussia Dortmund', 'Werder Bremen']] },
    ucl: { name: 'Champions League %S', count: 144, rounds: 8, teams: 36, finished: 74, first: '-09-08 18:45', last: [1, '-01-27 21:00'], current: '5.Spieltag', order: 5, round: '5.Spieltag',
      next: [[1, 1125, 'Sabah', 'FC Barcelona'], [1, 1260, 'FC Bayern München', 'Inter Mailand'], [1, 1260, 'Bayer 04 Leverkusen', 'FC Liverpool'], [2, 1125, 'Paris Saint-Germain', 'Borussia Dortmund'], [2, 1260, 'Real Madrid', 'Juventus Turin']] },
    ffb1: { name: '1. Frauen Fußballbundesliga %S', count: 182, rounds: 26, teams: 14, finished: 77, first: '-08-21 18:20', last: [1, '-05-23 15:30'], current: '11. Spieltag', order: 11, round: '12. Spieltag',
      next: [[16, 1110, 'FC Bayern München Frauen', '1. FC Nürnberg Frauen'], [17, 720, 'SV Werder Bremen Frauen', 'Eintracht Frankfurt Frauen'], [17, 840, 'TSG 1899 Hoffenheim Frauen', 'Hamburger SV Frauen'], [18, 960, 'SC Freiburg Frauen', 'VfL Wolfsburg Frauen']] },
    wcl: { name: "UEFA Women's Champions League %S", count: 54, rounds: 6, teams: 18, finished: 45, first: '-09-22 21:00', last: [0, '-12-16 21:00'], current: '5. Spieltag', order: 5, round: '6. Spieltag',
      next: [[21, 1260, 'FC Bayern München Frauen', 'FC Barcelona Women'], [21, 1260, 'A.S. Roma Women', 'Real Madrid (Women)'], [21, 1260, 'Inter Milan (Women)', 'Arsenal W.F.C. (Women)']] },
    dfbf: { name: 'DFB-Pokal Frauen %S', count: 40, rounds: 3, teams: 48, finished: 40, first: '-08-15 11:00', last: [0, '-11-02 18:00'], current: 'Achtelfinale', order: 3, round: 'Achtelfinale', next: [] }
  };

  var demoActions = {

    /* ----------------------------------------------------------- Spieler */

    status: function (db) { var p = demoCurrentPlayer(db); demoLazySync(db); return demoStatus(db, p); },

    invite_check: function (db, d) {
      var code = normCode(d.code);
      var inv = code ? db.invites.filter(function (i) { return i.code === code; })[0] : null;
      return ok({ valid: !!(inv && inviteValid(inv)) });
    },

    register: function (db, d) {
      var code = normCode(d.code);
      var nick = vNickname(d.nickname);
      var pw = vNewPassword(d.password);
      var email = vEmail(d.email);
      var inv = code ? db.invites.filter(function (i) { return i.code === code; })[0] : null;
      if (!inv || !inviteValid(inv)) fail('Der Einladungscode ist ungültig, abgelaufen oder schon aufgebraucht.', 400);
      if (findPlayerByNick(db, nick)) fail('Dieser Nickname ist schon vergeben. Bitte such dir einen anderen aus.', 409);
      var now = nowFull();
      var p = { id: ++db.seq.players, nickname: nick, pw: demoHash(pw), email: email, active: 1, created: now, last_login: now, invite_code: code };
      db.players.push(p);
      inv.uses++;
      demoLogin(db, p);
      return demoStatus(db, p);
    },

    login: function (db, d) {
      var nick = typeof d.nickname === 'string' ? d.nickname.replace(/\s+/g, ' ').trim() : '';
      if (nick === '' || typeof d.password !== 'string' || d.password === '') fail('Bitte Nickname und Passwort eingeben.', 400);
      var p = findPlayerByNick(db, nick);
      if (!p || p.pw !== demoHash(d.password)) fail('Nickname oder Passwort falsch.', 401);
      if (!p.active) fail('Dein Konto ist gesperrt. Bitte sprich uns an der Theke an.', 403);
      p.last_login = nowFull();
      demoLogin(db, p);
      return demoStatus(db, p);
    },

    logout: function (db) { db.session = null; return ok({}); },

    matches: function (db, d) {
      var rd = requireReader(db, d), me = rd.player, owner = rd.owner;
      var cid = optCompId(db, d);
      demoLazySync(db);
      var s = dbSettings(db);
      var comps = cid != null ? [findComp(db, cid)] : compsSorted(db).filter(function (c) { return c.active; });
      var fk = firstKickoffs(db);
      var cids = {};
      comps.forEach(function (c) { cids[c.id] = 1; });
      var active = {};
      db.players.forEach(function (p) { if (p.active) active[p.id] = 1; });
      var tipsBy = {};
      db.tips.forEach(function (t) { if (active[t.player_id]) (tipsBy[t.match_id] = tipsBy[t.match_id] || []).push(t); });
      var outComps = comps.map(function (c) {
        var o = compOut(c, fk);
        if (owner) {
          o.bonus_count = db.bonus_tips.filter(function (x) { return active[x.player_id] && x.competition_id === c.id; }).length;
          return o;
        }
        var b = db.bonus_tips.filter(function (x) { return x.player_id === me.id && x.competition_id === c.id; })[0];
        o.my_bonus = b ? b.answer : null;
        return o;
      });
      var outMatches = sortMatches(db.matches.filter(function (m) { return cids[m.competition_id]; })).map(function (m) {
        var o = matchBase(m);
        var list = tipsBy[m.id] || [];
        if (owner) { o.tip_count = list.length; o.tendency = tendency(list); return o; }
        var mine = null;
        list.forEach(function (t) { if (t.player_id === me.id) mine = { home: t.home_goals, away: t.away_goals }; });
        var sc = mine ? scoreTip(mine, m, s) : null;
        o.my_tip = mine;
        o.my_points = sc ? sc.points : null;
        o.my_kind = sc ? sc.kind : null;
        o.tip_count = list.length;
        o.tendency = o.locked ? tendency(list) : null;
        return o;
      });
      var out = { competitions: outComps, matches: outMatches, serverTime: nowFull() };
      if (owner) out.owner = true;
      return ok(out);
    },

    tip: function (db, d) {
      var me = requirePlayer(db);
      var mid = vId(d.match_id, 'Spiel');
      var h = vGoals(d.home, 'Tore Heim');
      var a = vGoals(d.away, 'Tore Gast');
      var m = findMatch(db, mid);
      if (!m) fail('Spiel nicht gefunden.', 404);
      var c = findComp(db, m.competition_id);
      if (!c || !c.active) fail('Dieser Wettbewerb ist gerade nicht aktiv.', 409);
      if (nowMin() >= m.kickoff) fail('Tippschluss! Das Spiel hat schon begonnen – dein Tipp kann nicht mehr geändert werden.', 409, { locked: true });
      var now = nowFull();
      var t = db.tips.filter(function (x) { return x.player_id === me.id && x.match_id === mid; })[0];
      if (t) { t.home_goals = h; t.away_goals = a; t.updated = now; }
      else db.tips.push({ player_id: me.id, match_id: mid, home_goals: h, away_goals: a, updated: now });
      return ok({ tip: { home: h, away: a }, updated: now });
    },

    bonus_tip: function (db, d) {
      var me = requirePlayer(db);
      var cid = vId(d.competition_id, 'Wettbewerb');
      var answer = vStr(d.answer, 1, 80, 'eine Antwort');
      var c = findComp(db, cid);
      if (!c) fail('Wettbewerb nicht gefunden.', 404);
      if (!c.active) fail('Dieser Wettbewerb ist gerade nicht aktiv.', 409);
      if (c.bonus_question == null || String(c.bonus_question).trim() === '') fail('Für diesen Wettbewerb gibt es keine Bonusfrage.', 400);
      if (bonusLocked(cid, firstKickoffs(db))) fail('Tippschluss! Die Bonusfrage konnte nur bis zum Anstoß des ersten Spiels beantwortet werden.', 409, { locked: true });
      var b = db.bonus_tips.filter(function (x) { return x.player_id === me.id && x.competition_id === cid; })[0];
      if (b) { b.answer = answer; b.updated = nowFull(); }
      else db.bonus_tips.push({ player_id: me.id, competition_id: cid, answer: answer, updated: nowFull() });
      return ok({ answer: answer });
    },

    leaderboard: function (db, d) {
      var rd = requireReader(db, d);
      var cid = optCompId(db, d);
      demoLazySync(db);
      var lb = leaderboardOf(scopeOf(db, cid, true), dbSettings(db), rd.owner ? null : rd.player.id);
      if (rd.owner) lb.owner = true;
      return ok(lb);
    },

    stats: function (db, d) {
      var me = requirePlayer(db);
      return ok(statsOf(scopeOf(db, optCompId(db, d), true), dbSettings(db), me.id));
    },

    player_tips: function (db, d) {
      var rd = requireReader(db, d), me = rd.player, owner = rd.owner;
      var nick = typeof d.nickname === 'string' ? d.nickname.replace(/\s+/g, ' ').trim() : '';
      var p = nick && strLen(nick) <= 40 ? findPlayerByNick(db, nick) : null;
      if (!p || !p.active) fail('Spieler nicht gefunden.', 404);
      var s = dbSettings(db);
      var now = nowMin();
      var tips = [];
      db.tips.filter(function (t) { return t.player_id === p.id; }).forEach(function (t) {
        var m = findMatch(db, t.match_id);
        if (!m || (!owner && m.kickoff > now)) return;
        var o = matchBase(m);
        if (!o.locked && !owner) return;
        var sc = scoreTip({ home: t.home_goals, away: t.away_goals }, m, s);
        var row = { match_id: m.id };
        Object.keys(o).forEach(function (k) { if (k !== 'id') row[k] = o[k]; });
        row.tip = { home: t.home_goals, away: t.away_goals };
        row.points = sc ? sc.points : null;
        row.kind = sc ? sc.kind : null;
        tips.push(row);
      });
      tips.sort(function (a, b) { return cmpStr(b.kickoff, a.kickoff) || (b.match_id - a.match_id); });
      var fk = firstKickoffs(db);
      var bonus = [];
      compsSorted(db).forEach(function (c) {
        var b = db.bonus_tips.filter(function (x) { return x.player_id === p.id && x.competition_id === c.id; })[0];
        var bl = bonusLocked(c.id, fk);
        if (!b || (!bl && !owner)) return;
        var has = bonusNorm(c.bonus_answer) !== '';
        var row = { competition_id: c.id, competition: c.name, question: c.bonus_question, answer: b.answer, correct: has ? bonusNorm(b.answer) === bonusNorm(c.bonus_answer) : null };
        if (owner) row.locked = bl;
        bonus.push(row);
      });
      var out = { player: { nickname: p.nickname, is_me: !owner && p.id === me.id }, tips: tips, bonus: bonus };
      if (owner) out.owner = true;
      return ok(out);
    },

    change_password: function (db, d) {
      var me = requirePlayer(db);
      if (typeof d.old !== 'string' || me.pw !== demoHash(d.old)) fail('Das aktuelle Passwort ist falsch.', 400);
      var nw = vNewPassword(d['new'], 'Das neue Passwort');
      if (nw === d.old) fail('Das neue Passwort muss sich vom bisherigen unterscheiden.', 400);
      me.pw = demoHash(nw);
      db.session.stamp = stamp(me);
      return ok({});
    },

    delete_account: function (db, d) {
      var me = requirePlayer(db);
      if (typeof d.password !== 'string' || me.pw !== demoHash(d.password)) fail('Das Passwort ist falsch.', 400);
      removePlayer(db, me.id);
      db.session = null;
      return ok({});
    },

    /* ------------------------------------------------------------- Admin */

    admin_stats: function (db, d) {
      return ok(ownerStatsOf(scopeOf(db, optCompId(db, d), true), dbSettings(db)));
    },

    admin_match_tips: function (db, d) {
      var m = matchOr404(db, vId(d.match_id, 'Spiel'));
      var s = dbSettings(db);
      var o = matchBase(m);
      var c = findComp(db, m.competition_id);
      var active = {};
      db.players.forEach(function (p) { if (p.active) active[p.id] = p; });
      var rows = db.tips.filter(function (t) { return t.match_id === m.id && active[t.player_id]; });
      var tips = rows.map(function (t) {
        var sc = scoreTip({ home: t.home_goals, away: t.away_goals }, m, s);
        return { nickname: active[t.player_id].nickname, tip: { home: t.home_goals, away: t.away_goals }, points: sc ? sc.points : null, kind: sc ? sc.kind : null, updated: t.updated };
      });
      var pv = function (x) { return x.points === null ? -1 : x.points; };
      tips.sort(function (a, b) { return (pv(b) - pv(a)) || cmpStr(lower(a.nickname), lower(b.nickname)); });
      var tipped = {};
      rows.forEach(function (t) { tipped[t.player_id] = 1; });
      var missing = Object.keys(active).filter(function (id) { return !tipped[id]; }).map(function (id) { return active[id].nickname; })
        .sort(function (a, b) { return cmpStr(lower(a), lower(b)); });
      o.competition = c ? c.name : '';
      o.tip_count = tips.length;
      o.tendency = tendency(rows);
      return ok({ match: o, tips: tips, missing: missing });
    },

    admin_overview: function (db) {
      var fk = firstKickoffs(db);
      var mc = {}, tc = {}, ptc = {};
      db.matches.forEach(function (m) { mc[m.competition_id] = (mc[m.competition_id] || 0) + 1; });
      db.tips.forEach(function (t) { tc[t.match_id] = (tc[t.match_id] || 0) + 1; ptc[t.player_id] = (ptc[t.player_id] || 0) + 1; });
      var comps = compsSorted(db).map(function (c) {
        var o = compAdminOut(c, fk); o.created = c.created; o.match_count = mc[c.id] || 0; return o;
      });
      var matches = sortMatches(db.matches).map(function (m) { var o = matchBase(m); o.tip_count = tc[m.id] || 0; o.external_id = m.external_id || null; return o; });
      var sc = scopeOf(db, null, false);
      var t = tally(sc.players, sc.matches.filter(hasResult), sc.tips, sc.comps, sc.bonus, dbSettings(db));
      var players = db.players.slice().sort(function (a, b) { return cmpStr(lower(a.nickname), lower(b.nickname)); }).map(function (p) {
        return {
          id: p.id, nickname: p.nickname, email: p.email, active: !!p.active, created: p.created, last_login: p.last_login,
          invite_code: p.invite_code, tips: ptc[p.id] || 0, points: t[p.id] ? t[p.id].points : 0
        };
      });
      var invites = db.invites.slice().sort(function (a, b) { return cmpStr(b.created, a.created) || cmpStr(a.code, b.code); }).map(inviteOut);
      return ok({ competitions: comps, matches: matches, players: players, invites: invites, settings: dbSettings(db), serverTime: nowFull(), logos: demoLogoStats(db), features: clone(state.features) });
    },

    admin_competition_save: function (db, d) {
      var id = present(d, 'id') ? vId(d.id, 'ID') : null;
      var name = vStr(d.name, 1, 80, 'einen Namen');
      var active = d.active === undefined || d.active === null ? 1 : vBool(d.active, 'Aktiv');
      var sort = d.sort === undefined || d.sort === null || d.sort === '' ? 0 : vInt(d.sort, -9999, 9999, 'Reihenfolge');
      var bq = vOptStr(d.bonus_question, 150, 'Bonusfrage');
      var ba = vOptStr(d.bonus_answer, 80, 'Bonus-Antwort');
      var bp = d.bonus_points === undefined || d.bonus_points === null || d.bonus_points === '' ? 10 : vInt(d.bonus_points, 0, 100, 'Bonuspunkte');
      var old = id !== null ? compOr404(db, id) : null;
      var src = {
        source: old ? old.source || null : null, source_league: old ? (old.source_league == null ? null : old.source_league) : null,
        source_season: old ? (old.source_season == null ? null : old.source_season) : null, sync_window_days: old && old.sync_window_days != null ? old.sync_window_days : 14
      };
      if (Object.prototype.hasOwnProperty.call(d, 'source')) {
        var sv = d.source;
        var on = sv === 'openligadb' || sv === true;
        if (!on && [null, '', false, 0, '0', 'false', 'manual'].indexOf(sv) < 0) fail('Quelle: nur „openligadb“ oder leer (von Hand) möglich.', 400);
        if (on) {
          src.source_league = vLeague(d.source_league);
          src.source_season = vSeason(d.source_season);
        } else {
          src.source_league = typeof d.source_league === 'string' && LEAGUE_RE.test(d.source_league.trim()) ? d.source_league.trim() : null;
          src.source_season = (typeof d.source_season === 'number' || typeof d.source_season === 'string') && /^\d{4}$/.test(String(d.source_season).trim()) ? +String(d.source_season).trim() : null;
        }
        src.source = on ? 'openligadb' : null;
        src.sync_window_days = d.sync_window_days === undefined || d.sync_window_days === null || d.sync_window_days === '' ? 14 : vInt(d.sync_window_days, 1, SYNC_WINDOW_MAX, 'Zeitraum (Tage)');
      }
      // Preise: nur ändern, wenn mitgeschickt
      var pz = {};
      [['prize_1', 'Preis Platz 1'], ['prize_2', 'Preis Platz 2'], ['prize_3', 'Preis Platz 3'], ['prize_note', 'Hinweis zu den Preisen']].forEach(function (x) {
        pz[x[0]] = Object.prototype.hasOwnProperty.call(d, x[0]) ? vOptStr(d[x[0]], x[0] === 'prize_note' ? 200 : 80, x[1]) : (old && old[x[0]] != null ? old[x[0]] : null);
      });
      var c = old;
      if (!c) {
        c = { id: ++db.seq.competitions, created: nowFull(), last_sync: null, last_sync_status: null };
        db.competitions.push(c);
      }
      c.name = name; c.active = active; c.sort = sort; c.bonus_question = bq; c.bonus_answer = ba; c.bonus_points = bp;
      c.source = src.source; c.source_league = src.source_league; c.source_season = src.source_season; c.sync_window_days = src.sync_window_days;
      c.prize_1 = pz.prize_1; c.prize_2 = pz.prize_2; c.prize_3 = pz.prize_3; c.prize_note = pz.prize_note;
      return ok({ competition: compAdminOut(c, firstKickoffs(db)) });
    },

    admin_competition_delete: function (db, d) {
      var id = vId(d.id);
      compOr404(db, id);
      var mids = {};
      db.matches.forEach(function (m) { if (m.competition_id === id) mids[m.id] = 1; });
      db.tips = db.tips.filter(function (t) { return !mids[t.match_id]; });
      db.matches = db.matches.filter(function (m) { return m.competition_id !== id; });
      db.bonus_tips = db.bonus_tips.filter(function (b) { return b.competition_id !== id; });
      db.competitions = db.competitions.filter(function (c) { return c.id !== id; });
      return ok({});
    },

    admin_match_save: function (db, d) {
      var id = present(d, 'id') ? vId(d.id, 'ID') : null;
      var cid = vId(d.competition_id, 'Wettbewerb');
      compOr404(db, cid);
      var round = vStr(d.round, 0, 60, 'Runde');
      var kick = vKickoff(d.kickoff);
      var home = vStr(d.home, 1, 40, 'die Heimmannschaft');
      var away = vStr(d.away, 1, 40, 'die Gastmannschaft');
      if (lower(home) === lower(away)) fail('Heim- und Gastmannschaft müssen verschieden sein.', 400);
      var m;
      if (id !== null) {
        m = matchOr404(db, id);
        if (m.home_goals !== null && kick > nowMin()) fail('Das Spiel hat schon ein Ergebnis – der Anstoß kann nicht in die Zukunft verlegt werden. Bitte zuerst das Ergebnis löschen.', 409);
      } else {
        m = { id: ++db.seq.matches, home_goals: null, away_goals: null, external_id: null, external_group: null, result_source: null };
        db.matches.push(m);
      }
      m.competition_id = cid; m.round = round; m.kickoff = kick; m.home = home; m.away = away;
      return ok({ match: matchBase(m) });
    },

    admin_match_delete: function (db, d) {
      var id = vId(d.id);
      matchOr404(db, id);
      db.tips = db.tips.filter(function (t) { return t.match_id !== id; });
      db.matches = db.matches.filter(function (m) { return m.id !== id; });
      return ok({});
    },

    admin_match_import: function (db, d) {
      var cid = vId(d.competition_id, 'Wettbewerb');
      compOr404(db, cid);
      if (typeof d.text !== 'string') fail('Bitte die Spiele als Text einfügen.', 400);
      if (unescape(encodeURIComponent(d.text)).length > 100000) fail('Der Text ist zu lang (höchstens 100 000 Zeichen).', 400);
      var lines = d.text.split(/\r\n|\r|\n/);
      if (lines.length > 1000) fail('Zu viele Zeilen (höchstens 1000).', 400);
      var errors = [], rows = [], seen = {};
      db.matches.forEach(function (m) { if (m.competition_id === cid) seen[m.kickoff + '|' + lower(m.home) + '|' + lower(m.away)] = 1; });
      lines.forEach(function (line, i) {
        var no = i + 1;
        line = line.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F﻿]/g, '').trim();
        if (line === '' || line.charAt(0) === '#') return;
        var parts = line.split(/\s*[;\t]\s*/).map(function (x) { return x.trim(); });
        if (parts.length < 3 || parts.length > 4) { errors.push({ line: no, message: 'Erwartet: JJJJ-MM-TT HH:MM; Heim; Gast; Runde' }); return; }
        var kick = parseKickoff(parts[0]);
        var home = parts[1].replace(/\s+/g, ' '), away = parts[2].replace(/\s+/g, ' '), round = (parts[3] || '').replace(/\s+/g, ' ');
        var key = kick + '|' + lower(home) + '|' + lower(away);
        if (kick === null) errors.push({ line: no, message: 'Ungültiger Anstoß „' + Array.from(parts[0]).slice(0, 30).join('') + '“ (Format JJJJ-MM-TT HH:MM).' });
        else if (home === '' || away === '' || strLen(home) > 40 || strLen(away) > 40) errors.push({ line: no, message: 'Mannschaftsnamen fehlen oder sind zu lang (höchstens 40 Zeichen).' });
        else if (lower(home) === lower(away)) errors.push({ line: no, message: 'Heim- und Gastmannschaft sind gleich.' });
        else if (strLen(round) > 60) errors.push({ line: no, message: 'Runde ist zu lang (höchstens 60 Zeichen).' });
        else if (seen[key]) errors.push({ line: no, message: 'Dieses Spiel gibt es schon.' });
        else { seen[key] = 1; rows.push({ round: round, kickoff: kick, home: home, away: away }); }
      });
      rows.forEach(function (r) {
        db.matches.push({ id: ++db.seq.matches, competition_id: cid, round: r.round, kickoff: r.kickoff, home: r.home, away: r.away, home_goals: null, away_goals: null,
          external_id: null, external_group: null, result_source: null });
      });
      return ok({ imported: rows.length, errors: errors });
    },

    admin_result: function (db, d) {
      var id = vId(d.match_id, 'Spiel');
      var m = matchOr404(db, id);
      var hg = d.home_goals, ag = d.away_goals;
      if ((hg === null || hg === undefined || hg === '') && (ag === null || ag === undefined || ag === '')) {
        m.home_goals = null; m.away_goals = null; m.result_source = null; // ein automatischer Abruf darf es wieder eintragen
      } else {
        hg = vGoals(hg, 'Tore Heim');
        ag = vGoals(ag, 'Tore Gast');
        if (nowMin() < m.kickoff) fail('Das Spiel hat noch nicht begonnen – ein Ergebnis kann erst nach dem Anstoß eingetragen werden.', 409);
        m.home_goals = hg; m.away_goals = ag; m.result_source = 'manual';
      }
      return ok({ match: matchBase(m) });
    },

    admin_invite_create: function (db, d) {
      var note = vStr(d.note, 0, 100, 'Notiz');
      var max = vInt(d.max_uses === undefined || d.max_uses === null ? 1 : d.max_uses, 1, 1000, 'Anzahl Verwendungen');
      var exp = vExpires(d.expires);
      var code;
      do { code = randomString(INVITE_ALPHABET, 8); } while (db.invites.some(function (i) { return i.code === code; }));
      var inv = { code: code, note: note, max_uses: max, uses: 0, expires: exp, revoked: 0, created: nowFull() };
      db.invites.push(inv);
      return ok({ invite: inviteOut(inv) });
    },

    admin_invite_revoke: function (db, d) {
      var code = normCode(d.code);
      var inv = code ? db.invites.filter(function (i) { return i.code === code; })[0] : null;
      if (!inv) fail('Einladung nicht gefunden.', 404);
      inv.revoked = 1;
      return ok({});
    },

    admin_player_update: function (db, d) {
      var id = vId(d.id);
      var p = playerOr404(db, id);
      p.active = vBool(d.active, 'Aktiv');
      return ok({});
    },

    admin_player_reset: function (db, d) {
      var id = vId(d.id);
      var p = playerOr404(db, id);
      var temp = randomString(PW_ALPHABET, 10);
      p.pw = demoHash(temp);
      return ok({ temp_password: temp });
    },

    admin_player_delete: function (db, d) {
      var id = vId(d.id);
      playerOr404(db, id);
      removePlayer(db, id);
      return ok({});
    },

    /* ------------------------------------- Automatischer Abruf (im Demo-Modus simuliert) */

    admin_source_preview: function (db, d) {
      var league = vLeague(d.league);
      var season = vSeason(d.season);
      var key = league.toLowerCase();
      var P = DEMO_PREVIEWS[key];
      if (!P) fail('Demo: Vorschau nur für bl1, bl2, dfb, ucl, ffb1, wcl und dfbf – im echten Betrieb wird jedes Kürzel direkt bei OpenLigaDB geprüft.', 404);
      var base = naiveMs(berlinNow().slice(0, 10) + ' 00:00');
      var matches = P.next.map(function (x) { // [Tage ab heute, Minuten ab Mitternacht, Heim, Gast]
        return { kickoff: fmtNaive(base + x[0] * 24 * 3600000 + x[1] * 60000), home: x[2], away: x[3], round: P.round, result: null };
      });
      return ok({
        league: league, season: season, season_label: seasonLabel(season), league_name: P.name.replace('%S', season + '/' + (season + 1)),
        match_count: P.count, round_count: P.rounds, team_count: P.teams, finished: P.finished,
        first_kickoff: season + P.first, last_kickoff: (season + P.last[0]) + P.last[1],
        current_group: { name: P.current, order: P.order }, matches: matches.slice(0, 5), demo: true
      });
    },

    admin_sync: function (db, d) {
      var cid = vId(d.competition_id, 'Wettbewerb');
      var scope = d.scope === undefined || d.scope === null ? 'window' : d.scope;
      if (scope !== 'window' && scope !== 'season') fail('Umfang: „window“ oder „season“.', 400);
      var c = compOr404(db, cid);
      if (c.source !== 'openligadb') fail('Für diesen Wettbewerb ist kein automatischer Abruf eingerichtet.', 400);
      var r = demoSimulate(db, c, 0);
      var res = { inserted: 0, updated: 0, results: r.results, skipped_manual: r.skipped_manual, errors: [] };
      c.last_sync = nowFull();
      c.last_sync_status = demoStatusText(res, scope);
      res.last_sync = c.last_sync; res.last_sync_status = c.last_sync_status; res.message = DEMO_SYNC_MSG; res.demo = true;
      if (dbSettings(db).show_logos) res.logos = demoLogoRun();
      return ok(res);
    },

    admin_cron_info: function (db) { return ok(demoCronInfo(db)); },

    admin_cron_token_reset: function (db) {
      db.cron_token = randomString('0123456789abcdef', 48);
      return ok(demoCronInfo(db));
    },

    cron_sync: function (db, d) {
      if (!db.cron_token || typeof d.token !== 'string' || d.token !== db.cron_token) fail('Ungültiger Token.', 403);
      var out = [];
      compsSorted(db).filter(function (c) { return c.source === 'openligadb' && c.active; }).forEach(function (c) {
        var r = demoSimulate(db, c, 0);
        var res = { inserted: 0, updated: 0, results: r.results, skipped_manual: r.skipped_manual, errors: [] };
        c.last_sync = nowFull(); c.last_sync_status = demoStatusText(res, 'window');
        out.push({ id: c.id, name: c.name, ok: true, inserted: 0, updated: 0, results: r.results, skipped_manual: r.skipped_manual, errors: 0, status: c.last_sync_status });
      });
      var summary = out.length ? out.map(function (o) { return o.name + ': ' + o.status; }).join(' · ') : 'Kein aktiver Wettbewerb mit automatischem Abruf.';
      db.cron_last = { time: nowFull(), ok: true, status: summary };
      return ok({ time: db.cron_last.time, competitions: out, summary: summary, logos: dbSettings(db).show_logos ? demoLogoRun() : null, demo: true });
    },

    admin_settings_save: function (db, d) {
      var n = {
        points_exact: vInt(d.points_exact, 0, 50, 'Punkte exaktes Ergebnis'),
        points_diff: vInt(d.points_diff, 0, 50, 'Punkte Tordifferenz'),
        points_tendency: vInt(d.points_tendency, 0, 50, 'Punkte Tendenz')
      };
      if (!(n.points_exact >= n.points_diff && n.points_diff >= n.points_tendency)) fail('Bitte so wählen: exaktes Ergebnis ≥ Tordifferenz ≥ Tendenz.', 400);
      n.show_logos = dbSettings(db).show_logos;
      db.settings = n;
      state.settings = clone(n);
      return ok({ settings: dbSettings(db) });
    },

    admin_logos_save: function (db, d) {
      db.settings.show_logos = !!vBool(d.show_logos, 'Vereinslogos anzeigen');
      state.settings = dbSettings(db);
      return ok({ settings: dbSettings(db), message: DEMO_LOGO_MSG, demo: true });
    },

    admin_logos_refresh: function (db, d) {
      var mode = d.mode === undefined || d.mode === null ? 'failed' : d.mode;
      if (mode !== 'failed' && mode !== 'all' && mode !== 'continue') fail('Modus: „failed“, „all“ oder „continue“.', 400);
      var r = demoLogoRun();
      r.logos = demoLogoStats(db); r.message = DEMO_LOGO_MSG; r.demo = true;
      return ok(r);
    },

    /* ----------------------------------------------- Stammtischkasse (nur mit features.kasse) */

    kasse: function (db, d) {
      requireReader(db, d);
      if (!state.features.kasse) fail('Die Stammtischkasse ist ausgeschaltet.', 403, { featureOff: 'kasse' });
      return ok(kassePublic(db));
    },
    admin_kasse: function (db) { kasseOn(); return ok(kasseAdmin(db)); },
    admin_kasse_save: function (db, d) {
      kasseOn();
      var k = kasseDb(db);
      var id = present(d, 'id') ? vId(d.id, 'ID') : null;
      if (d.kind !== 'in' && d.kind !== 'out') fail('Art: bitte „Einzahlung“ oder „Ausgabe“ wählen.', 400);
      var cents = vInt(d.amount_cents, 1, KASSE_MAX_CENTS, 'Betrag (in Cent)');
      var day = vDay(d.day);
      var name = d.kind === 'in' ? vStr(d.name, 1, 60, 'einen Namen (wer hat eingezahlt?)') : '';
      var purpose = d.kind === 'out' ? vStr(d.purpose, 1, 80, 'einen Zweck (wofür?)') : '';
      var note = vStr(d.note, 0, 200, 'Notiz');
      var now = nowFull(), e;
      if (id !== null) {
        e = k.entries.filter(function (x) { return x.id === id; })[0];
        if (!e) fail('Buchung nicht gefunden.', 404);
      } else {
        e = { id: ++k.seq, created: now };
        k.entries.push(e);
      }
      e.kind = d.kind; e.amount_cents = cents; e.day = day; e.name = name; e.purpose = purpose; e.note = note; e.updated = now;
      var out = kasseAdmin(db);
      out.entry = kasseEntryOut(e);
      return ok(out);
    },
    admin_kasse_delete: function (db, d) {
      kasseOn();
      var k = kasseDb(db);
      var id = vId(d.id);
      if (!k.entries.some(function (x) { return x.id === id; })) fail('Buchung nicht gefunden.', 404);
      k.entries = k.entries.filter(function (x) { return x.id !== id; });
      return ok(kasseAdmin(db));
    },
    admin_kasse_settings: function (db, d) {
      kasseOn();
      var k = kasseDb(db);
      var purpose = vStr(d.purpose, 0, 120, 'Zweck der Kasse');
      var show = d.show_names === undefined || d.show_names === null ? 0 : vBool(d.show_names, 'Namen zeigen');
      k.purpose = purpose; k.show_names = !!show;
      return ok(kasseAdmin(db));
    }
  };

  /* --- Stammtischkasse (Demo): keine Verknüpfung zu Spielern, Tipps, Rangliste oder Preisen */
  function kasseOn() { if (!state.features.kasse) fail(KASSE_OFF_ADMIN, 403, { featureOff: 'kasse' }); }
  function kasseDb(db) {
    if (!db.kasse || !Array.isArray(db.kasse.entries)) db.kasse = { seq: 0, entries: [], purpose: '', show_names: false };
    return db.kasse;
  }
  function vDay(v) {
    v = typeof v === 'string' ? v.trim() : '';
    var m, y, mo, d;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else fail('Datum: bitte im Format JJJJ-MM-TT angeben (z. B. 2026-11-25).', 400);
    if (y < 2000 || y > 2100 || !checkDate(y, mo, d)) fail('Datum: das gibt es nicht – bitte prüfen.', 400);
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  function kasseEntryOut(e) {
    return { id: e.id, kind: e.kind, amount_cents: e.amount_cents, day: e.day, name: e.name || '', purpose: e.purpose || '', note: e.note || '', created: e.created, updated: e.updated };
  }
  function kasseAdmin(db) {
    var k = kasseDb(db);
    var entries = k.entries.slice().sort(function (a, b) { return cmpStr(b.day, a.day) || (b.id - a.id); }).map(kasseEntryOut);
    var inn = 0, out = 0;
    entries.forEach(function (e) { if (e.kind === 'in') inn += e.amount_cents; else out += e.amount_cents; });
    return { entries: entries, total_in_cents: inn, total_out_cents: out, balance_cents: inn - out, settings: { purpose: k.purpose || '', show_names: !!k.show_names } };
  }
  function kassePublic(db) {
    var a = kasseAdmin(db), names = null;
    if (a.settings.show_names) {
      var seen = {};
      names = [];
      a.entries.forEach(function (e) { if (e.kind === 'in' && e.name !== '' && !seen[lower(e.name)]) { seen[lower(e.name)] = 1; names.push(e.name); } });
      names.sort(function (x, y) { return cmpStr(lower(x), lower(y)); });
    }
    return { balance_cents: a.balance_cents, purpose: a.settings.purpose, names: names };
  }

  async function demoCall(action, data) {
    var fn = Object.prototype.hasOwnProperty.call(demoActions, action) ? demoActions[action] : null;
    if (!fn) fail('Unbekannte Aktion.', 400);
    if (NEEDS_ON[action] && !state.features.tippspiel) fail(OFF_MESSAGE, 403, { disabled: true });
    var db = demoLoad();
    var input = (data && typeof data === 'object') ? clone(data) : {};
    // Kopie bearbeiten: bei einem Fehler bleibt der gespeicherte Stand unverändert (wie eine Transaktion)
    var work = clone(db);
    var res;
    try {
      res = fn(work, input);
    } catch (e) {
      if (e && e.status === 401 && e.data && e.data.owner) state.admin = false;
      else if (e && e.status === 401) { demoDb.session = work.session; demoSave(); state.player = null; state.csrf = null; }
      throw e;
    }
    demoDb = work;
    demoSave();
    if (action === 'status' || action === 'login' || action === 'register') rememberStatus(res);
    if (action === 'logout' || action === 'delete_account') { state.player = null; state.csrf = null; }
    await new Promise(function (r) { setTimeout(r, 0); });
    return clone(res);
  }

  /* ================================================================ Öffentlich */

  var initPromise = null;

  async function init(options) {
    options = options || {};
    if (options.base) state.base = options.base;
    if (options.adminCsrf !== undefined) state.adminCsrf = options.adminCsrf || null;
    var forced = options.mode || options.force || null; // 'demo' | 'live' (optional)
    if (forced === 'demo') {
      state.mode = 'demo';
      await demoLoadFeatures();
      return demoCall('status', {});
    }
    var r = null;
    try {
      r = await liveFetch('status', {}, options.timeout || 8000);
    } catch (e) {
      r = null;
    }
    var j = r && r.json;
    if (j && typeof j === 'object' && j.api === 'hbs-tipp') {
      state.mode = 'live';
      if (!j.ok) {
        TippAPI.error = j.error || 'Das Tippspiel ist gerade nicht erreichbar.';
        throw ApiError(TippAPI.error, r.http || 500, j);
      }
      TippAPI.error = null;
      rememberStatus(j);
      return j;
    }
    if (forced === 'live') {
      state.mode = 'live';
      TippAPI.error = 'Das Tippspiel ist gerade nicht erreichbar.';
      throw ApiError(TippAPI.error, (r && r.http) || 0);
    }
    state.mode = 'demo';
    TippAPI.error = null;
    await demoLoadFeatures();
    return demoCall('status', {});
  }

  /**
   * Demo: Schalter wie die Website – zuerst die im Browser gespeicherten Demo-Inhalte der Verwaltung
   * (localStorage hbs_demo_content, wenn hbs_demo_mode = 1), sonst cms/content.json. Fehlt beides: Standard.
   */
  async function demoLoadFeatures() {
    if (state.featuresSet) return;
    try {
      if (global.localStorage && global.localStorage.getItem('hbs_demo_mode') === '1') {
        var c = JSON.parse(global.localStorage.getItem('hbs_demo_content') || 'null');
        if (c && typeof c === 'object') { state.features = normFeatures(c.features); return; }
      }
    } catch (e) { /* gesperrt/kaputt */ }
    if (typeof fetch !== 'function') return;
    try {
      var url = state.base.replace(/[^/]*$/, '') + 'content.json';
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 3000) : null;
      var r = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
      if (t) clearTimeout(t);
      if (r.ok) { var j = await r.json(); if (j && typeof j === 'object') state.features = normFeatures(j.features); }
    } catch (e) { /* kein Inhalt → Standard */ }
  }

  async function call(action, data) {
    if (typeof action !== 'string' || !/^[a-z_]{1,40}$/.test(action)) throw ApiError('Unbekannte Aktion.', 400);
    if (!state.mode) {
      if (!initPromise) initPromise = init({});
      try { await initPromise; } catch (e) { /* Fehler wird beim Aufruf erneut gemeldet */ }
    }
    return state.mode === 'demo' ? demoCall(action, data || {}) : liveCall(action, data || {});
  }

  var TippAPI = {
    version: '1.0',
    init: function (options) { initPromise = init(options); return initPromise; },
    call: call,
    demoReset: demoReset,
    scoreTip: scoreTip,
    setAdminCsrf: function (token) { state.adminCsrf = token || null; },
    /** Schalter vorgeben (Demo-Modus, z. B. aus der Verwaltung). Im Live-Modus entscheidet der Server (content.json). */
    setFeatures: function (f) { state.features = normFeatures(f); state.featuresSet = true; return clone(state.features); },
    demoSetOwner: demoSetOwner,
    error: null,
    /** reine Hilfsfunktionen (auch für Tests) */
    util: {
      tally: tally, rankRows: rankRows, tendency: tendency, leaderboard: leaderboardOf, stats: statsOf,
      ratio: ratio, bonusNorm: bonusNorm, berlinNow: berlinNow, parseKickoff: parseKickoff, ownerStats: ownerStatsOf
    }
  };
  Object.defineProperty(TippAPI, 'mode', { enumerable: true, get: function () { return state.mode; } });
  Object.defineProperty(TippAPI, 'player', { enumerable: true, get: function () { return state.player ? clone(state.player) : null; } });
  Object.defineProperty(TippAPI, 'csrf', { enumerable: true, get: function () { return state.csrf; } });
  Object.defineProperty(TippAPI, 'admin', { enumerable: true, get: function () { return !!state.admin; } });
  Object.defineProperty(TippAPI, 'settings', { enumerable: true, get: function () { return clone(state.settings); } });
  Object.defineProperty(TippAPI, 'features', { enumerable: true, get: function () { return clone(state.features); } });
  Object.defineProperty(TippAPI, 'base', { enumerable: true, get: function () { return state.base; } });

  global.TippAPI = TippAPI;
})(typeof window !== 'undefined' ? window : this);
