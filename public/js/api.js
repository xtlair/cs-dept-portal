// public/js/api.js
// Tiny helper so every page doesn't repeat fetch boilerplate.

async function apiCall(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // no json body
  }
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}

function showAlert(elId, message, type = 'error') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert ${type}`;
  el.classList.remove('hidden');
}

function hideAlert(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.add('hidden');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Date TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
