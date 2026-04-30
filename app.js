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
SUPPLIES.forEach(s => { s.available = s.balance !== null ? s.balance : s.qty; s.unitCost = s.unitCost || 0; });

// ════════════════════════════════════════════════════════════
// APP STATE
// ════════════════════════════════════════════════════════════
let REQUESTS    = [];   // live mirror of Firestore
let currentUser = null;
let currentRole = null; // 'admin' | 'employee'
let unsubscribe = null; // Firestore real-time listener handle

// Admin credential is hardcoded (never stored in Firestore)
const ADMIN_CREDENTIAL = { user:'admin', pass:'admin123', name:'Admin Officer', role:'Administrator' };

// Employee accounts loaded from Firestore 'accounts' collection
let ACCOUNTS = []; // { _id, username, password, name, division, role:'Employee' }
let accountsUnsubscribe = null;



function startAccountsListener() {
  accountsUnsubscribe = db.collection('accounts').onSnapshot(snapshot => {
    ACCOUNTS = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
    const active = document.querySelector('.page.active');
    if (active && active.id === 'page-manage-accounts') renderManageAccounts();
  });
}

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
  const u   = document.getElementById('login-user').value.trim();
  const p   = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');

  if (selectedRole === 'admin') {
    // Admin: check hardcoded credential
    if (u === ADMIN_CREDENTIAL.user && p === ADMIN_CREDENTIAL.pass) {
      err.style.display = 'none';
      currentUser = ADMIN_CREDENTIAL;
      currentRole = 'admin';
      launchApp();
    } else {
      err.style.display = 'block';
    }
  } else {
    // Employee: check Firestore accounts (loaded at page load)
    const found = ACCOUNTS.find(a => a.username === u && a.password === p);
    if (found) {
      err.style.display = 'none';
      currentUser = { name: found.name, role: 'Employee', username: found.username, division: found.division || '' };
      currentRole = 'employee';
      launchApp();
    } else {
      // Fallback check — accounts may still be loading, query directly
      db.collection('accounts').where('username','==',u).where('password','==',p).get().then(snap => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          err.style.display = 'none';
          currentUser = { name: data.name, role: 'Employee', username: data.username, division: data.division || '' };
          currentRole = 'employee';
          launchApp();
        } else {
          err.style.display = 'block';
        }
      }).catch(() => { err.style.display = 'block'; });
    }
  }
}

function launchApp() {
  // Save session so page refresh restores login state
  sessionStorage.setItem('dmw_session', JSON.stringify({ user: currentUser, role: currentRole }));
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  setupApp();
  startListener();
  startSuppliesListener();
  startAccountsListener();
  startIARListener();
}

// Restore session on page refresh
(function restoreSession() {
  const saved = sessionStorage.getItem('dmw_session');
  if (!saved) return;
  try {
    const { user, role } = JSON.parse(saved);
    if (!user || !role) return;
    currentUser = user;
    currentRole = role;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    setupApp();
    startListener();
    startSuppliesListener();
    startAccountsListener();
  startIARListener();
  } catch(e) {
    sessionStorage.removeItem('dmw_session');
  }
})();
document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function doLogout() {
  document.getElementById('modal-logout-confirm').classList.add('open');
}

