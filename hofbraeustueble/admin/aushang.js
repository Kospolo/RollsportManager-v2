/* Tippspiel-Aushang: Einladungscode aus ?code=… lesen, QR-Code erzeugen, Blatt auf den Bildschirm einpassen. */
(function () {
  'use strict';
  var code = (new URLSearchParams(location.search).get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var err = document.getElementById('error');
  if (!/^[A-Z0-9]{4,16}$/.test(code)) {
    err.textContent = 'Kein gültiger Einladungscode übergeben. Bitte im CMS unter Tippspiel → Einladungen bei der gewünschten Einladung auf „Aushang drucken“ tippen.';
    err.hidden = false;
    document.getElementById('stage').hidden = true;
    document.getElementById('print').disabled = true;
    return;
  }
  var url = new URL('../tippspiel/?code=' + encodeURIComponent(code), location.href).href;
  document.getElementById('code').textContent = code;
  document.getElementById('url').textContent = url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  document.title = 'Tippspiel-Aushang ' + code;

  if (typeof window.qrcode !== 'function') {
    err.textContent = 'Der QR-Code konnte nicht erzeugt werden (Datei fehlt). Bitte Seite neu laden.';
    err.hidden = false;
  } else {
    var q = window.qrcode(0, 'M');
    q.addData(url);
    q.make();
    document.getElementById('qr').innerHTML = q.createSvgTag({ cellSize: 10, margin: 2, scalable: true });
  }

  // Blatt (A4) auf die Fensterbreite verkleinern – nur am Bildschirm, beim Drucken 100 %
  var sheet = document.getElementById('sheet');
  var stage = document.getElementById('stage');
  function fit() {
    sheet.style.transform = '';
    stage.style.height = '';
    var avail = stage.clientWidth - 32;
    var w = sheet.offsetWidth;
    var s = Math.min(1, avail / w);
    sheet.style.transform = 'scale(' + s + ')';
    stage.style.height = (sheet.offsetHeight * s + 32) + 'px';
  }
  fit();
  window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  document.getElementById('print').addEventListener('click', function () { window.print(); });
})();
