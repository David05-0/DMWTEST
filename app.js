// ════════════════════════════════════════════════════════════
// FIREBASE — initialized in index.html via CDN, db exposed globally
// ════════════════════════════════════════════════════════════
// db, collection, doc, addDoc, updateDoc, onSnapshot,
// query, orderBy, serverTimestamp are all set in index.html

// ════════════════════════════════════════════════════════════
// STATIC DATA
// ════════════════════════════════════════════════════════════
const SUPPLIES = [
  { id:1,  name:'AIR FRESHENER',                                     unit:'can',    qty:40,  balance:null, note:'for utility use only' },
  { id:2,  name:'ALCOHOL, Ethyl, 500ml',                             unit:'bottle', qty:30,  balance:null, note:'' },
  { id:3,  name:'CLIP, Backfold, 50mm',                              unit:'box',    qty:10,  balance:8,    note:'' },
  { id:4,  name:'CLIP, Backfold, 25mm',                              unit:'box',    qty:5,   balance:null, note:'' },
  { id:5,  name:'CLIP, Backfold, 32mm',                              unit:'box',    qty:5,   balance:null, note:'' },
  { id:6,  name:'FURNITURE CLEANER',                                 unit:'can',    qty:40,  balance:null, note:'' },
  { id:7,  name:'HAND SANITIZER, 500mL',                             unit:'bottle', qty:40,  balance:null, note:'' },
  { id:8,  name:'HAND SOAP, LIQUID, 500ml',                          unit:'bottle', qty:5,   balance:null, note:'' },
  { id:9,  name:'MARKER, Permanent, Black',                          unit:'piece',  qty:12,  balance:null, note:'' },
  { id:10, name:'RECORD BOOK, 300 pages',                            unit:'book',   qty:5,   balance:2,    note:'' },
  { id:11, name:'TOILET TISSUE PAPER, 2 ply',                        unit:'pack',   qty:64,  balance:null, note:'' },
  { id:12, name:'DISINFECTANT SPRAY, aerosol, 400g (min)',           unit:'can',    qty:10,  balance:null, note:'' },
  { id:13, name:'STAPLE WIRE, heavy duty (binder type)',             unit:'box',    qty:10,  balance:null, note:'' },
  { id:14, name:'Sign Pen, Extra Fine tip, black',                   unit:'pc',     qty:48,  balance:43,   note:'' },
  { id:15, name:'Sign Pen, Extra Fine tip, blue',                    unit:'pc',     qty:48,  balance:43,   note:'' },
  { id:16, name:'Heavy-Duty Latex Rubber Gloves, large',             unit:'pair',   qty:15,  balance:null, note:'for utility use' },
  { id:17, name:'Empty Sacks, 50 kgs',                               unit:'pc',     qty:100, balance:null, note:'for records use' },
  { id:18, name:'PAPER, multicopy, A4, 80gsm',                       unit:'ream',   qty:60,  balance:50,   note:'' },
  { id:19, name:'BLEACH COLORSAFE, 1Liter',                          unit:'bottle', qty:10,  balance:null, note:'for utility use' },
  { id:20, name:'Dishwashing Sponge Scouring Pad with Foam',         unit:'pc',     qty:20,  balance:null, note:'' },
  { id:21, name:'Push Pins (Assorted Colors), 30pcs',                unit:'pack',   qty:10,  balance:null, note:'' },
  { id:22, name:'Expandable Folder, long',                           unit:'pc',     qty:100, balance:null, note:'issued to records' },
  { id:23, name:'Sign Here, stick on Notes Film Flag (25MM x 43MM)', unit:'pack',   qty:20,  balance:17,   note:'' },
  { id:24, name:'Ballpen, retractable, 0.5mm, black/blue',           unit:'piece',  qty:24,  balance:null, note:'' },
  { id:25, name:'BATTERY, dry cell, size AA, 2pc/pack',              unit:'pack',   qty:20,  balance:null, note:'' },
  { id:26, name:'BATTERY, dry cell, size AAA, 2pc/pack',             unit:'pack',   qty:20,  balance:null, note:'' },
  { id:27, name:'PAPER, multicopy, short, 80gsm',                    unit:'ream',   qty:10,  balance:null, note:'' },
  { id:28, name:'Certificate Holder, A4',                            unit:'piece',  qty:11,  balance:null, note:'' },
];
SUPPLIES.forEach(s => { s.available = s.balance !== null ? s.balance : s.qty; });

