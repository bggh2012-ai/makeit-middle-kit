// 내 커스텀 키트 만들기 — 수강생 깃허브에 이 키트의 복사본(포크)을 만들고, 그 복사본으로 도는 새 폴더를 만든다.
//
// 2026-10-17 진현님 지시: "수강생이 코덱스에 특정 명령어를 넣으면 수강생 깃허브에 프로젝트가 추가돼서 그걸로 커스텀 마음대로.
//   원본은 그대로 쓸 수 있게 하고, 커스텀할 건 따로 아예 프로젝트를 만든다." + "절대 수강생들 각자 로컬에서 하게 하면 안 돼."
//
//   · 원래 폴더와 원본 키트는 그대로 둔다. 새 폴더(«부모 폴더»/메킷 커스텀 키트)에 '내 저장소로 도는 대본'만 깐다.
//   · 코드는 수강생 깃허브에만 있다. 이 PC 에는 내려받지 않는다 (실행할 때만 로더가 임시 폴더로 받았다가 지운다).
//   · 고치는 것은 온라인(코덱스 웹 chatgpt.com/codex)에서만 한다. 고쳐서 병합하면 새 폴더에서 다음 실행부터 바로 쓰인다.
//   · 깃허브 로그인·가입은 수강생이 한다. 이 프로그램은 포크 화면의 'Create fork' 한 번만 누른다. 못 누르면 수강생에게 누르라고 한다.
//
//   앱.커스텀.크롬확장()                          → 크롬 확장 import 주소 (없으면 "")
//   앱.커스텀.만들기({agent, 작업폴더, 확인만})     → {결과: "됨" | "로그인 필요" | "직접" | "옛 복사본" | "이미 커스텀" | "멈춤", …}

import {copyFile, mkdir, readFile, stat} from "node:fs/promises";
import {homedir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

export const 버전 = "2026-10-17a";

const 여기 = dirname(fileURLToPath(import.meta.url));
const 공식저장소 = "makeit-edu/makeit-middle-kit";
const 포크화면 = `https://github.com/${공식저장소}/fork`;
const 새폴더이름 = "메킷 커스텀 키트";
const 저장소줄 = /let 저장소 ?= ?"([A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+)";/;
const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));
const 작게 = (s) => String(s || "").toLowerCase();

// 지금 이 키트가 어느 저장소에서 왔는지 — 로더가 임시 폴더의 대본(앱/AGENTS.md) 저장소 줄을 이 키트의 저장소로 맞춰 둔다.
async function 이키트저장소() {
  try {
    const m = 저장소줄.exec(await readFile(join(여기, "AGENTS.md"), "utf8"));
    if (m?.[1]) return m[1];
  } catch {}
  return 공식저장소;
}

// 크롬 확장 주소 — 네이버와 같은 것을 쓴다. agent 는 대본(채팅 창 최상위)에서 이 주소로 만든다 (확장이 그 자리에서만 붙는다).
export async function 크롬확장() {
  try {
    const 타이핑 = await import(`${pathToFileURL(join(여기, "네이버", "naver-typing.mjs")).href}?t=${Date.now()}`);
    return pathToFileURL(타이핑.클라이언트경로()).href;
  } catch {
    return "";
  }
}

// ───────── 깃허브 (공개 API · raw) ─────────
// 공개 API 는 로그인 없이 시간당 60번까지라 몇 번만 쓴다. 준비됐는지는 raw(제한 넉넉)로 본다.
async function API(경로) {
  const r = await fetch(`https://api.github.com${경로}`, {headers: {Accept: "application/vnd.github+json"}, cache: "no-store", signal: AbortSignal.timeout(15000)});
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`깃허브 API ${r.status}`);
  return r.json();
}
const 원본의포크 = (저장소) => Boolean(저장소?.fork) && [저장소?.parent?.full_name, 저장소?.source?.full_name].some((n) => 작게(n) === 공식저장소);