function confirmLogout() {
  closeModal('modal-logout-confirm');
  stopListener();
  if (suppliesUnsubscribe)  { suppliesUnsubscribe();  suppliesUnsubscribe  = null; }
  if (accountsUnsubscribe)  { accountsUnsubscribe();  accountsUnsubscribe  = null; }
  ACCOUNTS = [];
  sessionStorage.removeItem('dmw_session');
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
      </div>
      <div class="nav-item" onclick="navigate('page-manage-supplies')"><span class="icon">🛠️</span> Manage Supplies</div>
      <div class="nav-item" onclick="navigate('page-manage-accounts')"><span class="icon">👥</span> Manage Accounts</div>
      <div class="nav-section-label">Reports</div>
      <div class="nav-item" onclick="navigate('page-supply-ledger')"><span class="icon">📅</span> Supply Ledger</div>
      <div class="nav-item" onclick="navigate('page-iar')"><span class="icon">✅</span> Acceptance Reports</div>`;
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
    'page-dashboard':        'Dashboard',
    'page-inventory':        'Supply Inventory',
    'page-requests':         'All RIS Requests',
    'page-new-request':      'New Requisition & Issue Slip',
    'page-my-requests':      'My Requests',
    'page-manage-supplies':  'Manage Supplies',
    'page-manage-accounts':  'Manage Employee Accounts',
    'page-supply-ledger':    'Supply Ledger (Monthly)',
    'page-iar':              'Inspection & Acceptance Reports',
  };
  document.getElementById('page-title').textContent = titles[pageId] || '';
  document.getElementById('topbar-actions').innerHTML = '';

  if (pageId === 'page-dashboard')        renderDashboard();
  if (pageId === 'page-inventory')        renderInventory();
  if (pageId === 'page-requests')         renderRequests();
  if (pageId === 'page-my-requests')      renderMyRequests();
  if (pageId === 'page-manage-supplies')  renderManageSupplies();
  if (pageId === 'page-manage-accounts')  renderManageAccounts();
  if (pageId === 'page-supply-ledger')    renderSupplyLedger();
  if (pageId === 'page-iar')              renderIAR();
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
// MANAGE SUPPLIES — Admin CRUD
// ════════════════════════════════════════════════════════════
// SUPPLIES array is the live working list (starts from static data)
// Admin can add/edit/delete — changes persist in Firestore 'supplies' collection
// On startup, we merge Firestore supplies over the static defaults

let suppliesUnsubscribe = null;

function startSuppliesListener() {
  suppliesUnsubscribe = db.collection('supplies').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      const data = { ...change.doc.data(), _id: change.doc.id };
      const idx  = SUPPLIES.findIndex(s => s._id === data._id);
      if (change.type === 'added' || change.type === 'modified') {
        data.available = data.balance !== null && data.balance !== undefined ? data.balance : data.qty;
        if (idx >= 0) SUPPLIES[idx] = data;
        else SUPPLIES.push(data);
      }
      if (change.type === 'removed') {
        if (idx >= 0) SUPPLIES.splice(idx, 1);
      }
    });
    // Re-render if on relevant pages
    const active = document.querySelector('.page.active');
    if (!active) return;
    if (active.id === 'page-manage-supplies') renderManageSupplies();
    if (active.id === 'page-inventory')       renderInventory();
    if (active.id === 'page-new-request')     renderSupplyPicker();
  });
}

let manageSuppliesFilter = '';
function filterManageSupplies(v) { manageSuppliesFilter = v; renderManageSupplies(); }

function renderManageSupplies() {
  const tb   = document.getElementById('manage-supplies-table');
  const data = SUPPLIES.filter(s => s.name.toLowerCase().includes(manageSuppliesFilter.toLowerCase()));
  if (!data.length) {
    tb.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="icon">📦</div><p>No supplies found</p></div></td></tr>';
    return;
  }
  let rows = '';
  data.forEach(s => {
    const sid      = s._id || String(s.id || '');
    const bal      = (s.balance !== null && s.balance !== undefined) ? s.balance : '—';
    const noteHtml = s.note ? '<span class="badge badge-util">' + s.note + '</span>' : '—';
    rows += '<tr>'
      + '<td style="min-width:200px;font-weight:600;color:var(--text);">' + s.name + '</td>'
      + '<td>' + s.unit + '</td>'
      + '<td>' + s.qty + '</td>'
      + '<td>' + bal + '</td>'
      + '<td><strong>' + s.available + '</strong></td>'
      + '<td>' + noteHtml + '</td>'
      + '<td>'
      +   '<button class="btn btn-outline btn-sm" onclick="openSupplyModal(\'' + sid + '\')">&#9999;&#65039; Edit</button>'
      +   '<button class="btn btn-danger btn-sm" onclick="deleteSupplyPrompt(\'' + sid + '\')" style="margin-left:4px">&#128465;&#65039; Delete</button>'
      + '</td>'
      + '</tr>';
  });
  tb.innerHTML = rows;
}

// Store supply name separately for delete prompt
function deleteSupplyPrompt(id) {
  const s = SUPPLIES.find(x => (x._id || String(x.id || '')) === id);
  if (!s) return;
  deleteSupplyId = id;
  document.getElementById('delete-supply-name').textContent = s.name;
  document.getElementById('modal-confirm-delete').classList.add('open');
}

let editingSupplyId = null;

function openSupplyModal(supplyId) {
  editingSupplyId = supplyId || null;
  const modal = document.getElementById('modal-supply');
  document.getElementById('modal-supply-title').textContent = supplyId ? '✏️ Edit Supply' : '➕ Add New Supply';

  if (supplyId) {
    const s = SUPPLIES.find(x => (x._id || String(x.id || '')) === supplyId);
    if (!s) return;
    document.getElementById('supply-name').value      = s.name;
    document.getElementById('supply-unit').value      = s.unit;
    document.getElementById('supply-qty').value       = s.qty;
    document.getElementById('supply-balance').value   = s.balance !== null && s.balance !== undefined ? s.balance : '';
    document.getElementById('supply-unit-cost').value = s.unitCost || '';
    document.getElementById('supply-note').value      = s.note || '';
  } else {
    document.getElementById('supply-name').value      = '';
    document.getElementById('supply-unit').value      = '';
    document.getElementById('supply-qty').value       = '';
    document.getElementById('supply-balance').value   = '';
    document.getElementById('supply-unit-cost').value = '';
    document.getElementById('supply-note').value      = '';
  }
  modal.classList.add('open');
}

async function saveSupply() {
  const name    = document.getElementById('supply-name').value.trim();
  const unit    = document.getElementById('supply-unit').value.trim();
  const qty     = parseInt(document.getElementById('supply-qty').value) || 0;
  const balRaw  = document.getElementById('supply-balance').value.trim();
  const balance = balRaw !== '' ? parseInt(balRaw) : null;
  const note    = document.getElementById('supply-note').value.trim();

  if (!name || !unit) { showToast('Please fill in Name and Unit.'); return; }

  const unitCostRaw = document.getElementById('supply-unit-cost').value.trim();
  const unitCost    = unitCostRaw !== '' ? parseFloat(unitCostRaw) : 0;

  const data = {
    name, unit, qty,
    balance: balance,
    note,
    unitCost,
    available: balance !== null ? balance : qty,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const btn = document.querySelector('#modal-supply .btn-gold');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  try {
    if (editingSupplyId) {
      const existing = SUPPLIES.find(x => (x._id || String(x.id || '')) === editingSupplyId);
      if (existing && existing._id) {
        // Firestore supply — update in DB
        await db.collection('supplies').doc(existing._id).update(data);
      } else {
        // Static supply — save as new Firestore doc and update local array
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.id = existing ? existing.id : Date.now();
        const ref = await db.collection('supplies').add(data);
        // Update the local static entry with the new _id
        if (existing) {
          Object.assign(existing, data);
          existing._id = ref.id;
        }
        renderManageSupplies();
      }
      showToast('✅ Supply updated!');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.id = Date.now();
      await db.collection('supplies').add(data);
      showToast('✅ Supply added!');
    }
    closeModal('modal-supply');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to save. Check connection.');
  } finally {
    if (btn) { btn.textContent = 'Save Supply'; btn.disabled = false; }
  }
}

let deleteSupplyId = null;

async function confirmDeleteSupply() {
  if (!deleteSupplyId) return;
  try {
    // Only delete from Firestore if it has a Firestore _id
    const s = SUPPLIES.find(x => x._id === deleteSupplyId);
    if (s && s._id) {
      await db.collection('supplies').doc(s._id).delete();
    } else {
      // Static supply — just remove from local array
      const idx = SUPPLIES.findIndex(x => String(x.id) === String(deleteSupplyId));
      if (idx >= 0) SUPPLIES.splice(idx, 1);
      renderManageSupplies();
    }
    showToast('🗑️ Supply deleted.');
    closeModal('modal-confirm-delete');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to delete.');
  }
}

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
      <td>${r.designation || r.office || ''}</td>
      <td>${r.date}</td>
      <td>${r.items.length} item(s)</td>
      <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="viewRIS('${r.risNo}',true)">View</button>
        <button class="btn btn-outline btn-sm" onclick="openEditRIS('${r.risNo}')" style="margin-left:4px" title="Edit Items">✏️</button>
        ${r.status === 'Pending' ? `
          <button class="btn btn-success btn-sm" onclick="updateStatus('${r.risNo}','Approved')" style="margin-left:4px">✓</button>
          <button class="btn btn-danger btn-sm"  onclick="updateStatus('${r.risNo}','Rejected')" style="margin-left:4px">✕</button>` : ''}
        ${r.status === 'Approved' ? `
          <button class="btn btn-primary btn-sm" onclick="updateStatus('${r.risNo}','Issued')" style="margin-left:4px">Issue</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openPrintRIS('${r.risNo}')" style="margin-left:4px" title="Print RIS">🖨️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRequestPrompt('${r._id}','${r.risNo}')" style="margin-left:4px" title="Delete Request">🗑️</button>
      </td>
    </tr>`).join('');
  updatePendingBadge();
}
function filterRequests(v) { reqFilter = v; renderRequests(); }

// ════════════════════════════════════════════════════════════
// DELETE REQUEST — Admin
// ════════════════════════════════════════════════════════════
let deleteRequestId   = null;
let deleteRequestRisNo = null;

function deleteRequestPrompt(id, risNo) {
  deleteRequestId    = id;
  deleteRequestRisNo = risNo;
  document.getElementById('delete-request-risno').textContent = risNo;
  document.getElementById('modal-confirm-delete-request').classList.add('open');
}

async function confirmDeleteRequest() {
  if (!deleteRequestId) return;
  try {
    await db.collection('requests').doc(deleteRequestId).delete();
    showToast('🗑️ Request ' + deleteRequestRisNo + ' deleted.');
    closeModal('modal-confirm-delete-request');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to delete request.');
  }
}

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
      <div><div class="ris-detail-label">Designation</div><div class="ris-detail-value">${r.designation || r.office || '—'}</div></div>
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
      <div>Designation : <span class="ris-sig-line" style="min-width:160px;">${r.designation || r.office || ''}</span></div>
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
          <td class="sig-desig">Designation : <span style="font-weight:600;color:#000;">${r.designation || r.office || ''}</span></td>
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
// PRINT IAR
// ════════════════════════════════════════════════════════════
let currentPrintIAR = null;

function buildIARFormHTML(iar) {
  const TD  = 'border:1px solid #000;padding:4px 6px;';
  const UL  = 'border-bottom:1px solid #000;display:inline-block;min-width:';

  const itemRows = (iar.items || []).map((it, i) => {
    const cost  = it.unitCost > 0 ? Number(it.unitCost).toLocaleString('en-PH',{minimumFractionDigits:2}) : '';
    const total = it.unitCost > 0 ? (Number(it.qty) * Number(it.unitCost)).toLocaleString('en-PH',{minimumFractionDigits:2}) : '';
    return `<tr>
      <td style="${TD}text-align:center;vertical-align:middle;">${i+1}</td>
      <td style="${TD}vertical-align:middle;">${it.name}</td>
      <td style="${TD}text-align:center;vertical-align:middle;">${it.unit}</td>
      <td style="${TD}text-align:center;vertical-align:middle;">${it.qty}</td>
      <td style="${TD}text-align:right;vertical-align:middle;">${cost ? '&#8369;'+cost : ''}</td>
      <td style="${TD}text-align:right;vertical-align:middle;">${total ? '&#8369;'+total : ''}</td>
    </tr>`;
  }).join('');

  const totalQty  = (iar.items||[]).reduce((s,i)=>s+Number(i.qty||0),0);
  const totalCost = (iar.items||[]).reduce((s,i)=>s+(Number(i.qty||0)*Number(i.unitCost||0)),0)
                      .toLocaleString('en-PH',{minimumFractionDigits:2});

  return `<div id="iar-form-content" style="font-family:Arial,sans-serif;font-size:11px;color:#000;max-width:720px;margin:0 auto;padding:16px;">

    <!-- Header -->
    <div style="text-align:center;font-size:10px;line-height:1.5;">Republic of the Philippines</div>
    <div style="text-align:center;font-size:10px;line-height:1.5;margin-bottom:2px;">Department of Migrant Workers</div>
    <div style="text-align:center;font-weight:700;font-size:13px;letter-spacing:0.5px;margin-bottom:8px;">INSPECTION AND ACCEPTANCE REPORT</div>

    <!-- Meta fields — 4-column table: label | value | label | value -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;font-size:11px;">
      <colgroup>
        <col style="width:20%">
        <col style="width:35%">
        <col style="width:16%">
        <col style="width:29%">
      </colgroup>
      <tr>
        <td style="padding:2px 4px 2px 0;white-space:nowrap;">Entity Name:</td>
        <td style="padding:2px 4px;"><strong>DMW RO-CAR</strong></td>
        <td style="padding:2px 4px;white-space:nowrap;text-align:right;">Fund Cluster:</td>
        <td style="padding:2px 0 2px 4px;border-bottom:1px solid #000;">&nbsp;${iar.fund||''}</td>
      </tr>
      <tr>
        <td style="padding:2px 4px 2px 0;white-space:nowrap;">Supplier:</td>
        <td style="padding:2px 4px;border-bottom:1px solid #000;">&nbsp;${iar.supplier||''}</td>
        <td style="padding:2px 4px;white-space:nowrap;text-align:right;">IAR No.:</td>
        <td style="padding:2px 0 2px 4px;"><strong>${iar.iarNo||''}</strong></td>
      </tr>
      <tr>
        <td style="padding:2px 4px 2px 0;white-space:nowrap;">PO No./Date:</td>
        <td style="padding:2px 4px;border-bottom:1px solid #000;">&nbsp;${iar.poNo||''}</td>
        <td style="padding:2px 4px;white-space:nowrap;text-align:right;">Date:</td>
        <td style="padding:2px 0 2px 4px;border-bottom:1px solid #000;">&nbsp;${iar.date||''}</td>
      </tr>
      <tr>
        <td style="padding:2px 4px 2px 0;white-space:nowrap;">Requisitioning Office/Dept.:</td>
        <td style="padding:2px 4px;border-bottom:1px solid #000;">&nbsp;${iar.reqOffice||''}</td>
        <td style="padding:2px 4px;white-space:nowrap;text-align:right;">Invoice No.:</td>
        <td style="padding:2px 0 2px 4px;border-bottom:1px solid #000;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:2px 4px 2px 0;white-space:nowrap;">Responsibility Center Code:</td>
        <td style="padding:2px 4px;border-bottom:1px solid #000;">&nbsp;</td>
        <td style="padding:2px 4px;white-space:nowrap;text-align:right;">Date:</td>
        <td style="padding:2px 0 2px 4px;border-bottom:1px solid #000;">&nbsp;</td>
      </tr>
    </table>

    <!-- Items table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
      <thead>
        <tr style="background:#efefef;">
          <th style="${TD}width:36px;text-align:center;vertical-align:middle;font-size:10px;">STOCK/<br>PROP<br>NO.</th>
          <th style="${TD}text-align:center;vertical-align:middle;">DESCRIPTION</th>
          <th style="${TD}width:52px;text-align:center;vertical-align:middle;">UNIT</th>
          <th style="${TD}width:58px;text-align:center;vertical-align:middle;">QUANTITY</th>
          <th style="${TD}width:82px;text-align:center;vertical-align:middle;">UNIT COST</th>
          <th style="${TD}width:92px;text-align:center;vertical-align:middle;">TOTAL COST</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tr>
        <td colspan="3" style="${TD}text-align:right;font-weight:700;">TOTAL</td>
        <td style="${TD}text-align:center;font-weight:700;">${totalQty}</td>
        <td style="${TD}"></td>
        <td style="${TD}text-align:right;font-weight:700;">&#8369;${totalCost}</td>
      </tr>
    </table>

    <!-- Inspection / Acceptance -->
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="${TD}width:50%;vertical-align:top;padding:0;border-top:none;">
          <table style="width:100%;height:130px;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 8px 0;vertical-align:top;">
                <div style="font-weight:700;text-align:center;margin-bottom:5px;">INSPECTION</div>
                <div style="margin-bottom:4px;">Date Inspected:&nbsp;<span style="${UL}110px;">&nbsp;${iar.date||''}&nbsp;</span></div>
                <div style="line-height:1.5;">Inspected, verified and found in order as to quantity and specifications.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 8px 6px;vertical-align:bottom;">
                <div style="border-top:1px solid #000;text-align:center;padding-top:3px;font-weight:700;font-size:11px;">NAME OF EMPLOYEE</div>
                <div style="text-align:center;font-size:10px;">Inspection Committee</div>
              </td>
            </tr>
          </table>
        </td>
        <td style="${TD}width:50%;vertical-align:top;padding:0;border-top:none;border-left:none;">
          <table style="width:100%;height:130px;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 8px 0;vertical-align:top;">
                <div style="font-weight:700;text-align:center;margin-bottom:5px;">ACCEPTANCE</div>
                <div style="margin-bottom:4px;">Date Received:&nbsp;<span style="${UL}110px;">&nbsp;${iar.date||''}&nbsp;</span></div>
                <div>&#9633; Complete &nbsp;&nbsp;&nbsp; &#9633; Partial (pls. specify quantity)</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 8px 6px;vertical-align:bottom;">
                <div style="border-top:1px solid #000;text-align:center;padding-top:3px;font-weight:700;font-size:11px;">MARILOU S. BUGATAN</div>
                <div style="text-align:center;font-size:10px;">AO I (Supply Officer I)</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="font-size:10px;text-align:right;margin-top:4px;padding-right:2px;">DV / JEV / SO / IC</div>
  </div>`;
}

function openPrintIAR(iarId) {
  const iar = IARS.find(x => x._id === iarId);
  if (!iar) return;
  currentPrintIAR = iar;
  document.getElementById('modal-print-ris-body').innerHTML = buildIARFormHTML(iar);
  document.getElementById('modal-print-ris').querySelector('h3').textContent = 'Print IAR - ' + iar.iarNo;
  // Swap print button to use printIAR
  const footer = document.getElementById('modal-print-ris').querySelector('.modal-footer');
  footer.innerHTML = '<button class="btn btn-outline" onclick="closeModal(\'modal-print-ris\')">Close</button>'
    + '<button class="btn btn-primary" onclick="printIAR()">Print IAR</button>';
  document.getElementById('modal-print-ris').classList.add('open');
}

function printIAR() {
  if (!currentPrintIAR) return;
  document.getElementById('print-ris-area').innerHTML = buildIARFormHTML(currentPrintIAR);
  window.print();
}

// ════════════════════════════════════════════════════════════
// NEW REQUEST FLOW
// ════════════════════════════════════════════════════════════
let cart = {};

function resetRequestForm() {
  document.getElementById('req-step1').style.display = 'block';
  document.getElementById('req-step2').style.display = 'none';
  ['req-division','req-designation','req-name','req-purpose'].forEach(id => {
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
    designation: document.getElementById('req-designation').value.trim(),
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
// MANAGE ACCOUNTS — Admin CRUD
// ════════════════════════════════════════════════════════════
function renderManageAccounts() {
  const tb = document.getElementById('manage-accounts-table');
  if (!ACCOUNTS.length) {
    tb.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👥</div><p>No employee accounts yet. Click "Add Account" to create one.</p></div></td></tr>`;
    return;
  }
  tb.innerHTML = ACCOUNTS.map(a => `
    <tr>
      <td><strong>${a.name}</strong></td>
      <td>${a.username}</td>
      <td>${a.division || '—'}</td>
      <td><span class="badge badge-issued">Employee</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openAccountModal('${a._id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAccountPrompt('${a._id}','${a.name.replace(/'/g,"\'")}') " style="margin-left:4px">🗑️ Delete</button>
      </td>
    </tr>`).join('');
}