// ════════════════════════════════════════════════════════════
// APP STATE
// ════════════════════════════════════════════════════════════
let REQUESTS    = [];   // live mirror of Firestore
let currentUser = null;
let currentRole = null; // 'admin' | 'employee'
let unsubscribe = null; // Firestore real-time listener handle

const CREDENTIALS = {
  admin:    { user:'admin',    pass:'admin123', name:'Admin Officer',  role:'Administrator' },
  employee: { user:'employee', pass:'emp123',   name:'Jane Dela Cruz', role:'Employee'      },
};

// ════════════════════════════════════════════════════════════
// FIRESTORE REAL-TIME LISTENER
// ════════════════════════════════════════════════════════════
function startListener() {
  const q = db.collection('requests').orderBy('createdAt', 'asc');
  unsubscribe = q.onSnapshot(snapshot => {
    REQUESTS = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
    // Refresh whatever page is currently open
    const active = document.querySelector('.page.active');
    if (!active) return;
    const id = active.id;
    if (id === 'page-dashboard')   renderDashboard();
    if (id === 'page-requests')    renderRequests();
    if (id === 'page-my-requests') renderMyRequests();
    updatePendingBadge();
  }, err => {
    console.error('Firestore error:', err);
    showToast('⚠️ Database error. Check Firebase config or internet.');
  });
}

function stopListener() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

// ════════════════════════════════════════════════════════════
// LOGIN / LOGOUT
// ════════════════════════════════════════════════════════════
let selectedRole = 'admin';

function selectRole(r) {
  selectedRole = r;
  document.querySelectorAll('.role-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && r === 'admin') || (i === 1 && r === 'employee'));
  });
}

function doLogin() {
  const u    = document.getElementById('login-user').value.trim();
  const p    = document.getElementById('login-pass').value;
  const cred = CREDENTIALS[selectedRole];
  const err  = document.getElementById('login-error');
  if (u === cred.user && p === cred.pass) {
    err.style.display = 'none';
    currentUser = cred;
    currentRole = selectedRole;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    setupApp();
    startListener(); // 🔥 begin real-time sync
  } else {
    err.style.display = 'block';
  }
}
document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function doLogout() {
  stopListener();
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  currentUser = null;
  currentRole = null;
  REQUESTS    = [];
}

