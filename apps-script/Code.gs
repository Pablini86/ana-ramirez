/**
 * Panel de Ana — backend (Google Apps Script)
 *
 * Antes de usar, configura en Project Settings > Script Properties:
 *   GITHUB_TOKEN            token de GitHub con permiso de escritura en el repo
 *   GITHUB_OWNER            ej. "Pablini86"
 *   GITHUB_REPO             ej. "ana-ramirez"
 *   GITHUB_BRANCH           ej. "main"
 *   DRIVE_PENDING_FOLDER_ID ID de la carpeta de Drive para videos crudos pendientes
 *   ALLOWED_EMAILS          correos con acceso al panel, separados por coma
 *   SITE_BASE_URL           ej. "https://anaballesteros.site/" (para previsualizar videos/fotos)
 */

function normalizeBaseUrl_(url) {
  return String(url || '').trim().replace(/\/+$/, '') + '/';
}

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    token: p.getProperty('GITHUB_TOKEN'),
    owner: p.getProperty('GITHUB_OWNER'),
    repo: p.getProperty('GITHUB_REPO'),
    branch: p.getProperty('GITHUB_BRANCH') || 'main',
    pendingFolderId: p.getProperty('DRIVE_PENDING_FOLDER_ID'),
    siteBaseUrl: normalizeBaseUrl_(p.getProperty('SITE_BASE_URL') || 'https://anaballesteros.site/'),
    allowedEmails: (p.getProperty('ALLOWED_EMAILS') || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  };
}

function checkAccess_() {
  const cfg = getConfig_();
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || (cfg.allowedEmails.length && cfg.allowedEmails.indexOf(email) === -1)) {
    throw new Error('Sin acceso para ' + (email || 'esta cuenta') + '. Pide a Pablo que la agregue a ALLOWED_EMAILS.');
  }
  return email;
}

function doGet() {
  try {
    checkAccess_();
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui;max-width:420px;margin:80px auto;text-align:center;color:#211D18;">' +
      '<h2>Sin acceso</h2><p>' + err.message + '</p></div>'
    );
  }
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Panel de Ana')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSiteBaseUrl() {
  return getConfig_().siteBaseUrl;
}

/* ---------------- GitHub helpers ---------------- */

function ghHeaders_(cfg) {
  return {
    Authorization: 'Bearer ' + cfg.token,
    Accept: 'application/vnd.github+json',
  };
}