let editingAccountId = null;

function openAccountModal(accountId) {
  editingAccountId = accountId || null;
  document.getElementById('modal-account-title').textContent = accountId ? '✏️ Edit Account' : '➕ Add Employee Account';
  if (accountId) {
    const a = ACCOUNTS.find(x => x._id === accountId);
    if (!a) return;
    document.getElementById('acct-name').value     = a.name;
    document.getElementById('acct-username').value = a.username;
    document.getElementById('acct-password').value = a.password;
    document.getElementById('acct-division').value = a.division || '';
  } else {
    document.getElementById('acct-name').value     = '';
    document.getElementById('acct-username').value = '';
    document.getElementById('acct-password').value = '';
    document.getElementById('acct-division').value = '';
  }
  document.getElementById('modal-account').classList.add('open');
}

async function saveAccount() {
  const name     = document.getElementById('acct-name').value.trim();
  const username = document.getElementById('acct-username').value.trim();
  const password = document.getElementById('acct-password').value.trim();
  const division = document.getElementById('acct-division').value.trim();

  if (!name || !username || !password) {
    showToast('Please fill in Name, Username, and Password.');
    return;
  }

  // Check duplicate username (skip self when editing)
  const duplicate = ACCOUNTS.find(a => a.username === username && a._id !== editingAccountId);
  if (duplicate) { showToast('⚠️ Username already exists. Choose another.'); return; }

  const data = { name, username, password, division, role: 'Employee' };
  const btn  = document.querySelector('#modal-account .btn-gold');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  try {
    if (editingAccountId) {
      await db.collection('accounts').doc(editingAccountId).update(data);
      showToast('✅ Account updated!');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('accounts').add(data);
      showToast('✅ Account created!');
    }
    closeModal('modal-account');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to save account. Check connection.');
  } finally {
    if (btn) { btn.textContent = 'Save Account'; btn.disabled = false; }
  }
}

