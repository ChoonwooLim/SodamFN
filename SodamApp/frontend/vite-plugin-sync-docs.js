/**
 * vite-plugin-sync-docs
 *
 * 프로젝트 루트의 설계 문서(.md)를 frontend/src/content/ 로 자동 복사한다.
 *
 * ─ 동작 ─
 * • dev:   설계 문서 변경 시 자동 복사 → HMR 트리거
 * • build: buildStart 훅에서 동기 복사 (로컬 빌드 시만 해당)
 * • Orbitron 배포: 원본 파일이 존재하지 않으면 조용히 skip →
 *                  기존 `src/content/*.md` (git 커밋본) 이 사용된다
 *
 * ─ 확장 ─
 * 새 문서를 뷰어에 추가하려면 mappings 배열에 { src, dst } 추가만 하면 된다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function syncDocsPlugin(options = {}) {
  const mappings = options.mappings || [
    {
      // canonical 설계 문서
      src: path.resolve(__dirname, '../../docs/superpowers/specs/2026-04-11-ai-gateway-phase1-design.md'),
      dst: path.resolve(__dirname, 'src/content/ai-gateway-phase1-design.md'),
    },
  ];

  const syncOne = ({ src, dst }) => {
    if (!fs.existsSync(src)) return false; // Orbitron 환경 등에서는 원본 없음 → skip
    try {
      const srcContent = fs.readFileSync(src, 'utf8');
      const dstExists = fs.existsSync(dst);
      const dstContent = dstExists ? fs.readFileSync(dst, 'utf8') : null;
      if (dstContent === srcContent) return false;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, srcContent, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`[sync-docs] ${path.basename(src)} → src/content/`);
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[sync-docs] failed to sync ${src}:`, err.message);
      return false;
    }
  };

  const syncAll = () => mappings.forEach(syncOne);

  return {
    name: 'sync-docs',
    enforce: 'pre',

    buildStart() {
      syncAll();
    },

    configureServer(server) {
      syncAll();
      // 원본 파일을 watch 에 추가 (프로젝트 루트 외부라도)
      for (const m of mappings) {
        if (fs.existsSync(m.src)) server.watcher.add(m.src);
      }
      server.watcher.on('change', (file) => {
        const normalized = path.normalize(file);
        const hit = mappings.find((m) => path.normalize(m.src) === normalized);
        if (hit) {
          const changed = syncOne(hit);
          if (changed) {
            // 복사본을 import 하는 모듈을 HMR 로 갱신
            const mod = server.moduleGraph.getModulesByFile(hit.dst);
            if (mod) mod.forEach((m) => server.reloadModule(m));
          }
        }
      });
    },
  };
}
