/* Minimal .xlsx writer for "Export to Excel" (FR-9).
 *
 * No dependencies. Writes a real Office Open XML workbook with one sheet, packed
 * in an uncompressed (STORE) zip, so Excel opens it without a format warning.
 *
 *   var blob = buildXlsx('June 2026', rows);
 *   rows = [ [cell, cell, ...], ... ]
 *   cell = { v: 'text' } | { v: 1234.5, num: true } | add bold: true
 */
(function () {
  var CRC_TABLE = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(s) { return new TextEncoder().encode(s); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colName(i) {
    var s = '';
    i += 1;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  function sheetXml(rows) {
    var out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'];
    rows.forEach(function (row, r) {
      out.push('<row r="' + (r + 1) + '">');
      row.forEach(function (cell, c) {
        if (cell === null || cell === undefined) return;
        var ref = colName(c) + (r + 1);
        var style = (cell.num ? 2 : 0) + (cell.bold ? 1 : 0);
        var s = style ? ' s="' + style + '"' : '';
        if (cell.num) out.push('<c r="' + ref + '"' + s + '><v>' + cell.v + '</v></c>');
        else out.push('<c r="' + ref + '"' + s + ' t="inlineStr"><is><t>' + esc(cell.v) + '</t></is></c>');
      });
      out.push('</row>');
    });
    out.push('</sheetData></worksheet>');
    return out.join('');
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '</cellXfs></styleSheet>';

  function parts(sheetName, rows) {
    return [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="' + esc(sheetName.slice(0, 31)) + '" sheetId="1" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>'],
      ['xl/styles.xml', STYLES],
      ['xl/worksheets/sheet1.xml', sheetXml(rows)]
    ];
  }

  function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
  function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

  /* A fixed DOS timestamp (2026-06-16 09:00), so the same view exports the same bytes. */
  var DOS_TIME = (9 << 11);
  var DOS_DATE = ((2026 - 1980) << 9) | (6 << 5) | 16;

  function zip(files) {
    var chunks = [];
    var central = [];
    var offset = 0;
    files.forEach(function (f) {
      var name = utf8(f[0]);
      var data = utf8(f[1]);
      var crc = crc32(data);
      var local = [].concat([0x50, 0x4B, 0x03, 0x04], u16(20), u16(0x0800), u16(0),
        u16(DOS_TIME), u16(DOS_DATE), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0));
      chunks.push(new Uint8Array(local), name, data);
      central.push([].concat([0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0),
        u16(DOS_TIME), u16(DOS_DATE), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)), name);
      offset += local.length + name.length + data.length;
    });
    var cdStart = offset;
    var cdSize = 0;
    central.forEach(function (c, i) {
      if (i % 2 === 0) { chunks.push(new Uint8Array(c)); cdSize += c.length; }
      else { chunks.push(c); cdSize += c.length; }
    });
    var count = files.length;
    chunks.push(new Uint8Array([].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0),
      u16(count), u16(count), u32(cdSize), u32(cdStart), u16(0))));
    return new Blob(chunks, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  window.buildXlsx = function (sheetName, rows) {
    return zip(parts(sheetName, rows));
  };
})();