let deleteAccountId = null;
function deleteAccountPrompt(id, name) {
  deleteAccountId = id;
  document.getElementById('delete-account-name').textContent = name;
  document.getElementById('modal-confirm-delete-account').classList.add('open');
}

async function confirmDeleteAccount() {
  if (!deleteAccountId) return;
  try {
    await db.collection('accounts').doc(deleteAccountId).delete();
    showToast('🗑️ Account deleted.');
    closeModal('modal-confirm-delete-account');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to delete account.');
  }
}


// ════════════════════════════════════════════════════════════
// SUPPLY LEDGER — Monthly balance tracking
// ════════════════════════════════════════════════════════════
function renderSupplyLedger() {
  const wrap = document.getElementById('supply-ledger-wrap');
  if (!wrap) return;

  // Build monthly totals from Issued requests
  const issued = REQUESTS.filter(r => r.status === 'Issued');
  const months = {};
  issued.forEach(r => {
    const d = new Date(r.date || r.createdAt?.toDate?.() || Date.now());
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const label = d.toLocaleString('en-PH',{month:'long', year:'numeric'});
    if (!months[key]) months[key] = { label, items: {} };
    (r.items || []).forEach(it => {
      if (!months[key].items[it.name]) months[key].items[it.name] = { unit: it.unit, qty: 0 };
      months[key].items[it.name].qty += Number(it.qty) || 0;
    });
  });

  const sortedKeys = Object.keys(months).sort();
  if (!sortedKeys.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="icon">📅</div><p>No issued requests yet. Issued requests will appear here as monthly totals.</p></div>';
    return;
  }

  wrap.innerHTML = sortedKeys.map(key => {
    const m = months[key];
    const rows = Object.entries(m.items).map(([name, v]) =>
      '<tr><td>' + name + '</td><td>' + v.unit + '</td><td><strong>' + v.qty + '</strong></td></tr>'
    ).join('');
    return '<div class="card" style="margin-bottom:20px;">'
      + '<div class="card-header"><h4>📅 ' + m.label + '</h4>'
      + '<span style="font-size:12px;color:var(--gray-400);">' + Object.keys(m.items).length + ' supply types issued</span></div>'
      + '<div class="card-body" style="overflow-x:auto;">'
      + '<table style="width:100%;"><thead><tr><th>Supply Description</th><th>Unit</th><th>Total Qty Issued</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table></div></div>';
  }).join('');
}

