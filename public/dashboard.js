console.log('Minimal dashboard loaded');

document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('status');
  status.textContent = 'Status: ready';

  document.getElementById('open-demo').addEventListener('click', () => {
    alert('Demo dashboard opened. This is a minimal scaffold.');
  });
});