// ════════════════════════════════════════════════════════════
// APP SETUP & NAVIGATION
// ════════════════════════════════════════════════════════════
function setupApp() {
  document.getElementById('user-avatar').textContent     = currentUser.name[0];
  document.getElementById('user-name').textContent       = currentUser.name;
  document.getElementById('user-role-label').textContent = currentUser.role;

  const nav = document.getElementById('sidebar-nav');
  if (currentRole === 'admin') {
    nav.innerHTML = `
      <div class="nav-section-label">Management</div>
      <div class="nav-item active" onclick="navigate('page-dashboard')"><span class="icon">📊</span> Dashboard</div>
      <div class="nav-item" onclick="navigate('page-inventory')"><span class="icon">📦</span> Inventory</div>
      <div class="nav-item" onclick="navigate('page-requests')">
        <span class="icon">📋</span> All Requests
        <span class="nav-badge" id="pending-badge" style="display:none">0</span>
      </div>`;
  } else {
    nav.innerHTML = `
      <div class="nav-section-label">Requests</div>
      <div class="nav-item active" onclick="navigate('page-new-request')"><span class="icon">➕</span> New Request</div>
      <div class="nav-item" onclick="navigate('page-my-requests')"><span class="icon">📋</span> My Requests</div>
      <div class="nav-section-label">Reference</div>
      <div class="nav-item" onclick="navigate('page-inventory')"><span class="icon">📦</span> View Supplies</div>`;
  }
  navigate(currentRole === 'admin' ? 'page-dashboard' : 'page-new-request');
}

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.getAttribute('onclick')?.includes(pageId));
  });

  const titles = {
    'page-dashboard':   'Dashboard',
    'page-inventory':   'Supply Inventory',
    'page-requests':    'All RIS Requests',
    'page-new-request': 'New Requisition & Issue Slip',
    'page-my-requests': 'My Requests',
  };
  document.getElementById('page-title').textContent = titles[pageId] || '';
  document.getElementById('topbar-actions').innerHTML = '';

  if (pageId === 'page-dashboard')   renderDashboard();
  if (pageId === 'page-inventory')   renderInventory();
  if (pageId === 'page-requests')    renderRequests();
  if (pageId === 'page-my-requests') renderMyRequests();
  if (pageId === 'page-new-request') {
    resetRequestForm();
    document.getElementById('topbar-actions').innerHTML =
      `<span style="font-size:13px;color:var(--gray-400);">Form Appendix 63 — RIS</span>`;
  }
}

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════
function renderDashboard() {
  const pending    = REQUESTS.filter(r => r.status === 'Pending').length;
  const approved   = REQUESTS.filter(r => r.status === 'Approved').length;
  const issued     = REQUESTS.filter(r => r.status === 'Issued').length;
  const totalUnits = SUPPLIES.reduce((s, i) => s + i.available, 0);

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Supply Items</div>
      <div class="stat-value">${SUPPLIES.length}</div>
      <div class="stat-sub">${totalUnits} total units available</div>
    </div>
    <div class="stat-card teal">
      <div class="stat-label">Total Requests</div>
      <div class="stat-value">${REQUESTS.length}</div>
      <div class="stat-sub">All time submissions</div>
    </div>
    <div class="stat-card" style="border-left-color:#e8a020">
      <div class="stat-label">Pending</div>
      <div class="stat-value">${pending}</div>
      <div class="stat-sub">Awaiting action</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Approved / Issued</div>
      <div class="stat-value">${approved + issued}</div>
      <div class="stat-sub">Processed requests</div>
    </div>`;

  const recent = [...REQUESTS].reverse().slice(0, 5);
  const tb = document.getElementById('dash-recent-table');
  tb.innerHTML = !recent.length
    ? `<tr><td colspan="6"><div class="empty-state"><div class="icon">📭</div><p>No requests yet</p></div></td></tr>`
    : recent.map(r => `
        <tr>
          <td><strong>${r.risNo}</strong></td>
          <td>${r.name}</td>
          <td>${r.division}</td>
          <td>${r.date}</td>
          <td>${r.items.length} item(s)</td>
          <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>`).join('');
  updatePendingBadge();
}

function updatePendingBadge() {
  const b = document.getElementById('pending-badge');
  if (!b) return;
  const n = REQUESTS.filter(r => r.status === 'Pending').length;
  b.textContent   = n;
  b.style.display = n ? 'inline-block' : 'none';
}

// ════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════
let inventoryFilter = '';
function renderInventory() {
  const tb   = document.getElementById('inventory-table');
  const data = SUPPLIES.filter(s => s.name.toLowerCase().includes(inventoryFilter.toLowerCase()));
  tb.innerHTML = data.map(s => {
    const pct      = Math.round((s.available / s.qty) * 100);
    const cls      = pct < 30 ? 'low' : pct < 60 ? 'mid' : '';
    const noteHtml = s.note ? `<span class="badge badge-util">${s.note}</span>` : '—';
    return `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.unit}</td>
        <td>${s.qty}</td>
        <td>${s.balance !== null ? s.balance : '—'}</td>
        <td><strong>${s.available}</strong></td>
        <td>
          <div style="min-width:80px;">
            <div class="qty-bar"><div class="qty-fill ${cls}" style="width:${pct}%"></div></div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:2px">${pct}%</div>
          </div>
        </td>
        <td>${noteHtml}</td>
      </tr>`;
  }).join('');
}
function filterInventory(v) { inventoryFilter = v; renderInventory(); }

// ════════════════════════════════════════════════════════════
// ALL REQUESTS — Admin
// ════════════════════════════════════════════════════════════
let reqFilter = 'all';
function renderRequests() {
  const tb   = document.getElementById('requests-table');
  const data = reqFilter === 'all' ? REQUESTS : REQUESTS.filter(r => r.status === reqFilter);
  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">📭</div><p>No requests found</p></div></td></tr>`;
    return;
  }
  tb.innerHTML = [...data].reverse().map(r => `
    <tr>
      <td><strong>${r.risNo}</strong></td>
      <td>${r.name}</td>
      <td>${r.division}</td>
      <td>${r.office || ''}</td>
      <td>${r.date}</td>
      <td>${r.items.length} item(s)</td>
      <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="viewRIS('${r.risNo}',true)">View</button>
        ${r.status === 'Pending' ? `
          <button class="btn btn-success btn-sm" onclick="updateStatus('${r.risNo}','Approved')" style="margin-left:4px">✓</button>
          <button class="btn btn-danger btn-sm"  onclick="updateStatus('${r.risNo}','Rejected')" style="margin-left:4px">✕</button>` : ''}
        ${r.status === 'Approved' ? `
          <button class="btn btn-primary btn-sm" onclick="updateStatus('${r.risNo}','Issued')" style="margin-left:4px">Issue</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openPrintRIS('${r.risNo}')" style="margin-left:4px" title="Print RIS">🖨️</button>
      </td>
    </tr>`).join('');
  updatePendingBadge();
}
function filterRequests(v) { reqFilter = v; renderRequests(); }

async function updateStatus(risNo, status) {
  const req = REQUESTS.find(r => r.risNo === risNo);
  if (!req || !req._id) return;
  try {
    await db.collection('requests').doc(req._id).update({ status });
    showToast(`RIS ${risNo} marked as ${status}`);
    closeModal('modal-ris');
  } catch (e) {
    console.error(e);
    showToast('⚠️ Failed to update. Check your connection.');
  }
}

// ════════════════════════════════════════════════════════════
// MY REQUESTS — Employee
// ════════════════════════════════════════════════════════════
function renderMyRequests() {
  const mine = REQUESTS.filter(r => r.user === currentUser.name);
  const tb   = document.getElementById('my-requests-table');
  if (!mine.length) {
    tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">📭</div><p>You have no requests yet</p></div></td></tr>`;
    return;
  }
  tb.innerHTML = [...mine].reverse().map(r => `
    <tr>
      <td><strong>${r.risNo}</strong></td>
      <td>${r.date}</td>
      <td>${r.division}</td>
      <td>${r.items.length} item(s)</td>
      <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="viewRIS('${r.risNo}',false)">View</button></td>
    </tr>`).join('');
}