// ════════════════════════════════════════════════════════════
// EDIT RIS ITEMS — Admin edits employee requisitioned supplies
// ════════════════════════════════════════════════════════════
let editingRISNo = null;
let editRISItems = [];

function openEditRIS(risNo) {
  const r = REQUESTS.find(x => x.risNo === risNo);
  if (!r) return;
  editingRISNo = risNo;
  editRISItems = r.items.map(i => ({ ...i }));

  document.getElementById('edit-ris-title').textContent = 'Edit Items — ' + risNo;
  renderEditRISItems();
  document.getElementById('modal-edit-ris').classList.add('open');
}

function renderEditRISItems() {
  const wrap = document.getElementById('edit-ris-items');
  if (!editRISItems.length) {
    wrap.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:20px;">No items</p>';
    return;
  }
  wrap.innerHTML = editRISItems.map((it, idx) => {
    const opts = SUPPLIES.map(s =>
      '<option value="' + s.name + '" ' + (s.name === it.name ? 'selected' : '') + '>' + s.name + '</option>'
    ).join('');
    return '<div style="display:grid;grid-template-columns:1fr 80px 80px 36px;gap:8px;align-items:center;margin-bottom:8px;">'
      + '<select onchange="editRISItemField(' + idx + ',\'name\',this.value)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:\'DM Sans\';">' + opts + '</select>'
      + '<input type="text" value="' + it.unit + '" onchange="editRISItemField(' + idx + ',\'unit\',this.value)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:center;" />'
      + '<input type="number" value="' + it.qty + '" min="1" onchange="editRISItemField(' + idx + ',\'qty\',parseInt(this.value)||1)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:center;" />'
      + '<button onclick="removeEditRISItem(' + idx + ')" style="background:var(--red);color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;height:36px;width:36px;">&#10005;</button>'
      + '</div>';
  }).join('');
}

