<template>
  <dialog
    ref="dialog"
    class="admin-action-dialog"
    :aria-labelledby="titleId"
    @cancel="handleCancel"
    @click="handleBackdropClick"
  >
    <form class="admin-action-form" @submit.prevent="submit">
      <header class="admin-action-heading">
        <div>
          <h2 :id="titleId">{{ title }}</h2>
          <p v-if="description">{{ description }}</p>
        </div>
        <button type="button" class="admin-action-close" aria-label="Close dialog" :disabled="busy" @click="emit('cancel')">×</button>
      </header>

      <label v-for="field in fields" :key="field.name" class="admin-action-field" :for="fieldId(field.name)">
        <span>{{ field.label }}</span>
        <textarea
          v-if="field.type === 'textarea'"
          :id="fieldId(field.name)"
          v-model="values[field.name]"
          :maxlength="field.maxLength"
          :placeholder="field.placeholder"
          :required="field.required !== false"
          :rows="field.rows || 4"
          :disabled="busy"
        ></textarea>
        <input
          v-else
          :id="fieldId(field.name)"
          v-model="values[field.name]"
          :type="field.type || 'text'"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :maxlength="field.maxLength"
          :placeholder="field.placeholder"
          :required="field.required !== false"
          :disabled="busy"
          autocomplete="off"
        />
      </label>

      <p v-if="error" class="admin-action-error" role="alert">{{ error }}</p>

      <footer class="admin-action-footer">
        <button type="button" class="admin-action-cancel" :disabled="busy" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="admin-action-confirm" :class="{ danger }" :disabled="busy">
          {{ busy ? "Saving…" : confirmLabel }}
        </button>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

type ActionField = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea";
  initialValue?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
  rows?: number;
};

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string;
  fields: ActionField[];
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
}>(), {
  description: "",
  danger: false,
  busy: false,
  error: "",
});

const emit = defineEmits<{
  cancel: [];
  confirm: [values: Record<string, string>];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const values = ref<Record<string, string>>({});
const titleId = `admin-action-title-${Math.random().toString(36).slice(2, 9)}`;

watch(
  () => [props.open, props.fields] as const,
  async ([open, fields]) => {
    if (open) {
      values.value = Object.fromEntries(fields.map((field) => [field.name, field.initialValue || ""]));
      await nextTick();
      if (dialog.value && !dialog.value.open) dialog.value.showModal();
    } else if (dialog.value?.open) {
      dialog.value.close();
    }
  },
  { immediate: true, deep: true },
);

function fieldId(name: string): string {
  return `${titleId}-${name}`;
}

function handleCancel(event: Event): void {
  if (props.busy) {
    event.preventDefault();
    return;
  }
  emit("cancel");
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === dialog.value && !props.busy) emit("cancel");
}

function submit(): void {
  if (!props.busy) emit("confirm", { ...values.value });
}
</script>

<style scoped>
.admin-action-dialog {
  width: min(480px, calc(100vw - 32px));
  max-height: min(720px, calc(100dvh - 32px));
  padding: 0;
  overflow: auto;
  color: #23332a;
  background: #fff;
  border: 1px solid #dfe8e1;
  border-radius: 20px;
  box-shadow: 0 24px 80px rgb(7 34 21 / 24%);
}

.admin-action-dialog::backdrop {
  background: rgb(9 26 17 / 55%);
  backdrop-filter: blur(3px);
}

.admin-action-form {
  display: grid;
  gap: 18px;
  padding: 24px;
}

.admin-action-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.admin-action-heading h2 {
  margin: 0;
  color: #1d3024;
  font-size: 20px;
}

.admin-action-heading p {
  margin: 7px 0 0;
  color: #69786e;
  font-size: 14px;
  line-height: 1.5;
}

.admin-action-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  color: #52635a;
  background: #f1f5f2;
  border: 0;
  border-radius: 10px;
  font-size: 22px;
  cursor: pointer;
}

.admin-action-field {
  display: grid;
  gap: 8px;
  color: #405248;
  font-size: 13px;
  font-weight: 700;
}

.admin-action-field input,
.admin-action-field textarea {
  width: 100%;
  min-height: 44px;
  padding: 11px 12px;
  color: #23332a;
  background: #fbfdfb;
  border: 1px solid #d5dfd7;
  border-radius: 10px;
  font: inherit;
  font-weight: 500;
}

.admin-action-field textarea {
  min-height: 112px;
  resize: vertical;
}

.admin-action-field input:focus,
.admin-action-field textarea:focus {
  outline: 3px solid rgb(29 164 91 / 18%);
  border-color: #1da45b;
}

.admin-action-error {
  margin: 0;
  padding: 10px 12px;
  color: #9c3434;
  background: #fff2f1;
  border: 1px solid #f1d0cd;
  border-radius: 10px;
  font-size: 13px;
}

.admin-action-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

.admin-action-footer button {
  min-height: 42px;
  padding: 0 16px;
  border: 0;
  border-radius: 10px;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
}

.admin-action-cancel {
  color: #405248;
  background: #eef3ef;
}

.admin-action-confirm {
  color: #fff;
  background: #12844a;
}

.admin-action-confirm.danger {
  background: #b63e3e;
}

.admin-action-footer button:disabled,
.admin-action-close:disabled {
  opacity: 0.6;
  cursor: wait;
}

@media (max-width: 520px) {
  .admin-action-form {
    gap: 15px;
    padding: 20px;
  }

  .admin-action-footer button {
    flex: 1;
  }
}
</style>
