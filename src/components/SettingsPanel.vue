<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { clearCache } from '../cache';
import { testConnection } from '../api';
import { createLinuxdoSiteSession, type SiteSessionGrantSummary } from '../site-session.ts';

const props = defineProps<{
  open: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const session = createLinuxdoSiteSession();
const grantActive = ref(false);
const grantStatusText = ref('');
const testState = ref<'idle' | 'testing' | 'ok' | 'blocked' | 'fail' | 'permission' | 'unsupported'>('idle');
const testStatus = ref(0);
const busy = ref(false);
const savedHint = ref(false);
let savedTimer = 0;

watch(
  () => props.open,
  (open) => {
    if (open) {
      testState.value = 'idle';
      testStatus.value = 0;
      void refreshGrants();
    }
  },
);

const flashSaved = (): void => {
  savedHint.value = true;
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => {
    savedHint.value = false;
  }, 1600);
};

const refreshGrants = async (): Promise<void> => {
  try {
    const grants: SiteSessionGrantSummary[] = await session.listGrants();
    const active = grants.find((grant) => grant.sessionId === 'linuxdo-public' && grant.status === 'active')
      ?? grants.find((grant) => grant.origin === 'https://linux.do' && grant.status === 'active');
    grantActive.value = Boolean(active);
    grantStatusText.value = grantActive.value ? props.t('settingsGrantActive') : props.t('settingsGrantNone');
  } catch {
    grantActive.value = false;
    grantStatusText.value = props.t('settingsGrantNone');
  }
};

const handleRequestAccess = async (): Promise<void> => {
  busy.value = true;
  try {
    const status = await session.requestAccess();
    grantActive.value = status.status === 'granted';
    grantStatusText.value =
      status.status === 'granted'
        ? props.t('settingsGrantActive')
        : props.t('settingsGrantRequested');
  } catch (error) {
    grantStatusText.value = (error as { code?: string }).code === 'unsupported_host'
      ? props.t('errorUnsupportedHost')
      : props.t('settingsGrantRequestFail');
  } finally {
    busy.value = false;
    flashSaved();
  }
};

const handleRevoke = async (): Promise<void> => {
  busy.value = true;
  try {
    await session.revoke();
    grantStatusText.value = props.t('settingsGrantRevoked');
    grantActive.value = false;
  } catch {
    grantStatusText.value = props.t('settingsGrantRequestFail');
  } finally {
    busy.value = false;
    flashSaved();
  }
};

/** challenge 需要人工验证：打开宿主的站点窗口，用户亲自完成后回来重试。 */
const handleOpenSite = async (): Promise<void> => {
  busy.value = true;
  try {
    await session.open();
    testState.value = 'idle';
    grantStatusText.value = props.t('settingsVerifyHint');
  } catch (error) {
    const code = (error as { code?: string }).code;
    testState.value =
      code === 'unsupported_host' || code === 'unsupported_platform'
        ? 'unsupported'
        : code === 'permission_required' || code === 'permission_denied'
          ? 'permission'
          : 'fail';
  } finally {
    busy.value = false;
    flashSaved();
  }
};

const handleClearCache = (): void => {
  clearCache();
  flashSaved();
};

const handleTest = async (): Promise<void> => {
  testState.value = 'testing';
  const result = await testConnection();
  testStatus.value = result.status;
  if (result.ok) testState.value = 'ok';
  else if (result.blocked) testState.value = 'blocked';
  else if (result.permission) testState.value = 'permission';
  else if (result.unsupported) testState.value = 'unsupported';
  else testState.value = 'fail';
  void refreshGrants();
};

