import { sendVkMessage } from '../../../infrastructure/vk';
import type { VkClient } from '../../../infrastructure/vk';
import type {
  AdminReportInput,
  AdminReportResult,
  DeliveryOutcome,
} from '../types';

// ---------- Рендер ----------

const REASON_LABEL: Record<string, string> = {
  'not-vk': 'указан другой канал связи',
  'no-vk-link': 'нет ссылки VK',
  'unresolved-screen': 'не удалось найти VK по screen-name',
};

const personLabel = (input: AdminReportInput, personId: string): string => {
  for (const day of input.plan.notifications) {
    if (day.personId === personId) return `${day.fullName} (${day.role})`;
  }
  return personId;
};

const renderReport = (input: AdminReportInput): string => {
  const { report, dates } = input;

  const skipped = report.outcomes.filter(
    (o): o is Extract<DeliveryOutcome, { status: 'skipped' }> =>
      o.status === 'skipped',
  );
  const failed = report.outcomes.filter(
    (o): o is Extract<DeliveryOutcome, { status: 'failed' }> =>
      o.status === 'failed',
  );

  const lines: string[] = [];
  lines.push(`📊 Отчёт рассылки ${dates.join(', ')}`);
  lines.push('');
  lines.push(
    `✅ отправлено: ${report.counts.sent} · ` +
      `⚠️ пропущено: ${report.counts.skipped} · ` +
      `❌ ошибок: ${report.counts.failed}`,
  );

  if (skipped.length) {
    lines.push('');
    lines.push('⚠️ Пропущены:');
    for (const s of skipped) {
      const reason = REASON_LABEL[s.reason] ?? s.reason;
      lines.push(`— ${personLabel(input, s.personId)}: ${reason}`);
    }
  }

  if (failed.length) {
    lines.push('');
    lines.push('❌ Ошибки отправки:');
    for (const f of failed) {
      lines.push(
        `— ${personLabel(input, f.personId)}: ${f.error}` +
          (f.retryable ? ' (можно повторить)' : ''),
      );
    }
  }

  if (!skipped.length && !failed.length) {
    lines.push('');
    lines.push('🎉 Все получили уведомления.');
  }

  return lines.join('\n');
};

// ---------- Отправка ----------

export const sendAdminReport = async (
  vk: VkClient,
  input: AdminReportInput,
): Promise<AdminReportResult> => {
  const text = renderReport(input);

  const result = await sendVkMessage(vk, {
    to: { type: 'id', value: input.adminUserId },
    text,
    dedupKey: `admin-report:${input.adminUserId}:${input.dates.join(',')}:${text}`,
  });

  if (result.status === 'sent') {
    return { status: 'sent', messageId: result.messageId, text };
  }
  if (result.status === 'failed') {
    return {
      status: 'failed',
      error: result.error,
      retryable: result.retryable,
      text,
    };
  }
  // skipped не бывает для adminUserId типа 'id', но TS требует исчерпания
  return {
    status: 'failed',
    error: `unexpected skip: ${result.reason}`,
    retryable: false,
    text,
  };
};

/** Экспортируем рендер отдельно — пригодится для тестов и preview. */
export { renderReport };