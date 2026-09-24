// src/application/sendNotifications.js
import { createHash } from "node:crypto";
import { DEFAULT_KIND, makeMessageKey } from "../domain/journal.js";

const hashCode = (str) => {
  const buf = createHash("sha256").update(str).digest();
  return Number(buf.readBigUInt64BE(0) % 9223372036854775807n) || 1;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveNumericId = async (vk, cache, vkClient) => {
  if (!vk) return null;
  if (vk.type === "id") return vk.value;
  if (vk.type === "screen") {
    if (cache.has(vk.value)) return cache.get(vk.value);
    const id = await vkClient.resolveScreenName(vk.value);
    cache.set(vk.value, id);
    return id;
  }
  return null;
};

const toFailure = (n, lessonDate, role, reason) => {
  return {
    fullName: n.fullName,
    personId: n.personId,
    role,
    channel: n.channel,
    reason,
    lessons: n.lessons.map((l) => ({
      date: lessonDate,
      time: l.time,
      className: l.className,
      type: l.type,
    })),
  };
};

export const createSendNotifications = ({
  vkClient,
  journal,
  options = {},
}) => {
  const { pauseMs = 350, kind = DEFAULT_KIND } = options;

  return async ({ plan, runDate }) => {
    const previous = await journal.load(); // Set<string>
    const current = new Set(previous); // копия, чтобы не мутировать
    const screenCache = new Map(); // screen_name → userId

    const sent = [];
    const skipped = [];
    const failed = [];

    // Разворачиваем дни и роли в плоский список
    const entries = [];
    for (const day of plan.notifications) {
      for (const n of day.students) {
        entries.push({ n, role: "student", lessonDate: day.date });
      }
      for (const n of day.teachers) {
        entries.push({ n, role: "teacher", lessonDate: day.date });
      }
    }

    for (const { n, role, lessonDate } of entries) {
      const key = makeMessageKey({
        kind,
        runDate,
        lessonDate,
        role,
        personId: n.personId,
      });

      // 1. Уже отправляли — пропускаем
      if (previous.has(key)) {
        skipped.push({
          fullName: n.fullName,
          personId: n.personId,
          role,
          lessonDate,
          reason: "already sent",
        });
        continue;
      }

      // 2. Канал не VK — фиксируем как неудачу (пока нет других адаптеров)
      if (n.channel !== "vk") {
        failed.push(
          toFailure(n, lessonDate, role, `канал "${n.channel ?? "не указан"}"`)
        );
        continue;
      }

      // 3. Резолвим числовой userId
      let userId;
      try {
        userId = await resolveNumericId(n.vk, screenCache, vkClient);
      } catch (e) {
        failed.push(toFailure(n, lessonDate, role, `resolve: ${e.message}`));
        continue;
      }

      if (!userId) {
        const reason = n.vk ? "не удалось определить vk id" : "нет vk_link";
        failed.push(toFailure(n, lessonDate, role, reason));
        continue;
      }

      // 4. Отправка
      try {
        await vkClient.send({
          userId,
          text: n.text,
          randomId: hashCode(key + "DS"),
        });

        current.add(key);
        sent.push({
          fullName: n.fullName,
          personId: n.personId,
          role,
          lessonDate,
          userId,
          messageKey: key,
        });

        await delay(pauseMs);
      } catch (e) {
        failed.push(toFailure(n, lessonDate, role, e.message));
      }
    }

    await journal.save(current);

    return { runDate, kind, sent, skipped, failed };
  };
};