function ghGetFile_(cfg, path) {
  const url = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path + '?ref=' + cfg.branch;
  const res = UrlFetchApp.fetch(url, { headers: ghHeaders_(cfg), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('No se pudo leer ' + path + ' en GitHub: ' + res.getContentText());
  const json = JSON.parse(res.getContentText());
  return { sha: json.sha, base64: json.content.replace(/\n/g, '') };
}

function ghFileShaIfExists_(cfg, path) {
  try { return ghGetFile_(cfg, path).sha; } catch (e) { return null; }
}

function ghDispatchWorkflow_(cfg, workflowFile, ref, inputs) {
  const url = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/actions/workflows/' + workflowFile + '/dispatches';
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: ghHeaders_(cfg),
    payload: JSON.stringify({ ref: ref, inputs: inputs }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('No se pudo iniciar la publicación: ' + res.getContentText());
}

function ghPutFile_(cfg, path, base64Content, sha, message) {
  const url = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + path;
  const payload = { message: message, content: base64Content, branch: cfg.branch };
  if (sha) payload.sha = sha;
  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: ghHeaders_(cfg),
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('No se pudo guardar ' + path + ' en GitHub: ' + res.getContentText());
  return JSON.parse(res.getContentText());
}

function readSiteData_(cfg) {
  const f = ghGetFile_(cfg, 'data.json');
  const text = Utilities.newBlob(Utilities.base64Decode(f.base64)).getDataAsString('utf-8');
  return { data: JSON.parse(text), sha: f.sha };
}

function writeSiteData_(cfg, data, sha, message) {
  const b64 = Utilities.base64Encode(JSON.stringify(data, null, 2), Utilities.Charset.UTF_8);
  return ghPutFile_(cfg, 'data.json', b64, sha, message);
}

/* ---------------- API usada por el panel ---------------- */

function getPanelData() {
  checkAccess_();
  const cfg = getConfig_();
  const data = readSiteData_(cfg).data;
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function listForSection_(data, section) {
  return section === 'brands' ? data.brands : data.portfolio[section];
}

function mutateSection_(section, mutateFn, message) {
  const cfg = getConfig_();
  const { data, sha } = readSiteData_(cfg);
  const list = listForSection_(data, section);
  mutateFn(list, data);
  if (section === 'brands') data.brands = list; else data.portfolio[section] = list;
  writeSiteData_(cfg, data, sha, message);
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function setVisibility(section, id, visible) {
  checkAccess_();
  return mutateSection_(section, (list) => {
    const item = list.filter((x) => x.id === id)[0];
    if (item) item.visible = !!visible;
  }, 'Panel: mostrar/ocultar ' + id);
}

// direction: -1 sube, +1 baja
function moveItem(section, id, direction) {
  checkAccess_();
  return mutateSection_(section, (list) => {
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = list.findIndex((x) => x.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const tmp = list[idx].order;
    list[idx].order = list[swapIdx].order;
    list[swapIdx].order = tmp;
  }, 'Panel: reordenar ' + id);
}

function updateLabel(section, id, label) {
  checkAccess_();
  return mutateSection_(section, (list) => {
    const item = list.filter((x) => x.id === id)[0];
    if (item) { if (section === 'brands') item.name = label; else item.label = label; }
  }, 'Panel: editar etiqueta ' + id);
}

function deleteItem(section, id) {
  checkAccess_();
  return mutateSection_(section, (list) => {
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) list.splice(idx, 1);
  }, 'Panel: eliminar ' + id);
}

/* ---------------- Fotos (logos / fotos del sitio) — un solo llamado ---------------- */

function uploadSitePhoto(key, base64, ext) {
  checkAccess_();
  const cfg = getConfig_();
  const path = 'fotos/sitio-' + key + '.' + ext;
  ghPutFile_(cfg, path, base64, ghFileShaIfExists_(cfg, path), 'Panel: actualizar foto ' + key);
  const { data, sha } = readSiteData_(cfg);
  data.sitePhotos[key] = { src: path, alt: 'Ana Ballesteros' };
  writeSiteData_(cfg, data, sha, 'Panel: foto ' + key + ' actualizada');
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function addBrandLogo(name, base64, ext) {
  checkAccess_();
  const cfg = getConfig_();
  const id = slug_(name) + '-' + Date.now();
  const path = 'logos/' + id + '.' + ext;
  ghPutFile_(cfg, path, base64, null, 'Panel: nuevo logo ' + name);
  const { data, sha } = readSiteData_(cfg);
  const maxOrder = data.brands.reduce((m, b) => Math.max(m, b.order || 0), 0);
  data.brands.push({ id: id, src: path, name: name, visible: true, order: maxOrder + 1 });
  writeSiteData_(cfg, data, sha, 'Panel: agregar logo ' + name);
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function slug_(s) {
  return (s || 'item').toString().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

/* ---------------- Videos nuevos (subida en fragmentos vía Drive) ---------------- */

function startVideoUpload(section, label, filename) {
  checkAccess_();
  const cfg = getConfig_();
  if (!cfg.pendingFolderId) throw new Error('Falta configurar DRIVE_PENDING_FOLDER_ID en Script Properties.');
  return Utilities.getUuid();
}

function uploadVideoChunk(uploadId, index, base64Chunk) {
  checkAccess_();
  const cfg = getConfig_();
  const folder = DriveApp.getFolderById(cfg.pendingFolderId);
  const bytes = Utilities.base64Decode(base64Chunk);
  const name = '_chunk_' + uploadId + '_' + ('0000' + index).slice(-5);
  folder.createFile(Utilities.newBlob(bytes, 'application/octet-stream', name));
  return true;
}

function finalizeVideoUpload(uploadId, totalChunks, section, label, filename) {
  checkAccess_();
  const cfg = getConfig_();
  const folder = DriveApp.getFolderById(cfg.pendingFolderId);

  let allBytes = [];
  for (let i = 0; i < totalChunks; i++) {
    const name = '_chunk_' + uploadId + '_' + ('0000' + i).slice(-5);
    const files = folder.getFilesByName(name);
    if (!files.hasNext()) throw new Error('Falta el fragmento ' + i + ' — vuelve a intentar subir el video.');
    const f = files.next();
    allBytes = allBytes.concat(f.getBlob().getBytes());
    f.setTrashed(true);
  }

  const mime = guessMime_(filename);
  const finalFile = folder.createFile(Utilities.newBlob(allBytes, mime, uploadId + '_' + filename));

  const { data, sha } = readSiteData_(cfg);
  data.pending = data.pending || [];
  data.pending.push({
    id: uploadId,
    section: section,
    label: label,
    filename: filename,
    driveFileId: finalFile.getId(),
    status: 'procesando',
    uploadedAt: new Date().toISOString(),
  });
  writeSiteData_(cfg, data, sha, 'Panel: nuevo video pendiente — ' + label);
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function guessMime_(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'mp4') return 'video/mp4';
  return 'application/octet-stream';
}

function publishPendingVideo(uploadId) {
  checkAccess_();
  const cfg = getConfig_();
  const { data, sha } = readSiteData_(cfg);
  const item = (data.pending || []).find((x) => x.id === uploadId);
  if (!item) throw new Error('No se encontró ese video pendiente.');
  if (item.status === 'publicando') throw new Error('Ese video ya se está publicando.');

  try {
    DriveApp.getFileById(item.driveFileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // No bloquea la publicación: si la carpeta de pendientes ya está compartida como
    // "Cualquiera con el enlace", el archivo es accesible aunque no se pueda cambiar
    // su permiso individual (pasa cuando quien sube el video y quien publica son
    // cuentas distintas y no es la propietaria del archivo).
  }

  item.status = 'publicando';
  writeSiteData_(cfg, data, sha, 'Panel: publicando ' + item.label);

  ghDispatchWorkflow_(cfg, 'publicar-video.yml', cfg.branch, {
    upload_id: item.id,
    section: item.section,
    label: item.label,
    filename: item.filename,
    drive_file_id: item.driveFileId,
  });

  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function updateText(key, value) {
  checkAccess_();
  const cfg = getConfig_();
  const { data, sha } = readSiteData_(cfg);
  data.texts = data.texts || {};
  data.texts[key] = value;
  writeSiteData_(cfg, data, sha, 'Panel: editar texto ' + key);
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function resetPendingStatus(uploadId) {
  checkAccess_();
  const cfg = getConfig_();
  const { data, sha } = readSiteData_(cfg);
  const item = (data.pending || []).find((x) => x.id === uploadId);
  if (item) item.status = 'procesando';
  writeSiteData_(cfg, data, sha, 'Panel: reintentar publicar ' + uploadId);
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}

function cancelPendingUpload(uploadId) {
  checkAccess_();
  const cfg = getConfig_();
  const { data, sha } = readSiteData_(cfg);
  const idx = (data.pending || []).findIndex((x) => x.id === uploadId);
  if (idx < 0) { data.__siteBaseUrl = cfg.siteBaseUrl; return data; }
  const item = data.pending[idx];
  try { DriveApp.getFileById(item.driveFileId).setTrashed(true); } catch (e) { /* ya no existe */ }
  data.pending.splice(idx, 1);
  writeSiteData_(cfg, data, sha, 'Panel: cancelar pendiente ' + uploadId);
  data.__siteBaseUrl = cfg.siteBaseUrl;
  return data;
}
