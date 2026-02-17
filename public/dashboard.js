console.log('Minimal demo dashboard loaded');

const DEMO_DATA = [
  { name: 'Ram Shrestha', status: 'success', service: 'Passport' },
  { name: 'Sita Gurung', status: 'pending', service: 'NID' },
  { name: 'Hari Adhikari', status: 'working', service: 'License' },
  { name: 'Maya KC', status: 'success', service: 'PAN' }
];

function renderStats() {
  const total = DEMO_DATA.length;
  const success = DEMO_DATA.filter(d => d.status === 'success').length;
  const pending = DEMO_DATA.filter(d => d.status === 'pending').length;
  document.getElementById('total-records').textContent = total;
  document.getElementById('stat-success').textContent = success;
  document.getElementById('stat-pending').textContent = pending;
}

function renderTable() {
  const tbody = document.getElementById('demo-rows');
  tbody.innerHTML = '';
  DEMO_DATA.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04)">${row.name}</td><td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04)">${row.status}</td><td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04)">${row.service}</td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderStats();
  renderTable();

  const refreshBtn = document.getElementById('refresh-data');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    // Shuffle demo data slightly
    DEMO_DATA.push(DEMO_DATA.shift());
    renderStats();
    renderTable();
    alert('Demo data refreshed');
  });
});
