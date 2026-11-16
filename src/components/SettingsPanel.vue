<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { clearCache } from '../cache';
import { DEFAULT_UA, testConnection } from '../api';
import { clearClearance, getClearance, setClearance } from '../clearance';

const props = defineProps<{
  open: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const cookieInput = ref('');
const uaInput = ref('');
const testState = ref<'idle' | 'testing' | 'ok' | 'blocked' | 'fail'>('idle');
const testStatus = ref(0);
const savedHint = ref(false);
let savedTimer = 0;

/** CF 把 clearance 绑定到精确 UA（spike ④）：只填一对中的一个必然被拦，禁止保存。 */
const pairIncomplete = computed(() => {
  const cookie = cookieInput.value.trim();
  const ua = uaInput.value.trim();
  return (cookie !== '' && ua === '') || (cookie === '' && ua !== '');
});

const defaultUaShort = computed(() => {
  const match = DEFAULT_UA.match(/Chrome\/[\d.]+/);
  return match ? match[0] : DEFAULT_UA;
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      const pair = getClearance();
      cookieInput.value = pair.cookie;
      uaInput.value = pair.ua;
      testState.value = 'idle';
      testStatus.value = 0;
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

const handleSave = (): void => {
  setClearance(cookieInput.value.trim(), uaInput.value.trim());
  flashSaved();
};

const handleClear = (): void => {
  clearClearance();
  cookieInput.value = '';
  uaInput.value = '';
  testState.value = 'idle';
  flashSaved();
};

const handleClearCache = (): void => {
  clearCache();
  flashSaved();
};

const handleTest = async (): Promise<void> => {
  // 先保存当前输入再测，保证「改完即测」的语义。
  setClearance(cookieInput.value.trim(), uaInput.value.trim());
  testState.value = 'testing';
  const result = await testConnection();
  testStatus.value = result.status;
  if (result.ok) testState.value = 'ok';
  else if (result.blocked) testState.value = 'blocked';
  else testState.value = 'fail';
};
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
            <h3>{{ t('settingsHowTitle') }}</h3>
            <ol class="how-list">
              <li>{{ t('settingsHowStep1') }}</li>
              <li>{{ t('settingsHowStep2') }}</li>
              <li>{{ t('settingsHowStep3') }}</li>
              <li>{{ t('settingsHowStep4') }}</li>
            </ol>
          </section>

          <section class="settings-section">
            <label class="field-label" for="ld-clearance">{{ t('settingsClearance') }}</label>
            <textarea
              id="ld-clearance"
              v-model="cookieInput"
              class="field-input field-textarea"
              rows="3"
              :placeholder="t('settingsClearancePlaceholder')"
              spellcheck="false"
            />

            <label class="field-label" for="ld-ua">{{ t('settingsUa') }}</label>
            <input
              id="ld-ua"
              v-model="uaInput"
              class="field-input"
              type="text"
              :placeholder="t('settingsUaPlaceholder', { default: defaultUaShort })"
              spellcheck="false"
            />

            <div class="actions-row">
              <button class="primary-button" :disabled="pairIncomplete" @click="handleSave">
                {{ t('settingsSave') }}
              </button>
              <button class="text-button" @click="handleClear">{{ t('settingsClear') }}</button>
              <button class="text-button" :disabled="pairIncomplete || testState === 'testing'" @click="handleTest">
                {{ testState === 'testing' ? t('settingsTesting') : t('settingsTest') }}
              </button>
              <span v-if="savedHint" class="saved-hint">{{ t('settingsSaved') }}</span>
            </div>

            <p v-if="pairIncomplete" class="pair-hint">{{ t('settingsPairHint') }}</p>

            <p v-if="testState === 'ok'" class="test-result is-ok">
              {{ t('settingsTestOk', { status: testStatus }) }}
            </p>
            <p v-else-if="testState === 'blocked'" class="test-result is-blocked">
              {{ t('settingsTestBlocked', { status: testStatus }) }}
            </p>
            <p v-else-if="testState === 'fail'" class="test-result is-fail">
              {{ t('settingsTestFail', { status: testStatus }) }}
            </p>
          </section>

          <section class="settings-section">
            <div class="actions-row">
              <button class="text-button" @click="handleClearCache">{{ t('settingsClearCache') }}</button>
            </div>
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

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.settings-panel {
  display: flex;
  flex-direction: column;
  width: min(520px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 48px));
  border-radius: 14px;
  background: var(--ld-bg);
  border: 1px solid var(--ld-border);
  box-shadow: 0 24px 64px rgb(0 0 0 / 0.28);
  overflow: hidden;
}

.settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ld-border);
}

.settings-head h2 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ld-text);
}

.settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 18px;
}

.settings-section + .settings-section {
  margin-top: 4px;
}

.settings-section h3 {
  margin: 14px 0 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ld-text-2);
}

.how-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.how-list li {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ld-text-3);
}

.field-label {
  display: block;
  margin: 10px 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--ld-text-2);
}

.field-input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--ld-border);
  border-radius: 8px;
  background: var(--ld-fill);
  color: var(--ld-text);
  font-size: 11.5px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  outline: 0;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--ld-accent);
  background: var(--ld-bg);
}

.field-textarea {
  resize: vertical;
  word-break: break-all;
}

.actions-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.primary-button {
  padding: 5px 14px;
  border: 0;
  border-radius: 7px;
  background: var(--ld-accent);
  color: #fff;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.primary-button:hover {
  filter: brightness(1.06);
}

.text-button {
  padding: 4px 10px;
  border: 1px solid var(--ld-border);
  border-radius: 7px;
  background: transparent;
  color: var(--ld-text-2);
  font-size: 11.5px;
  cursor: pointer;
}

.text-button:hover:not(:disabled) {
  background: var(--ld-hover);
  border-color: var(--ld-border-strong);
}

.text-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.saved-hint {
  font-size: 10.5px;
  color: var(--ld-success);
}

.test-result {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.55;
}

.test-result.is-ok {
  color: var(--ld-success);
}

.test-result.is-blocked {
  color: #d2601f;
}

.test-result.is-fail {
  color: var(--ld-danger);
}

.pair-hint {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: #d2601f;
}

.primary-button:disabled,
.text-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.about-text {
  margin: 0 0 6px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ld-text-2);
}

.about-text.is-muted {
  font-size: 10.5px;
  color: var(--ld-text-3);
}
</style>