function editRISItemField(idx, field, value) {
  editRISItems[idx][field] = value;
  if (field === 'name') {
    const s = SUPPLIES.find(x => x.name === value);
    if (s) editRISItems[idx].unit = s.unit;
    renderEditRISItems();
  }
}

function addEditRISItem() {
  const s = SUPPLIES[0];
  editRISItems.push({ id: s.id || s._id, name: s.name, unit: s.unit, qty: 1 });
  renderEditRISItems();
}

function removeEditRISItem(idx) {
  editRISItems.splice(idx, 1);
  renderEditRISItems();
}

async function saveEditRIS() {
  if (!editingRISNo || !editRISItems.length) { showToast('Add at least one item.'); return; }
  const btn = document.querySelector('#modal-edit-ris .btn-gold');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    const snap = await db.collection('requests').where('risNo','==',editingRISNo).get();
    if (snap.empty) { showToast('Request not found.'); return; }
    await snap.docs[0].ref.update({ items: editRISItems });
    showToast('✅ Items updated!');
    closeModal('modal-edit-ris');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to save.');
  } finally {
    if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false; }
  }
}

// ════════════════════════════════════════════════════════════
// IAR — Inspection & Acceptance Report
// ════════════════════════════════════════════════════════════
let IARS = [];
function startIARListener() {
  db.collection('iars').orderBy('createdAt','asc').onSnapshot(snap => {
    IARS = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    const active = document.querySelector('.page.active');
    if (active && active.id === 'page-iar') renderIAR();
  }, err => {
    console.error('IAR listener error:', err);
    showToast('⚠️ Could not load Acceptance Reports. Check connection.');
  });
}

