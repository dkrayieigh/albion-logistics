export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

export function parseNum(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/,/g, '')) || 0;
}

export function formatSilver(val) { 
  if (val === undefined || isNaN(val)) return '0'; 
  return Math.round(val).toLocaleString(); 
}

export function formatMillions(val) {
  if (val >= 1000000 || val <= -1000000) return (val / 1000000).toFixed(1) + 'M';
  return formatSilver(val);
}