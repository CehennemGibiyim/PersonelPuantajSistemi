import { loadState, saveState } from './storage.js';
import { getCurrentUnitId, getRole } from './state.js';
import { getYear, getMonth } from './utils.js';

const DEFAULT_STATE = {
  status: 'draft',
  submittedAt: '',
  submittedBy: '',
  reviewedAt: '',
  reviewedBy: '',
  reviewerNote: ''
};

let context = { unitId: '', year: 0, month: 0 };
let approvalState = { ...DEFAULT_STATE };
let loadedKey = '';

function storageKey() {
  return context.unitId
    ? `puantaj_${context.unitId}_period_approval_${context.year}_${context.month}`
    : '';
}

function clean(value) {
  if (!value || typeof value !== 'object') return { ...DEFAULT_STATE };
  const status = ['draft', 'submitted', 'approved', 'rejected'].includes(value.status) ? value.status : 'draft';
  return {
    status,
    submittedAt: typeof value.submittedAt === 'string' ? value.submittedAt : '',
    submittedBy: String(value.submittedBy || '').trim(),
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : '',
    reviewedBy: String(value.reviewedBy || '').trim(),
    reviewerNote: String(value.reviewerNote || '').trim().slice(0, 500)
  };
}

export async function initPeriodApproval(unitId, year, month) {
  context = { unitId: String(unitId || ''), year: Number(year), month: Number(month) };
  const key = storageKey();
  if (!key || loadedKey === key) return getPeriodApprovalState();
  try {
    approvalState = clean(await loadState(key));
  } catch {
    approvalState = { ...DEFAULT_STATE };
  }
  loadedKey = key;
  return getPeriodApprovalState();
}

export function getPeriodApprovalState() { return { ...approvalState }; }
export function isPeriodApprovalApproved() { return approvalState.status === 'approved'; }

async function persist() {
  if (!storageKey()) return false;
  try {
    return await saveState(approvalState, storageKey());
  } catch {
    return false;
  }
}

export async function submitPeriodApproval(submittedBy = getRole()) {
  if (!storageKey() || !['draft', 'rejected'].includes(approvalState.status)) return false;
  const previous = { ...approvalState };
  approvalState = {
    ...approvalState,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    submittedBy: String(submittedBy || '').trim(),
    reviewedAt: '',
    reviewedBy: '',
    reviewerNote: ''
  };
  if (await persist()) return true;
  approvalState = previous;
  return false;
}

export async function reviewPeriodApproval(status, reviewedBy = getRole(), reviewerNote = '') {
  if (!storageKey() || !['approved', 'rejected'].includes(status) || approvalState.status !== 'submitted') return false;
  const previous = { ...approvalState };
  approvalState = {
    ...approvalState,
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: String(reviewedBy || '').trim(),
    reviewerNote: String(reviewerNote || '').trim().slice(0, 500)
  };
  if (await persist()) return true;
  approvalState = previous;
  return false;
}

export async function importPeriodApprovalSnapshot(snapshot) {
  if (!storageKey()) return false;
  const previous = { ...approvalState };
  approvalState = clean(snapshot);
  if (await persist()) return true;
  approvalState = previous;
  return false;
}

export function getPeriodApprovalContext() { return { ...context }; }