// 이 계정에 원본의 포크가 있는지 (이름을 바꿨어도 찾는다). 같은 이름의 다른 저장소가 있으면 이름겹침.
async function 포크찾기(아이디) {
  let 이름겹침 = false;
  const 바로 = await API(`/repos/${아이디}/makeit-middle-kit`).catch(() => undefined);
  if (바로 && 원본의포크(바로)) return {저장소: 바로.full_name, 이름겹침};
  if (바로) 이름겹침 = true;
  for (let 쪽 = 1; 쪽 <= 5; 쪽++) {
    const 목록 = await API(`/repos/${공식저장소}/forks?per_page=100&sort=newest&page=${쪽}`).catch(() => null);
    if (!Array.isArray(목록) || !목록.length) break;
    const 내것 = 목록.find((f) => 작게(f?.owner?.login) === 작게(아이디));
    if (내것) return {저장소: 내것.full_name, 이름겹침};
    if (목록.length < 100) break;
  }
  return {저장소: "", 이름겹침};
}

// 포크가 다 만들어졌고(파일이 보이고) 내 커스텀 키트로 돌 수 있는 판인지 — 대본에 저장소 줄이 있어야 한다 (2026-10-17 이후 판).
async function 복사본상태(저장소) {
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${저장소}/main/${encodeURIComponent("앱")}/AGENTS.md?t=${Date.now()}`, {cache: "no-store", signal: AbortSignal.timeout(15000)});
    if (!r.ok) return {있음: false, 지원: false};
    return {있음: true, 지원: 저장소줄.test(await r.text())};
  } catch {
    return {있음: false, 지원: false};
  }
}

// ───────── 크롬 ─────────
async function 탭열기(agent, 주소) {
  if (agent.documentation && typeof agent.documentation.get === "function") {
    for (const 문서 of ["confirmations", "capabilities/tab/cdp", "accessibility"]) {
      try { await agent.documentation.get(문서); } catch {}
    }
  }
  const chrome = await agent.browsers.get("chrome");
  const tab = await chrome.tabs.new();
  await tab.goto(주소);
  // 로그인·직접 누르기처럼 수강생이 이 탭에서 이어 할 수 있게 턴이 끝나도 남긴다
  try { if (typeof tab.markHandoff === "function") await tab.markHandoff(); } catch {}
  return tab;
}
const 탭주소 = async (tab) => String(await Promise.resolve(tab.url()).catch(() => "") || "");
const 로그인화면 = (주소) => /github\.com\/(login|session|signup|join)\b/.test(주소);

// 화면 정보: 로그인 아이디, 'Create fork' 버튼 자리·켜짐, 이름 겹침 안내
async function 포크화면읽기(tab) {
  return tab.playwright.evaluate(() => {
    const 아이디 = document.querySelector('meta[name="user-login"]')?.getAttribute("content") || "";
    let 버튼 = null;
    for (const b of document.querySelectorAll("button")) {
      const 글 = String(b.innerText || b.textContent || "").replace(/\s+/g, " ").trim();
      if (글 !== "Create fork") continue;
      const r = b.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      버튼 = {x: r.left + r.width / 2, y: r.top + r.height / 2, 꺼짐: Boolean(b.disabled) || b.getAttribute("aria-disabled") === "true"};
      break;
    }
    const 본문 = String(document.body?.innerText || "");
    return {아이디, 버튼, 화면높이: innerHeight, 화면너비: innerWidth, 이미있음: /already exists|already forked|already have a fork/i.test(본문)};
  });
}

async function 포크누르기(tab) {
  const 기록 = [];
  for (let i = 0; i < 4; i++) {
    const 화면 = await 포크화면읽기(tab);
    const b = 화면.버튼;
    if (!b) { 기록.push("버튼 못 찾음"); await 쉬기(1500); continue; }
    if (b.꺼짐) return {누름: false, 기록: [...기록, "버튼이 꺼져 있음"]};
    // 화면 밖이면 그만큼 내린다 (ax.scroll 의 세 번째 값은 '화면 한 장' 단위)
    if (b.y < 60 || b.y > 화면.화면높이 - 40) {
      const 델타 = b.y - 화면.화면높이 / 2;
      try { await tab.ax.scroll([Math.round(화면.화면너비 / 2), Math.round(화면.화면높이 / 2)], 델타 > 0 ? "down" : "up", Math.max(0.05, Math.min(3, Math.abs(델타) / Math.max(300, 화면.화면높이)))); } catch {}
      await 쉬기(600);
      기록.push("화면 내림");
      continue;
    }
    try {
      await tab.ax.click([Math.round(b.x), Math.round(b.y)]);
      return {누름: true, 방법: "좌표", 기록};
    } catch (e) {
      기록.push("좌표 클릭 실패: " + String(e?.message || e).slice(0, 60));
      break;
    }
  }
  // 예비: 이름으로 찾아 누르기 (일반 화면에서는 이것도 된다)
  try {
    await tab.playwright.getByRole("button", {name: "Create fork", exact: true}).first().click({timeoutMs: 8000});
    return {누름: true, 방법: "이름", 기록};
  } catch (e) {
    기록.push("이름 클릭 실패: " + String(e?.message || e).slice(0, 60));
  }
  return {누름: false, 기록};
}

// 포크가 생길 때까지 (최대 약 90초). 탭이 새 저장소로 넘어가면 그 이름을, 아니면 계정에서 찾는다.
async function 생길때까지(tab, 아이디, 초 = 90) {
  const 끝 = Date.now() + 초 * 1000;
  let 마지막API = 0;
  while (Date.now() < 끝) {
    const 주소 = tab ? await 탭주소(tab) : "";
    const m = new RegExp(`^https://github\\.com/(${아이디.replace(/[^A-Za-z0-9-]/g, "")})/([A-Za-z0-9._-]+)(?:[/?#]|$)`, "i").exec(주소);
    if (m && 작게(`${m[1]}/${m[2]}`) !== 공식저장소) {
      const 후보 = `${m[1]}/${m[2]}`;
      if ((await 복사본상태(후보)).있음) return 후보;
    }
    if (Date.now() - 마지막API > 15000) {
      마지막API = Date.now();
      const {저장소} = await 포크찾기(아이디).catch(() => ({저장소: ""}));
      if (저장소 && (await 복사본상태(저장소)).있음) return 저장소;
    }
    await 쉬기(3000);
  }
  return "";
}

