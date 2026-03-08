(function () {
  function decodePayloadFromHash() {
    const hash = String(window.location.hash || '');
    const match = hash.match(/codexAutofill=([^&]+)/);
    if (!match || !match[1]) return null;
    try {
      const encoded = decodeURIComponent(match[1]);
      const json = decodeURIComponent(escape(atob(encoded)));
      return JSON.parse(json);
    } catch (_error) {
      return null;
    }
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, '').trim();
  }

  function findButtonByText(text) {
    const target = normalizeText(text);
    if (!target) return null;
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    return buttons.find((el) => normalizeText(el.textContent).includes(target)) || null;
  }

  function clickChip(text) {
    const el = findButtonByText(text);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }

  function findFieldByLabel(labelText) {
    const labels = Array.from(document.querySelectorAll('label, p, span, div, strong, h3, h4'));
    const target = normalizeText(labelText);
    const labelEl = labels.find((el) => normalizeText(el.textContent).includes(target));
    if (!labelEl) return null;

    const wrap = labelEl.closest('label, section, article, div') || labelEl.parentElement;
    if (!wrap) return null;

    return wrap.querySelector('input, textarea') || labelEl.parentElement?.querySelector('input, textarea') || null;
  }

  function setInputValue(labelText, value) {
    if (value === undefined || value === null || value === '') return false;
    const input = findFieldByLabel(labelText);
    if (!input) return false;
    input.focus();
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function renderToast(message) {
    const existing = document.getElementById('codex-autofill-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'codex-autofill-toast';
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:999999',
      'padding:10px 14px',
      'border-radius:10px',
      'background:#1f2937',
      'color:#fff',
      'font-size:13px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.25)'
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  function applyAutofill(payload) {
    if (!payload || !payload.listing) return;
    const listing = payload.listing || {};

    clickChip(listing.propertyType);
    clickChip(listing.dealType);
    clickChip(listing.direction);
    clickChip(listing.parking);

    setInputValue('전세금', listing.price);
    setInputValue('매매가', listing.price);
    setInputValue('보증금', listing.price);
    setInputValue('월세', listing.price);
    setInputValue('방 개수', listing.roomCount);
    setInputValue('욕실 개수', listing.bathCount);
    setInputValue('관리비', listing.maintenanceFee);
    setInputValue('입주 가능일', listing.moveInDate);
    setInputValue('추가 설명', listing.description);
    setInputValue('전용면적', payload.unit?.exclusiveSqm);
    setInputValue('공급면적', payload.unit?.supplySqm);

    renderToast('Codex 자동입력 데이터를 적용했습니다. 누락 항목만 확인 후 저장하세요.');
  }

  function run() {
    const payload = decodePayloadFromHash();
    if (!payload) return;
    setTimeout(() => applyAutofill(payload), 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
