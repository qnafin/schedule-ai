import { pipeline, env } from '@huggingface/transformers';
import * as lancedb from '@lancedb/lancedb';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

// ---------- Константы ----------

env.cacheDir = './data/models';
env.allowLocalModels = true;

const MODEL = 'Xenova/multilingual-e5-small';
const DB_PATH = join(process.cwd(), 'data', 'lancedb');
const TABLE = 'knowledge';
const RAG_DIR = join(process.cwd(), 'src', 'rag', 'data');

const MAX_CHUNK = 1200;
const MIN_CHUNK = 300;
const MIN_SCORE = 0.65;

// ---------- Embeddings (singleton) ----------

type Extractor = (
  text: string,
  opts: { pooling: 'mean'; normalize: true },
) => Promise<{ data: Float32Array }>;

let extractorPromise: Promise<Extractor> | null = null;

const getExtractor = (): Promise<Extractor> => {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      'feature-extraction',
      MODEL,
    ) as unknown as Promise<Extractor>;
  }
  return extractorPromise;
};

const embedOne = async (text: string): Promise<number[]> => {
  const ext = await getExtractor();
  const out = await ext(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
};

const embedQuery = (text: string) => embedOne(`query: ${text}`);
const embedDoc = (text: string) => embedOne(`passage: ${text}`);

// ---------- LanceDB ----------

type Row = {
  id: string;
  vector: number[];
  text: string;
  source: string;
  heading: string;
  hash: string;
};

export type SearchHit = {
  text: string;
  source: string;
  heading: string;
  score: number;
};

const openTable = async () => {
  const db = await lancedb.connect(DB_PATH);
  const tables = await db.tableNames();
  if (!tables.includes(TABLE)) return null;
  return db.openTable(TABLE);
};

// ---------- Chunking: разбиение по #, ##, ### ----------

const splitMarkdown = (content: string): { heading: string; text: string }[] => {
  const lines = content.split('\n');
  const chunks: { heading: string; text: string }[] = [];

  let heading = '';
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) chunks.push({ heading, text });
    buffer = [];
  };

  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.+)/);
    if (h) {
      flush();
      heading = h[1].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return chunks;
};

/** Режем слишком длинные, склеиваем слишком короткие. */
const normalizeChunks = (chunks: { heading: string; text: string }[]) => {
  const sized = chunks.flatMap((c) => {
    if (c.text.length <= MAX_CHUNK) return [c];
    const sentences = c.text.split(/(?<=[.!?])\s+/);
    const parts: string[] = [];
    let cur = '';
    for (const s of sentences) {
      if ((cur + ' ' + s).length > MAX_CHUNK && cur) {
        parts.push(cur.trim());
        cur = s;
      } else {
        cur = cur ? cur + ' ' + s : s;
      }
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.map((text) => ({ heading: c.heading, text }));
  });

  const merged: { heading: string; text: string }[] = [];
  let buffer: { heading: string; text: string } | null = null;
  for (const c of sized) {
    if (!buffer) {
      buffer = c;
      continue;
    }
    if (buffer.heading === c.heading && buffer.text.length < MIN_CHUNK) {
      buffer = { heading: buffer.heading, text: buffer.text + '\n\n' + c.text };
    } else {
      merged.push(buffer);
      buffer = c;
    }
  }
  if (buffer) merged.push(buffer);

  return merged;
};

// ---------- Indexing ----------

export const indexKnowledge = async (): Promise<{ files: number; chunks: number }> => {
  const all = await readdir(RAG_DIR);
  const files = all.filter((f) => ['.txt', '.md'].includes(extname(f).toLowerCase()));

  let totalChunks = 0;

  for (const file of files) {
    const path = join(RAG_DIR, file);
    const content = await readFile(path, 'utf8');
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);

    // Skip if unchanged
    const existing = await openTable();
    if (existing) {
      const rows = await existing.query().where(`source = '${file}'`).toArray();
      if (rows.length > 0 && (rows[0] as Row).hash === hash) {
        console.log(`[rag] ${file}: без изменений`);
        continue;
      }
      await existing.delete(`source = '${file}'`);
    }

    const chunks = normalizeChunks(splitMarkdown(content));
    console.log(`[rag] ${file}: ${chunks.length} чанков`);

    const rows: Row[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      rows.push({
        id: `${file}:${i}`,
        vector: await embedDoc(c.text),
        text: c.text,
        source: file,
        heading: c.heading,
        hash,
      });
    }

    if (rows.length > 0) {
      const db = await lancedb.connect(DB_PATH);
      const tables = await db.tableNames();
      if (tables.includes(TABLE)) {
        const tbl = await db.openTable(TABLE);
        await tbl.add(rows);
      } else {
        await db.createTable(TABLE, rows);
      }
    }

    totalChunks += chunks.length;
  }

  return { files: files.length, chunks: totalChunks };
};

// ---------- Search ----------

export const searchKnowledge = async (
  query: string,
  limit = 8,
): Promise<SearchHit[]> => {
  const table = await openTable();
  if (!table) return [];

  const vector = await embedQuery(query);
  const rows = (await table.vectorSearch(vector).limit(limit).toArray()) as Array<
    Row & { _distance: number }
  >;

  return rows
    .map((r) => ({
      text: r.text,
      source: r.source,
      heading: r.heading,
      score: 1 - r._distance,
    }))
    .filter((h) => h.score >= MIN_SCORE);
};

// ---------- RAG context для инжекта в промпт ----------

/**
 * Возвращает строку для инжекта в системный промпт LLM.
 * `null` — если релевантных чанков нет (или база пуста).
 */
export const buildRagContext = async (
  query: string,
  limit = 5,
): Promise<string | null> => {
  const hits = await searchKnowledge(query, limit);
  if (hits.length === 0) return null;

  return hits
    .map((h, i) => `[${i + 1}] (${h.source} / ${h.heading})\n${h.text}`)
    .join('\n\n---\n\n');
};