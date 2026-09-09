import { t } from '../utils.js';

const storage = () => window.miniappsAI?.storage;

export async function renderOnboarding(container) {
  if (!container) return;
  let dismissed = false;
  try { dismissed = (await storage()?.getItem('onboardingDismissed')) === '1'; } catch { dismissed = false; }
  if (dismissed) return;
  container.innerHTML = `<section class="onboarding-card glass" aria-labelledby="onboardingTitle"><div><span class="onboarding-kicker">${t('onboarding.kicker')}</span><h2 id="onboardingTitle">${t('onboarding.title')}</h2><p>${t('onboarding.description')}</p></div><button class="action-btn" id="onboardingDismiss" type="button" aria-label="${t('onboarding.dismiss')}">×</button><ol><li>${t('onboarding.stepOne')}</li><li>${t('onboarding.stepTwo')}</li><li>${t('onboarding.stepThree')}</li></ol><button class="btn btn-primary" id="onboardingClose" type="button">${t('onboarding.dismiss')}</button></section>`;
  const dismiss = async () => {
    try { await storage()?.setItem('onboardingDismissed', '1'); } catch { /* optional preference */ }
    container.replaceChildren();
  };
  container.querySelector('#onboardingDismiss')?.addEventListener('click', dismiss);
  container.querySelector('#onboardingClose')?.addEventListener('click', dismiss);
}