// ───────── 새 폴더 ─────────
async function 폴더있나(경로) {
  try { return (await stat(경로)).isDirectory(); } catch { return false; }
}
async function 새폴더준비(작업폴더) {
  for (const 부모 of [dirname(작업폴더), homedir()]) {
    const 경로 = join(부모, 새폴더이름);
    if (경로 === 작업폴더) continue;
    try {
      const 있었음 = await 폴더있나(경로);
      await mkdir(경로, {recursive: true});
      return {경로, 있었음};
    } catch {}
  }
  throw new Error("새 폴더를 만들지 못했습니다");
}

// 키 설정(수강 코드·OpenAI 키·워드프레스 연결)을 새 폴더로 — 이 PC 안에서만 복사한다. 새 폴더에 이미 있으면 그대로 둔다.
async function 설정옮기기(작업폴더, 새폴더) {
  const 원본 = join(작업폴더, "애드센스 승인글", "00_설정", "설정.json");
  const 대상 = join(새폴더, "애드센스 승인글", "00_설정", "설정.json");
  try { await stat(원본); } catch { return false; }
  try { await stat(대상); return true; } catch {}
  await mkdir(dirname(대상), {recursive: true});
  await copyFile(원본, 대상);
  return true;
}

// ───────── 대본에서 부르는 함수 ─────────
export async function 만들기({agent, 작업폴더, 확인만 = false} = {}) {
  if (!작업폴더) throw new Error("작업폴더 가 필요합니다");
  const 지금저장소 = await 이키트저장소();
  if (작게(지금저장소) !== 공식저장소) return {결과: "이미 커스텀", 저장소: 지금저장소, 저장소주소: `https://github.com/${지금저장소}`};
  if (!agent) return {결과: "멈춤", 원인: "크롬과 코덱스가 연결돼 있지 않아요", 할일: "크롬을 켜고 오른쪽 위 퍼즐 모양에서 ChatGPT(Codex) 확장이 켜져 있는지 확인한 뒤 다시 '내 커스텀 키트 만들어줘' 라고 하세요."};

  const 기록 = [];
  let tab = null;
  try {
    // 1. 포크 화면 — 로그인 안 돼 있으면 깃허브가 로그인 화면으로 보낸다
    tab = await 탭열기(agent, 포크화면);
    await 쉬기(4000);
    let 화면 = null;
    for (let i = 0; i < 5; i++) {
      const 주소 = await 탭주소(tab);
      if (로그인화면(주소)) return {결과: "로그인 필요", 주소: 포크화면};
      화면 = await 포크화면읽기(tab).catch(() => null);
      if (화면?.아이디) break;
      await 쉬기(1500);
    }
    if (!화면?.아이디) return {결과: "로그인 필요", 주소: 포크화면};
    const 아이디 = 화면.아이디;
    기록.push(`깃허브 ${아이디}`);

    // 2. 이미 만든 복사본이 있으면 그걸 쓴다 (다시 만들지 않는다)
    const 찾음 = await 포크찾기(아이디).catch(() => ({저장소: "", 이름겹침: false}));
    let 저장소 = 찾음.저장소;
    let 새로만듦 = false;
    if (!저장소) {
      if (확인만) {
        저장소 = await 생길때까지(null, 아이디, 30);
        if (!저장소) return {결과: "직접", 주소: 포크화면, 이름겹침: 찾음.이름겹침, 안내: "아직 내 깃허브에 복사본이 안 보여요"};
      } else {
        // 3. 'Create fork' 누르기 — 같은 이름 저장소가 이미 있으면 깃허브가 버튼을 꺼 둔다 (이름을 바꾸는 건 수강생이 한다)
        if (찾음.이름겹침) return {결과: "직접", 주소: 포크화면, 이름겹침: true};
        const 누름 = await 포크누르기(tab);
        기록.push(...누름.기록);
        if (!누름.누름) return {결과: "직접", 주소: 포크화면, 이름겹침: 화면.이미있음, 기록};
        저장소 = await 생길때까지(tab, 아이디, 90);
        if (!저장소) return {결과: "직접", 주소: 포크화면, 안내: "Create fork 를 눌렀는데 1분 넘게 복사본이 안 보여요", 기록};
      }
      새로만듦 = true;
    }

    // 4. 복사본이 옛 판이면(2026-10-17 전에 복사) 원본 새 내용을 먼저 받아야 내 커스텀 키트로 돈다
    let 상태 = await 복사본상태(저장소);
    for (let i = 0; !상태.있음 && i < 10; i++) { await 쉬기(3000); 상태 = await 복사본상태(저장소); }
    if (!상태.있음) return {결과: "멈춤", 원인: "내 깃허브 복사본의 파일이 아직 안 보여요", 할일: "1~2분 뒤 '내 커스텀 키트 만들어줘' 라고 다시 말해 주세요.", 저장소, 저장소주소: `https://github.com/${저장소}`};
    if (!상태.지원) return {결과: "옛 복사본", 저장소, 저장소주소: `https://github.com/${저장소}`};

    // 5. 새 폴더에 '내 저장소로 도는 대본' 깔기 (설치와 같은 일 — 저장소만 내 것)
    const {경로: 새폴더, 있었음} = await 새폴더준비(작업폴더);
    const {설치} = await import(`${pathToFileURL(join(여기, "설치.mjs")).href}?t=${Date.now()}`);
    const 설치결과 = await 설치({작업폴더: 새폴더, 저장소});
    if (설치결과.결과 !== "설치 끝") return {결과: "멈춤", 원인: "새 폴더에 내 커스텀 키트를 깔다가 멈췄어요", 할일: "1~2분 뒤 '내 커스텀 키트 만들어줘' 라고 다시 말해 주세요.", 저장소, 저장소주소: `https://github.com/${저장소}`, 폴더: 새폴더, 설치: 설치결과.결과};
    const 설정옮김 = await 설정옮기기(작업폴더, 새폴더).catch(() => false);
    return {결과: "됨", 저장소, 저장소주소: `https://github.com/${저장소}`, 폴더: 새폴더, 새로만듦, 폴더있었음: 있었음, 설정옮김, 기록};
  } catch (e) {
    return {결과: "멈춤", 원인: `내 커스텀 키트를 만들다 멈췄어요: ${String(e?.message || e).split("\n")[0].slice(0, 120)}`, 할일: "크롬 창을 맨 앞에 두고 1~2분 뒤 '내 커스텀 키트 만들어줘' 라고 다시 말해 주세요.", 기록};
  }
}