// ════════════════════════════════════════════════════════════
// VIEW RIS MODAL
// ════════════════════════════════════════════════════════════
function viewRIS(risNo, isAdmin) {
  const r = REQUESTS.find(x => x.risNo === risNo);
  if (!r) return;

  document.getElementById('modal-ris-title').textContent = `RIS — ${r.risNo}`;

  const itemsHtml = r.items.map(i => {
    const sup  = SUPPLIES.find(s => s.id === i.id);
    const ok   = i.qty <= (sup ? sup.available : 0);
    return `<tr>
      <td>${i.name}</td><td>${i.unit}</td>
      <td style="text-align:center">${i.qty}</td>
      <td><span class="badge ${ok ? 'badge-approved' : 'badge-rejected'}">${ok ? 'Available' : 'Check Stock'}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('modal-ris-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div><div class="ris-detail-label">Entity Name</div><div class="ris-detail-value">DMW RO-CAR</div></div>
      <div><div class="ris-detail-label">RIS No.</div><div class="ris-detail-value">${r.risNo}</div></div>
      <div><div class="ris-detail-label">Division</div><div class="ris-detail-value">${r.division}</div></div>
      <div><div class="ris-detail-label">Office</div><div class="ris-detail-value">${r.office || '—'}</div></div>
      <div><div class="ris-detail-label">Requestor</div><div class="ris-detail-value">${r.name}</div></div>
      <div><div class="ris-detail-label">Date Filed</div><div class="ris-detail-value">${r.date}</div></div>
      <div><div class="ris-detail-label">Purpose</div><div class="ris-detail-value">${r.purpose || '—'}</div></div>
      <div><div class="ris-detail-label">Status</div><div class="ris-detail-value"><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></div></div>
    </div>
    <h5 style="font-family:'Syne';font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px;">Requisitioned Items</h5>
    <div class="table-wrap" style="border:1px solid var(--gray-100);border-radius:8px;overflow:hidden;">
      <table>
        <thead><tr><th>Description</th><th>Unit</th><th>Qty Requested</th><th>Stock Status</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>`;

  const footer = document.getElementById('modal-ris-footer');
  if (isAdmin && r.status === 'Pending') {
    footer.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openPrintRIS('${r.risNo}')">🖨️ Preview RIS</button>
      <button class="btn btn-danger"  onclick="updateStatus('${r.risNo}','Rejected')">✕ Reject</button>
      <button class="btn btn-success" onclick="updateStatus('${r.risNo}','Approved')">✓ Approve</button>`;
  } else if (isAdmin && r.status === 'Approved') {
    footer.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openPrintRIS('${r.risNo}')">🖨️ Preview RIS</button>
      <button class="btn btn-primary" onclick="updateStatus('${r.risNo}','Issued')">Mark as Issued</button>`;
  } else if (isAdmin) {
    footer.innerHTML = `
      <button class="btn btn-outline" onclick="closeModal('modal-ris')">Close</button>
      <button class="btn btn-primary btn-sm" onclick="openPrintRIS('${r.risNo}')">🖨️ Print RIS</button>`;
  } else {
    footer.innerHTML = `<button class="btn btn-outline" onclick="closeModal('modal-ris')">Close</button>`;
  }

  document.getElementById('modal-ris').classList.add('open');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ════════════════════════════════════════════════════════════
// PRINT RIS — Official Appendix 63
// ════════════════════════════════════════════════════════════
let currentPrintRIS = null;

function buildRISFormHTML(r) {
  const BLANK_ROWS = 15;
  const rows = [...r.items];
  while (rows.length < BLANK_ROWS) rows.push(null);

  const supplyMap = {};
  SUPPLIES.forEach(s => { supplyMap[s.id] = s; });

  const rowsHtml = rows.map((item, idx) => {
    if (!item) return `<tr><td style="height:22px;">&nbsp;</td><td></td><td class="desc"></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    const sup      = supplyMap[item.id];
    const avail    = sup ? sup.available : 0;
    const stockYes = item.qty <= avail ? '✓' : '';
    const stockNo  = item.qty >  avail ? '✓' : '';
    const issued   = (r.status === 'Issued' || r.status === 'Approved') ? item.qty : '';
    return `<tr>
      <td style="height:22px;">${idx + 1}</td>
      <td>${item.unit}</td>
      <td class="desc">${item.name}</td>
      <td>${item.qty}</td>
      <td>${stockYes}</td>
      <td>${stockNo}</td>
      <td>${issued}</td>
      <td></td>
    </tr>`;
  }).join('');

  return `
  <div class="ris-form" id="ris-form-content">
    <div class="ris-top-notes">3 copies<br>1 for Accountant (RSMI)<br>1 for Requisitioning Unit<br>1 for Supply Officer</div>
    <div class="ris-appendix"><em>Appendix 63</em></div>
    <div class="ris-title">REQUISITION AND ISSUE SLIP</div>
    <div class="ris-header-row">
      <div>Entity Name : <strong>DMW RO-CAR</strong></div>
      <div>Fund Cluster : <span style="min-width:180px;display:inline-block;border-bottom:1px solid #000;">&nbsp;</span></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
      <div>Division : <span class="ris-sig-line" style="min-width:140px;">${r.division}</span></div>
      <div>Responsibility Center Code : <span class="ris-sig-line" style="min-width:140px;">&nbsp;</span></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <div>Office : <span class="ris-sig-line" style="min-width:160px;">${r.office || ''}</span></div>
      <div>RIS No. : <span class="ris-sig-line" style="min-width:140px;font-weight:bold;">${r.risNo}</span></div>
    </div>
    <table class="ris-main-table">
      <thead>
        <tr>
          <th colspan="4" class="group-header">Requisition</th>
          <th colspan="2" class="group-header">Stock Available?</th>
          <th colspan="2" class="group-header">Issue</th>
        </tr>
        <tr>
          <th class="subheader" style="width:36px;">Stock No.</th>
          <th class="subheader" style="width:52px;">Unit</th>
          <th class="subheader" style="min-width:180px;">Description</th>
          <th class="subheader" style="width:56px;">Quantity</th>
          <th class="subheader" style="width:36px;">Yes</th>
          <th class="subheader" style="width:36px;">No</th>
          <th class="subheader" style="width:56px;">Quantity</th>
          <th class="subheader" style="width:90px;">Remarks</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="ris-purpose-row">
      Purpose : <span class="ris-sig-line" style="min-width:500px;">${r.purpose || ''}</span>
    </div>
    <div style="border-bottom:1px solid #ccc;margin:4px 0;"></div>
    <table class="ris-sig-table">
      <thead>
        <tr>
          <th style="width:25%">Requested by:</th>
          <th style="width:25%">Approved by:</th>
          <th style="width:25%">Issued by:</th>
          <th style="width:25%">Received by:</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="height:36px;">Signature :</td>
          <td>Signature :</td>
          <td>Signature :</td>
          <td>Signature :</td>
        </tr>
        <tr>
          <td>Printed Name :<br><span class="sig-name">${r.name}</span></td>
          <td>Printed Name :<br><span class="sig-name">ANNA THERESA T. GAWIDAN</span></td>
          <td>Printed Name :<br><span class="sig-name">MARILOU S. BUGATAN</span></td>
          <td>Printed Name :<br>&nbsp;</td>
        </tr>
        <tr>
          <td class="sig-desig">Designation :</td>
          <td class="sig-desig">Chief AO, FAD</td>
          <td class="sig-desig">AO I, FAD</td>
          <td class="sig-desig">Designation :</td>
        </tr>
        <tr>
          <td>Date : <span class="ris-sig-line">${r.date}</span></td>
          <td>Date : <span class="ris-sig-line">${r.status === 'Approved' || r.status === 'Issued' ? r.date : ''}</span></td>
          <td>Date : <span class="ris-sig-line">${r.status === 'Issued' ? r.date : ''}</span></td>
          <td>Date : <span class="ris-sig-line"></span></td>
        </tr>
      </tbody>
    </table>
    <div class="ris-footer-note">RSMI / SO / RU</div>
  </div>`;
}

function openPrintRIS(risNo) {
  const r = REQUESTS.find(x => x.risNo === risNo);
  if (!r) return;
  currentPrintRIS = r;
  document.getElementById('modal-print-ris-body').innerHTML = buildRISFormHTML(r);
  document.getElementById('modal-print-ris').classList.add('open');
}

function printRIS() {
  if (!currentPrintRIS) return;
  document.getElementById('print-ris-area').innerHTML = buildRISFormHTML(currentPrintRIS);
  window.print();
}

// ════════════════════════════════════════════════════════════
// NEW REQUEST FLOW
// ════════════════════════════════════════════════════════════
let cart = {};

function resetRequestForm() {
  document.getElementById('req-step1').style.display = 'block';
  document.getElementById('req-step2').style.display = 'none';
  ['req-division','req-office','req-name','req-purpose'].forEach(id => {
    document.getElementById(id).value = '';
  });
  cart = {};
}

function goToStep2() {
  const div  = document.getElementById('req-division').value.trim();
  const name = document.getElementById('req-name').value.trim();
  if (!div || !name) { showToast('Please fill in Division and Requestor Name.'); return; }
  document.getElementById('req-step1').style.display = 'none';
  document.getElementById('req-step2').style.display = 'block';
  renderSupplyPicker();
  renderCart();
}

function backToStep1() {
  document.getElementById('req-step1').style.display = 'block';
  document.getElementById('req-step2').style.display = 'none';
}

let supplyFilter = '';
function renderSupplyPicker() {
  const grid = document.getElementById('supply-picker');
  const data = SUPPLIES.filter(s => s.name.toLowerCase().includes(supplyFilter.toLowerCase()));
  grid.innerHTML = data.map(s => {
    const inCart = cart[s.id];
    return `
      <div class="supply-item${inCart ? ' selected' : ''}${s.available === 0 ? ' out-of-stock' : ''}"
           onclick="toggleSupply(${s.id})" id="si-${s.id}">
        <div class="supply-added-check">✓</div>
        <div class="supply-name">${s.name}</div>
        <div class="supply-unit">${s.unit}${s.note ? `<span class="note-tag">${s.note}</span>` : ''}</div>
        <div class="supply-qty">${s.available} <span style="font-size:12px;font-weight:400;color:var(--gray-400)">avail.</span></div>
      </div>`;
  }).join('');
}
function filterSupplyPicker(v) { supplyFilter = v; renderSupplyPicker(); }

function toggleSupply(id) {
  const s = SUPPLIES.find(x => x.id === id);
  if (!s || s.available === 0) return;
  if (cart[id]) { delete cart[id]; }
  else { cart[id] = { id, name: s.name, unit: s.unit, qty: 1, max: s.available }; }
  renderSupplyPicker();
  renderCart();
}

function renderCart() {
  const el    = document.getElementById('cart-items');
  const items = Object.values(cart);
  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🛒</div><p>No items added</p></div>`;
    return;
  }
  el.innerHTML = items.map(i => `
    <div class="cart-row">
      <div style="flex:1">
        <div class="cart-name">${i.name}</div>
        <div class="cart-unit">${i.unit}</div>
      </div>
      <div class="cart-qty">
        <input type="number" min="1" max="${i.max}" value="${i.qty}" onchange="updateCartQty(${i.id},this.value)" />
      </div>
      <button class="cart-remove" onclick="removeFromCart(${i.id})">✕</button>
    </div>`).join('');
}

function updateCartQty(id, val) {
  if (!cart[id]) return;
  cart[id].qty = Math.max(1, Math.min(parseInt(val) || 1, cart[id].max));
}

function removeFromCart(id) {
  delete cart[id];
  renderSupplyPicker();
  renderCart();
}

async function submitRequest() {
  const items = Object.values(cart);
  if (!items.length) { showToast('Please add at least one item.'); return; }

  const count = REQUESTS.length + 1;
  const risNo = `RIS-2026-${String(count).padStart(4, '0')}`;
  const today = new Date().toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' });

  const req = {
    risNo,
    user:      currentUser.name,
    name:      document.getElementById('req-name').value.trim(),
    division:  document.getElementById('req-division').value.trim(),
    office:    document.getElementById('req-office').value.trim(),
    purpose:   document.getElementById('req-purpose').value.trim(),
    date:      today,
    items:     items.map(i => ({ id: i.id, name: i.name, unit: i.unit, qty: i.qty })),
    status:    'Pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const btn = document.querySelector('#req-step2 .btn-gold');
  if (btn) { btn.textContent = 'Submitting…'; btn.disabled = true; }

  try {
    await db.collection('requests').add(req);
    showToast(`✅ ${risNo} submitted successfully!`);
    resetRequestForm();
    navigate('page-my-requests');
  } catch (e) {
    console.error(e);
    showToast('⚠️ Submit failed. Check Firebase config or internet connection.');
  } finally {
    if (btn) { btn.textContent = 'Submit Request'; btn.disabled = false; }
  }
}

// ════════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

document.getElementById('modal-ris').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-ris');
});
document.getElementById('modal-print-ris').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-print-ris');
});
