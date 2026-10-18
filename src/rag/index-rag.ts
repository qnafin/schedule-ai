import { indexKnowledge } from '../features/knowledge';

const main = async () => {
  console.log('[rag] индексация...');
  const t0 = Date.now();
  const result = await indexKnowledge();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[rag] готово за ${elapsed}s: files=${result.files} chunks=${result.chunks}`,
  );
};

main().catch((err) => {
  console.error('[rag] fatal:', err);
  process.exit(1);
});