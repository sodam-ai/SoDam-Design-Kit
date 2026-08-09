// SoDam-Design-Kit — 대시보드 클라이언트 (외부 파일 — CSP script-src 'self'만으로 동작,
// 인라인 <script> 금지. index.html이 body[data-token]에 토큰을 심어두면 이 파일이 읽어 씀).
//
// XSS 방어 원칙(01_PRD.md §6 — 판정서·콘솔 에러 문자열은 불신 입력): 이 파일 전체에서
// innerHTML을 단 한 번도 쓰지 않는다. 텍스트는 항상 textContent로만 넣는다.
(function () {
  const token = document.body.dataset.token;

  async function apiRequest(path) {
    const res = await fetch(path, { headers: { 'x-design-kit-token': token } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || ('요청 실패: ' + res.status));
    }
    return res;
  }

  async function apiJson(path) {
    return (await apiRequest(path)).json();
  }

  function badge(status) {
    const span = document.createElement('span');
    span.className = 'badge badge-' + (status === 'pass' ? 'pass' : 'fail');
    // 색상만으로 상태를 전달하지 않는다 — 아이콘+텍스트 병기 (04_PROJECT_SPEC.md DO NOT)
    span.textContent = status === 'pass' ? '✅ PASS' : '❌ FAIL';
    return span;
  }

  // <img src="...">는 커스텀 헤더(x-design-kit-token)를 보낼 수 없다 — fetch로 받아
  // Blob URL로 변환해서 넣는다(URL 파라미터에 토큰을 넣지 않음 — 히스토리·referrer 노출 방지).
  async function loadScreenshotInto(imgEl, screenshotUrl) {
    const res = await apiRequest(screenshotUrl);
    const blob = await res.blob();
    imgEl.src = URL.createObjectURL(blob);
  }

  function renderRunCard(run) {
    const card = document.createElement('div');
    card.className = 'run-card';

    const header = document.createElement('div');
    header.className = 'run-card-header';
    const title = document.createElement('span');
    title.className = 'run-id';
    title.textContent = run.runId; // textContent만 사용 — innerHTML 금지
    header.appendChild(title);
    header.appendChild(badge(run.status));
    card.appendChild(header);

    const target = document.createElement('div');
    target.className = 'run-target';
    target.textContent = run.target || '';
    card.appendChild(target);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'run-toggle';
    toggle.textContent = '판정서 보기';
    card.appendChild(toggle);

    const detail = document.createElement('div');
    detail.className = 'run-detail';
    detail.hidden = true;
    card.appendChild(detail);

    let loaded = false;
    toggle.addEventListener('click', async () => {
      detail.hidden = !detail.hidden;
      toggle.textContent = detail.hidden ? '판정서 보기' : '판정서 닫기';
      if (detail.hidden || loaded) return;
      loaded = true;
      try {
        const report = await apiJson('/api/reports/' + encodeURIComponent(run.runId));

        const pre = document.createElement('pre');
        pre.className = 'run-report-content';
        pre.textContent = report.content; // 판정서 원문(불신 입력) — textContent만 사용
        detail.appendChild(pre);

        if (report.screenshots && report.screenshots.length) {
          const shots = document.createElement('div');
          shots.className = 'screenshots';
          for (const s of report.screenshots) {
            const wrap = document.createElement('div');
            wrap.className = 'screenshot';
            const label = document.createElement('div');
            label.className = 'screenshot-label';
            label.textContent = s.viewport + 'px';
            const img = document.createElement('img');
            img.alt = s.viewport + 'px 스크린샷';
            wrap.appendChild(label);
            wrap.appendChild(img);
            shots.appendChild(wrap);
            loadScreenshotInto(img, '/api/screenshots/' + s.path).catch(() => {
              label.textContent += ' (로드 실패)';
            });
          }
          detail.appendChild(shots);
        }
      } catch (err) {
        const errorEl = document.createElement('div');
        errorEl.className = 'run-error';
        errorEl.textContent = '판정서를 불러오지 못했습니다: ' + err.message;
        detail.appendChild(errorEl);
      }
    });

    return card;
  }

  async function init() {
    const container = document.getElementById('runs');
    try {
      const data = await apiJson('/api/runs');
      if (!data.runs || !data.runs.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = '아직 실행 이력이 없습니다. /sodam-design-kit:pipeline을 먼저 실행하세요.';
        container.appendChild(empty);
        return;
      }
      for (const run of data.runs) {
        container.appendChild(renderRunCard(run));
      }
    } catch (err) {
      const errorEl = document.createElement('p');
      errorEl.className = 'load-error';
      errorEl.textContent = '이력을 불러오지 못했습니다: ' + err.message;
      container.appendChild(errorEl);
    }
  }

  init();
})();
