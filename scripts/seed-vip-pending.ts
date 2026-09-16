/**
 * Seed ~2 months of pending VIP-client events (not distilled).
 * Usage: bun run scripts/seed-vip-pending.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { poolPendingPath } from "../server/paths.ts";

const START = "2026-07-16";
const END = "2026-09-16";

type Ev = { id: string; ts: string; raw: string; note: string };

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function at(day: string, hh: number, mm: number) {
  return `${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+08:00`;
}

function* eachDay() {
  const cur = new Date(`${START}T00:00:00+08:00`);
  const end = new Date(`${END}T00:00:00+08:00`);
  while (cur <= end) {
    yield ymd(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

function sid(n: number) {
  return n.toString(36).padStart(6, "0");
}

const events: Ev[] = [];
let n = 1;

function add(day: string, hh: number, mm: number, raw: string, note: string) {
  const compact = day.replaceAll("-", "");
  events.push({
    id: `evt_${compact}_${sid(n++)}`,
    ts: at(day, hh, mm),
    raw,
    note,
  });
}

const weekday = (day: string) => new Date(`${day}T12:00:00+08:00`).getDay();

for (const day of eachDay()) {
  const wd = weekday(day);
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const week = Math.floor((d - 1) / 7);

  // every day: at least one beat
  if (wd === 0) {
    add(day, 10, 20 + (d % 20), "週日早上把本週 VIP 待跟清單過一遍，標出下週要親訪的人。", "週日整理 VIP 跟進清單");
    if (d % 2 === 0) {
      add(day, 16, 5, "陳浩然傳了女兒在倫敦的近照，說下月可能順道來港；記得他喜歡帶普洱當手信。", "陳浩然女兒近況；手信普洱");
    } else {
      add(day, 19, 40, "晚上跟王建國傳了兩句，他週末球局打完，說下週二再談燈塔新店進度。", "王建國週末高爾夫後約下週二");
    }
    continue;
  }

  if (wd === 6) {
    add(day, 9, 15, "週六上午補記本週客戶偏好：誰改期、誰對座位／飲食有要求。", "週六補記客戶偏好");
    if (week === 1 || week === 3) {
      add(day, 14, 30, "陪王建國打了九洞。他提到大兒子今年考 DSE，不想週末晚上再約飯局。", "王建國兒子應考；週末不約晚飯");
    } else {
      add(day, 11, 50, "林美琪在群組問手沖豆，回她仍是淺焙、不加奶；她週三晚上從不應酬。", "林美琪手沖淺焙；週三不應酬");
    }
    continue;
  }

  // weekday morning
  add(
    day,
    8,
    25 + (d % 10),
    wd === 1
      ? "週一早會對齊本週 VIP：瀚海陳浩然、北灣林美琪、燈塔王建國、極光趙雪、新港周啟明、晴空吳佩珊。"
      : "早上先回 VIP 未讀：短訊只寫結論與下一步時間，細節另存。",
    wd === 1 ? "週一對齊六位主要 VIP" : "早上回未讀 VIP 短訊",
  );

  // rotate clients by day-of-month
  const slot = d % 6;
  if (slot === 0) {
    add(day, 10, 10, "與瀚海物流陳浩然通話，倉位仍緊。他嫌報價表小數點後太多位，下次改成整數噸。", "陳浩然倉位；報價改整數噸");
    add(day, 15, 40, "陳浩然助理說他下午只喝熟普，會議不要備咖啡；座位要靠窗否則容易煩。", "陳浩然熟普、靠窗");
  } else if (slot === 1) {
    add(day, 9, 40, "北灣資本林美琪過來看 Q3 數字。她素食、不吃蛋奶；簡報開頭先講風險再講機會。", "林美琪素食無蛋奶；簡報先風險");
    add(day, 14, 5, "林美琪說投委會週四才開，週三晚上她要接小孩，不要改到晚上。", "林美琪週三接小孩、週四投委");
  } else if (slot === 2) {
    add(day, 11, 0, "燈塔零售王建國現場走了一圈新店。他對工期延誤很敏感，要求每日一張照片進度。", "王建國新店工期；每日照片");
    add(day, 17, 20, "王建國問合約罰則怎麼寫。他記得上次供應商拖了兩週沒人扛責，這次要點名負責人。", "王建國要罰則與負責人");
  } else if (slot === 3) {
    add(day, 10, 50, "極光電子趙雪用日文夾雜中文開會。她不吃香菜，商務午餐不要壽司店的香菜莖。", "趙雪不吃香菜");
    add(day, 16, 15, "趙雪提到下月大阪出差，想順便見原廠。記得她偏好晚班飛機、酒店要禁煙樓層。", "趙雪大阪；晚班、禁煙樓層");
  } else if (slot === 4) {
    add(day, 11, 30, "新港地產周啟明談租約條款。他喝酒只碰波爾多，應酬不要清酒。", "周啟明波爾多、不喝清酒");
    add(day, 18, 45, "周啟明提過太太生日是 8 月 21 日，今年想提早走；那天不要排晚餐。", "周太太生日 8/21 不排晚餐");
  } else {
    add(day, 8, 35, "晴空醫療吳佩珊堅持 8:30 短會。美式無糖、不要甜點；會議超過 25 分鐘她會看錶。", "吳佩珊 8:30、美式無糖、短會");
    add(day, 13, 10, "吳佩珊關心學術會議名額，說若能帶兩位主任來會很高興。她不喜歡被抄送一大串人。", "吳佩珊帶主任；少抄送");
  }

  // extra weekly textures
  if (wd === 2 && m === 7) {
    add(day, 19, 10, "晚上請陳浩然小酌。他說女兒申請了倫敦的實習，若成行 9 月會路過香港兩晚。", "陳浩然女兒 9 月或過港");
  }
  if (wd === 4 && week === 2) {
    add(day, 12, 20, "中午與林美琪只吃沙拉。她提醒北灣內部稱呼她「林總」即可，不要在客人面前叫英文名 Maggie。", "林美琪對外稱林總");
  }
  if (day === "2026-07-28") {
    add(day, 20, 5, "王建國傳訊：燈塔股東會提前到 8 月 5 日。他要一頁紙說明合作對新店開業的幫助。", "燈塔股東會 8/5；一頁紙");
  }
  if (day === "2026-08-05") {
    add(day, 9, 0, "燈塔股東會。王建國會後說通過了，但要我們把開業日寫進備忘，不要口頭。", "股東會通過；開業日要書面");
    add(day, 16, 40, "會後茶敍王建國點了鐵觀音不是普洱，說那是陳浩然的習慣不是他的。", "王建國喝鐵觀音");
  }
  if (day === "2026-08-12") {
    add(day, 11, 15, "趙雪確認大阪行程 8 月 19–21 日。19 日晚上到、21 日下午會。不要安排 20 日早上，她要見原廠。", "趙雪大阪 8/19–21；20 日早見原廠");
  }
  if (day === "2026-08-19") {
    add(day, 21, 30, "趙雪報平安已到大阪。酒店禁煙樓層 OK。她說原廠對交期仍硬，明天再磨。", "趙雪抵阪；交期仍硬");
  }
  if (day === "2026-08-21") {
    add(day, 9, 20, "今天是周啟明太太生日，全天不排他的飯局；早上只傳一句恭喜，不談租約。", "周太太生日不談公事");
    add(day, 18, 0, "趙雪從大阪回了一句：原廠答應分批出貨。她人還在關西，明天才飛。", "趙雪原廠同意分批");
  }
  if (day === "2026-08-26") {
    add(day, 15, 0, "吳佩珊說 9 月學術會議能帶兩位主任。名牌不要寫職稱縮寫，要寫全名。", "吳佩珊名牌寫全名");
  }
  if (day === "2026-09-01") {
    add(day, 10, 0, "九月第一個工作日。陳浩然問女兒過港日期還未定，先不要訂房；普洱手信照舊準備。", "陳浩然女兒日期未定；手信照備");
  }
  if (day === "2026-09-08") {
    add(day, 14, 45, "林美琪投委出了條件清單，字很小。她說可以週末看，但週日晚上要陪家人。", "林美琪條件清單；週日晚陪家人");
  }
  if (day === "2026-09-11") {
    add(day, 11, 25, "王建國新店照片漏了一天，他當面不太高興。之後改成每天 18:00 前固定傳。", "王建國要每日 18:00 前照片");
  }
  if (day === "2026-09-15") {
    add(day, 16, 50, "周啟明租約還差一條提前解約。他說這週不要逼，下週一再開。紅酒仍點波爾多。", "周啟明解約條款下週一；波爾多");
  }
  if (day === "2026-09-16") {
    add(day, 9, 5, "今天把兩個月 VIP 筆記堆進工具：之後要靠沉澱把人、喜好、大小事連起來。", "開始用工具沉澱 VIP 細節");
    add(day, 18, 10, "吳佩珊問會議胸牌樣張。回她用全名、無糖美式會備在會場後門，不要放主席台。", "吳佩珊胸牌全名；咖啡放後門");
  }
}

const path = poolPendingPath();
await mkdir(dirname(path), { recursive: true });
const body = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
await writeFile(path, body);
console.log(`wrote ${events.length} events  ${START}..${END}  ${path}`);