function renderIAR() {
  const tb = document.getElementById('iar-table');
  if (!tb) return;
  if (!IARS.length) {
    tb.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="icon">📋</div><p>No acceptance reports yet. Click "+ New IAR" to create one.</p></div></td></tr>';
    return;
  }
  tb.innerHTML = [...IARS].reverse().map(iar => {
    const statusBadge = iar.accepted
      ? '<span class="badge badge-issued">Accepted</span>'
      : '<span class="badge badge-pending">Pending</span>';
    const total = (iar.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
    return '<tr>'
      + '<td><strong>' + iar.iarNo + '</strong></td>'
      + '<td>' + (iar.supplier || '—') + '</td>'
      + '<td>' + (iar.poNo || '—') + '</td>'
      + '<td>' + (iar.date || '—') + '</td>'
      + '<td>' + total + ' item(s)</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td>'
      + '<button class="btn btn-outline btn-sm" onclick="viewIAR(\'' + iar._id + '\')">View</button>'
      + '<button class="btn btn-outline btn-sm" onclick="openEditIARModal(\'' + iar._id + '\')" style="margin-left:4px" title="Edit IAR">✏️</button>'
      + '<button class="btn btn-outline btn-sm" onclick="openPrintIAR(\'' + iar._id + '\')" style="margin-left:4px" title="Print IAR">&#128424;&#65039;</button>'
      + (!iar.accepted ? '<button class="btn btn-success btn-sm" onclick="acceptIAR(\'' + iar._id + '\')" style="margin-left:4px">Accept &amp; Add to Stock</button>' : '')
      + '<button class="btn btn-danger btn-sm" onclick="deleteIARPrompt(\'' + iar._id + '\',\'' + iar.iarNo + '\')" style="margin-left:4px" title="Delete IAR">🗑️</button>'
      + '</td>'
      + '</tr>';
  }).join('');
}

function openIARModal() {
  document.getElementById('iar-no').value  = 'IAR-' + Date.now().toString().slice(-6);
  document.getElementById('iar-supplier').value = '';
  document.getElementById('iar-po').value  = '';
  document.getElementById('iar-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('iar-fund').value = '';
  document.getElementById('iar-req-office').value = '';
  iarItems = [{ name: SUPPLIES[0].name, unit: SUPPLIES[0].unit, qty: 1, unitCost: 0 }];
  renderIARItems();
  document.getElementById('modal-iar').classList.add('open');
}

let iarItems = [];
function renderIARItems() {
  const wrap = document.getElementById('iar-items-wrap');
  wrap.innerHTML = iarItems.map((it, idx) => {
    const opts = SUPPLIES.map(s =>
      '<option value="' + s.name + '" ' + (s.name === it.name ? 'selected' : '') + '>' + s.name + '</option>'
    ).join('');
    return '<div style="display:grid;grid-template-columns:1fr 80px 80px 110px 36px;gap:8px;align-items:center;margin-bottom:8px;">'
      + '<select onchange="iarItemField(' + idx + ',\'name\',this.value)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:\'DM Sans\';">' + opts + '</select>'
      + '<input type="text" value="' + it.unit + '" placeholder="Unit" onchange="iarItemField(' + idx + ',\'unit\',this.value)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:center;" />'
      + '<input type="number" value="' + it.qty + '" min="1" placeholder="Qty" onchange="iarItemField(' + idx + ',\'qty\',parseInt(this.value)||1)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:center;" />'
      + '<input type="number" value="' + (it.unitCost||0) + '" min="0" step="0.01" placeholder="Unit Cost" onchange="iarItemField(' + idx + ',\'unitCost\',parseFloat(this.value)||0)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:right;" />'
      + '<button onclick="removeIARItem(' + idx + ')" style="background:var(--red);color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;height:36px;width:36px;">&#10005;</button>'
      + '</div>';
  }).join('');
}

function iarItemField(idx, field, value) {
  iarItems[idx][field] = value;
  if (field === 'name') {
    const s = SUPPLIES.find(x => x.name === value);
    if (s) { iarItems[idx].unit = s.unit; iarItems[idx].unitCost = s.unitCost || 0; }
    renderIARItems();
  }
}

function addIARItem() {
  const s = SUPPLIES[0];
  iarItems.push({ name: s.name, unit: s.unit, qty: 1, unitCost: s.unitCost || 0 });
  renderIARItems();
}

function removeIARItem(idx) {
  iarItems.splice(idx, 1);
  renderIARItems();
}

async function saveIAR() {
  const iarNo  = document.getElementById('iar-no').value.trim();
  const supplier = document.getElementById('iar-supplier').value.trim();
  const poNo   = document.getElementById('iar-po').value.trim();
  const date   = document.getElementById('iar-date').value;
  const fund   = document.getElementById('iar-fund').value.trim();
  const reqOff = document.getElementById('iar-req-office').value.trim();

  if (!supplier || !date || !iarItems.length) { showToast('Fill in Supplier, Date, and add at least one item.'); return; }
  const btn = document.querySelector('#modal-iar .btn-gold');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    const ref = await db.collection('iars').add({
      iarNo, supplier, poNo, date, fund, reqOffice: reqOff,
      items: iarItems, accepted: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Immediately add to local IARS so it shows without waiting for snapshot
    const newIAR = { _id: ref.id, iarNo, supplier, poNo, date, fund, reqOffice: reqOff, items: iarItems, accepted: false };
    if (!IARS.find(x => x._id === ref.id)) IARS.push(newIAR);
    renderIAR();
    showToast('✅ IAR saved!');
    closeModal('modal-iar');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to save IAR.');
  } finally {
    if (btn) { btn.textContent = 'Save IAR'; btn.disabled = false; }
  }
}

// ════════════════════════════════════════════════════════════
// DELETE IAR
// ════════════════════════════════════════════════════════════
let deleteIARId = null;
let deleteIARNo = null;

function deleteIARPrompt(id, iarNo) {
  deleteIARId = id;
  deleteIARNo = iarNo;
  document.getElementById('delete-iar-no').textContent = iarNo;
  document.getElementById('modal-confirm-delete-iar').classList.add('open');
}

async function confirmDeleteIAR() {
  if (!deleteIARId) return;
  try {
    await db.collection('iars').doc(deleteIARId).delete();
    showToast('🗑️ IAR ' + deleteIARNo + ' deleted.');
    closeModal('modal-confirm-delete-iar');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to delete IAR.');
  }
}

// ════════════════════════════════════════════════════════════
// EDIT IAR — Fix/update an existing IAR
// ════════════════════════════════════════════════════════════
let editingIARId = null;
let editIARItems = [];

function openEditIARModal(iarId) {
  const iar = IARS.find(x => x._id === iarId);
  if (!iar) return;
  editingIARId = iarId;
  editIARItems = (iar.items || []).map(i => ({ ...i }));
  document.getElementById('edit-iar-no').value         = iar.iarNo     || '';
  document.getElementById('edit-iar-supplier').value   = iar.supplier  || '';
  document.getElementById('edit-iar-po').value         = iar.poNo      || '';
  document.getElementById('edit-iar-date').value       = iar.date      || '';
  document.getElementById('edit-iar-fund').value       = iar.fund      || '';
  document.getElementById('edit-iar-req-office').value = iar.reqOffice || '';
  renderEditIARItems();
  document.getElementById('modal-edit-iar').classList.add('open');
}

function renderEditIARItems() {
  const wrap = document.getElementById('edit-iar-items-wrap');
  if (!editIARItems.length) {
    wrap.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:20px;">No items. Click "+ Add Item" below.</p>';
    return;
  }
  wrap.innerHTML = editIARItems.map((it, idx) => {
    const opts = SUPPLIES.map(s =>
      '<option value="' + s.name + '" ' + (s.name === it.name ? 'selected' : '') + '>' + s.name + '</option>'
    ).join('');
    return '<div style="display:grid;grid-template-columns:1fr 80px 80px 110px 36px;gap:8px;align-items:center;margin-bottom:8px;">'
      + '<select onchange="editIARItemField(' + idx + ',\'name\',this.value)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:\'DM Sans\';">' + opts + '</select>'
      + '<input type="text" value="' + it.unit + '" placeholder="Unit" onchange="editIARItemField(' + idx + ',\'unit\',this.value)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:center;" />'
      + '<input type="number" value="' + it.qty + '" min="1" placeholder="Qty" onchange="editIARItemField(' + idx + ',\'qty\',parseInt(this.value)||1)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:center;" />'
      + '<input type="number" value="' + (it.unitCost||0) + '" min="0" step="0.01" placeholder="Unit Cost" onchange="editIARItemField(' + idx + ',\'unitCost\',parseFloat(this.value)||0)" style="padding:8px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;text-align:right;" />'
      + '<button onclick="removeEditIARItem(' + idx + ')" style="background:var(--red);color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;height:36px;width:36px;">&#10005;</button>'
      + '</div>';
  }).join('');
}

function editIARItemField(idx, field, value) {
  editIARItems[idx][field] = value;
  if (field === 'name') {
    const s = SUPPLIES.find(x => x.name === value);
    if (s) { editIARItems[idx].unit = s.unit; editIARItems[idx].unitCost = s.unitCost || 0; }
    renderEditIARItems();
  }
}

function addEditIARItem() {
  const s = SUPPLIES[0];
  editIARItems.push({ name: s.name, unit: s.unit, qty: 1, unitCost: s.unitCost || 0 });
  renderEditIARItems();
}

function removeEditIARItem(idx) {
  editIARItems.splice(idx, 1);
  renderEditIARItems();
}

async function saveEditIAR() {
  if (!editingIARId) return;
  if (!editIARItems.length) { showToast('Add at least one item.'); return; }
  const supplier = document.getElementById('edit-iar-supplier').value.trim();
  const date     = document.getElementById('edit-iar-date').value;
  if (!supplier || !date) { showToast('Supplier and Date are required.'); return; }
  const btn = document.querySelector('#modal-edit-iar .btn-gold');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    await db.collection('iars').doc(editingIARId).update({
      iarNo:     document.getElementById('edit-iar-no').value.trim(),
      supplier,
      poNo:      document.getElementById('edit-iar-po').value.trim(),
      date,
      fund:      document.getElementById('edit-iar-fund').value.trim(),
      reqOffice: document.getElementById('edit-iar-req-office').value.trim(),
      items:     editIARItems,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('✅ IAR updated successfully!');
    closeModal('modal-edit-iar');
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to update IAR.');
  } finally {
    if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false; }
  }
}

async function acceptIAR(iarId) {
  const iar = IARS.find(x => x._id === iarId);
  if (!iar) return;
  if (!confirm('Accept this IAR and add all items to supply inventory?')) return;
  try {
    // Add quantities to SUPPLIES in Firestore
    for (const it of (iar.items || [])) {
      const existing = SUPPLIES.find(s => s.name.toLowerCase() === it.name.toLowerCase());
      if (existing) {
        const newQty  = (existing.qty || 0) + (Number(it.qty) || 0);
        const newBal  = (existing.available || 0) + (Number(it.qty) || 0);
        const newData = { qty: newQty, balance: newBal, available: newBal, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (it.unitCost > 0) newData.unitCost = it.unitCost;
        if (existing._id) {
          await db.collection('supplies').doc(existing._id).update(newData);
        } else {
          const ref = await db.collection('supplies').add({ ...existing, ...newData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          existing._id = ref.id;
        }
        Object.assign(existing, newData);
      } else {
        // New supply from IAR
        const newSupply = { name: it.name, unit: it.unit, qty: Number(it.qty), balance: Number(it.qty), available: Number(it.qty), unitCost: it.unitCost || 0, note: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        const ref = await db.collection('supplies').add(newSupply);
        SUPPLIES.push({ ...newSupply, _id: ref.id });
      }
    }
    // Mark IAR as accepted
    await db.collection('iars').doc(iarId).update({ accepted: true, acceptedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('✅ IAR accepted! Supplies updated.');
    renderIAR();
  } catch(e) {
    console.error(e);
    showToast('⚠️ Failed to accept IAR: ' + e.message);
  }
}

function viewIAR(iarId) {
  const iar = IARS.find(x => x._id === iarId);
  if (!iar) return;
  const itemRows = (iar.items || []).map((it, i) =>
    '<tr><td>' + (i+1) + '</td><td>' + it.name + '</td><td>' + it.unit + '</td><td>' + it.qty + '</td><td>' + (it.unitCost ? '&#8369;' + Number(it.unitCost).toLocaleString('en-PH',{minimumFractionDigits:2}) : '—') + '</td></tr>'
  ).join('');
  const body = '<div style="margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">'
    + '<div><strong>IAR No:</strong> ' + iar.iarNo + '</div>'
    + '<div><strong>Supplier:</strong> ' + (iar.supplier||'—') + '</div>'
    + '<div><strong>PO No:</strong> ' + (iar.poNo||'—') + '</div>'
    + '<div><strong>Date:</strong> ' + (iar.date||'—') + '</div>'
    + '<div><strong>Fund Cluster:</strong> ' + (iar.fund||'—') + '</div>'
    + '<div><strong>Req. Office:</strong> ' + (iar.reqOffice||'—') + '</div>'
    + '</div>'
    + '<table style="width:100%;"><thead><tr><th>#</th><th>Description</th><th>Unit</th><th>Qty</th><th>Unit Cost</th></tr></thead>'
    + '<tbody>' + itemRows + '</tbody></table>'
    + '<div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:8px;font-size:13px;">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">'
    + '<div><strong>Inspected by:</strong><br><span style="color:var(--gray-600);">Inspection Committee</span></div>'
    + '<div><strong>Received by:</strong><br><span style="color:var(--gray-600);">MARILOU S. BUGATAN<br>AO I (Supply Officer I)</span></div>'
    + '</div></div>';
  document.getElementById('modal-ris-title').textContent = 'IAR — ' + iar.iarNo;
  document.getElementById('modal-ris-body').innerHTML = body;
  document.getElementById('modal-ris-footer').innerHTML = '<button class="btn btn-outline" onclick="closeModal(\'modal-ris\')">Close</button>';
  document.getElementById('modal-ris').classList.add('open');
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

// Pre-load employee accounts so login works without waiting
db.collection('accounts').get().then(snap => {
  ACCOUNTS = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}).catch(() => {});

document.getElementById('modal-logout-confirm').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-logout-confirm');
});
document.getElementById('modal-ris').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-ris');
});
document.getElementById('modal-print-ris').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-print-ris');
});
document.getElementById('modal-supply').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-supply');
});
document.getElementById('modal-confirm-delete').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-confirm-delete');
});
document.getElementById('modal-account').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-account');
});
document.getElementById('modal-confirm-delete-account').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-confirm-delete-account');
});
document.getElementById('modal-edit-ris').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-edit-ris');
});
document.getElementById('modal-iar').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-iar');
});
document.getElementById('modal-confirm-delete-request').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-confirm-delete-request');
});
document.getElementById('modal-confirm-delete-iar').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-confirm-delete-iar');
});
document.getElementById('modal-edit-iar').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modal-edit-iar');
});