const stateLabel = computed(() => props.t('settingsGrantStatus'));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="settings-backdrop" @click.self="emit('close')">
      <div class="settings-panel" role="dialog" aria-modal="true">
        <header class="settings-head">
          <h2>{{ t('settingsTitle') }}</h2>
          <button class="icon-button" :title="t('settingsClose')" @click="emit('close')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </header>

        <div class="settings-scroll">
          <section class="settings-section">
            <h3>{{ t('settingsGrantTitle') }}</h3>
            <p class="grant-status">
              <span class="field-label">{{ stateLabel }}</span>
              <span :class="grantActive ? 'is-ok' : 'is-muted'">{{ grantStatusText }}</span>
            </p>
            <p class="about-text">{{ t('settingsGrantBody') }}</p>
            <div class="actions-row">
              <button class="primary-button" :disabled="busy" @click="handleRequestAccess">
                {{ t('settingsRequestAccess') }}
              </button>
              <button class="text-button" :disabled="busy" @click="handleRevoke">
                {{ t('settingsRevoke') }}
              </button>
              <button class="text-button" :disabled="busy" @click="handleOpenSite">
                {{ t('settingsOpenSite') }}
              </button>
            </div>
            <p v-if="savedHint && grantStatusText" class="saved-hint">{{ grantStatusText }}</p>
            <p class="about-text is-muted">{{ t('settingsVerifyHint') }}</p>
          </section>

          <section class="settings-section">
            <div class="actions-row">
              <button class="text-button" :disabled="testState === 'testing'" @click="handleTest">
                {{ testState === 'testing' ? t('settingsTesting') : t('settingsTest') }}
              </button>
              <button class="text-button" @click="handleClearCache">{{ t('settingsClearCache') }}</button>
              <span v-if="savedHint" class="saved-hint">{{ t('settingsSaved') }}</span>
            </div>
            <p v-if="testState === 'ok'" class="test-result is-ok">
              {{ t('settingsTestOk', { status: testStatus }) }}
            </p>
            <p v-else-if="testState === 'blocked'" class="test-result is-blocked">
              {{ t('settingsTestBlocked', { status: testStatus }) }}
            </p>
            <p v-else-if="testState === 'fail'" class="test-result is-fail">
              {{ t('settingsTestFail', { status: testStatus }) }}
            </p>
            <p v-else-if="testState === 'permission'" class="test-result is-blocked">
              {{ t('errorPermission') }}
            </p>
            <p v-else-if="testState === 'unsupported'" class="test-result is-fail">
              {{ t('errorUnsupportedHost') }}
            </p>
          </section>

          <section class="settings-section">
            <h3>{{ t('settingsAbout') }}</h3>
            <p class="about-text">{{ t('settingsAboutBody') }}</p>
            <p class="about-text is-muted">{{ t('settingsPrivacy') }}</p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 0.36);
  animation: backdrop-in 0.16s ease-out;
}
.settings-panel {
  width: min(520px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  background: var(--ld-panel-bg, #fff);
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.22);
  overflow: hidden;
}
.settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ld-border, #e5e8ef);
}
.settings-head h2 { margin: 0; font-size: 16px; }
.settings-scroll { padding: 14px 18px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.settings-section { display: flex; flex-direction: column; gap: 8px; }
.settings-section h3 { margin: 0; font-size: 14px; }
.grant-status { display: flex; gap: 8px; align-items: baseline; margin: 0; }
.is-ok { color: #1f7a3f; }
.is-muted { color: var(--ld-muted, #6a7386); }
.field-label { font-size: 12px; color: var(--ld-muted, #6a7386); }
.actions-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.primary-button, .text-button { font: inherit; font-size: 13px; border-radius: 8px; cursor: pointer; }
.primary-button { border: 1px solid #315bd7; background: #315bd7; color: #fff; padding: 6px 12px; }
.text-button { border: 1px solid var(--ld-border, #c9d0de); background: transparent; color: inherit; padding: 6px 10px; }
.text-button:disabled, .primary-button:disabled { opacity: 0.5; cursor: default; }
.saved-hint { font-size: 12px; color: var(--ld-muted, #6a7386); margin: 0; }
.test-result { margin: 0; font-size: 13px; padding: 8px 10px; border-radius: 8px; }
.test-result.is-ok { background: #e4f5eb; color: #20623a; }
.test-result.is-blocked { background: #fff0e6; color: #873b0a; }
.test-result.is-fail { background: #fdeaea; color: #8f2323; }
.about-text { margin: 0; font-size: 12.5px; line-height: 1.6; }
.about-text.is-muted { color: var(--ld-muted, #6a7386); }
@media (prefers-color-scheme: dark) {
  .settings-panel { background: #20242e; --ld-panel-bg: #20242e; --ld-border: #3a4152; --ld-muted: #9aa4ba; }
  .text-button { background: #262c39; }
}
</style>
