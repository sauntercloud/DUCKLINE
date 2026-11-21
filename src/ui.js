export const $ = (id) => document.getElementById(id);
const icons = {
  sound:
    '<path d="M4 9h4l4-4v14l-4-4H4zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M4 9h4l4-4v14l-4-4H4zM16 9l6 6m0-6-6 6"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3"/>',
  settings:
    '<path d="m10 3-.6 2.3-2 .9-2-.8L3.5 9l1.6 1.6v2.8L3.5 15l1.9 3.6 2-.8 2 .9.6 2.3h4l.6-2.3 2-.9 2 .8 1.9-3.6-1.6-1.6v-2.8L20.5 9l-1.9-3.6-2 .8-2-.9L14 3z"/><circle cx="12" cy="12" r="3"/>',
  flag: '<path d="M5 21V4m1 1c4-3 7 3 13 0v9c-5 3-9-3-13 0"/>',
  clock: '<circle cx="12" cy="12" r="8.7"/><path d="M12 6.5v6l4 2"/>',
  expand: '<path d="M14 4h6v6M20 4l-6 6M10 20H4v-6m0 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4m-9 4v10M7 5l9 4"/>',
  exit: '<path d="M11 4H4v16h7m2-13 5 5-5 5m-5-5h12"/>',
};
export const icon = (n) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  icons[n] +
  "</svg>";
export const equipment = [
  '<path fill="#525852" d="m7 28 11-3 6-9h33l6-3h22v4h13v4H82l-8 4H55l-2 10-7-2 2-10h-8l-3 8-5-2 2-8h-8l-7 8-10 2z"/><path fill="#b9b7a2" d="M7 24h12l6-8h30v6H25l-7 6H7z"/><path fill="#777c6b" d="M55 14h25v8H55z"/><path stroke="#303631" stroke-width="2" d="M60 15v6m5-6v6m5-6v6m5-6v6"/><path fill="#bdbba7" d="M80 16h15v3H80z"/><path fill="#929988" d="M35 12h10v5H35z"/><path fill="#373e38" d="M37 13h6v3h-6zm57 2h6v6h-6z"/>',
  '<path fill="#9c9f91" d="m30 15 42-1 2 6-5 3H47l-2 14-12-1 4-14-7-2z"/><path fill="#4e5650" d="M32 19h39l-3 5H52c-1 6-4 7-8 6l-1 8-12-1 5-15h-4z"/><path fill="none" stroke="#a4a796" d="m47 24-2 4q6 1 7-4"/><path stroke="#454b46" d="m34 15-1 4m4-4-1 4m4-4-1 4m4-4-1 4"/>',
  '<path fill="#727c65" d="m32 12 9-6 26 4 7 7-3 18-34 2-7-6z"/><path fill="#9aa28a" d="m32 12 10-6 25 4 7 6-36 3z"/><path fill="#525b4f" d="m64 13 7 3-2 18-5 1z"/><path fill="#b8b4a0" d="m43 17 11-1-1 20-12 1z"/><path fill="#a65445" d="M45 20h4v3h4v4h-4v4h-4v-4h-4v-4h4z"/>',
  '<path fill="#767b65" d="m38 13 3-6 16-1 5 5 4 4 3 18-6 5-28-2-2-6z"/><path fill="none" stroke="#b4b29c" stroke-width="2" d="M44 9q0-7 9-5l4 5"/><path fill="#525b51" d="M36 17h29l-2 7H38z"/><path fill="#8b9179" d="M40 25h20v10H40z"/><path stroke="#343d36" stroke-width="3" d="M41 12v14m17-14v14"/>',
];
export const art = (i) =>
  '<svg viewBox="0 0 106 44" aria-hidden="true">' + equipment[i] + "</svg>";
export function initUI() {
  $("brandlogo").innerHTML =
    '<svg viewBox="0 0 42 35" fill="currentColor"><path d="m3 23 10 1-8-7 10 2c-2-7 3-15 11-15 7 0 11 4 12 10l4 3-7 3c-2 8-9 13-17 12C10 32 6 28 3 23z"/><path fill="#171b1a" d="m17 13 16-1 1 3-18 2z"/><circle cx="31" cy="17" r="1.4" fill="#171b1a"/></svg>';
  for (const [id, n] of [
    ["pause", "pause"],
    ["settings", "settings"],
    ["sound", "sound"],
    ["clockIcon", "clock"],
    ["flagIcon", "flag"],
  ])
    $(id).innerHTML = icon(n);
  document.querySelector(".mapExpand").innerHTML = icon("expand");
  $("hotbar").innerHTML = ["主武器", "副武器", "医疗包", "背包"]
    .map(
      (name, i) =>
        '<button class="slot ' +
        (i === 0 ? "active" : "") +
        '" data-slot="' +
        i +
        '" aria-label="' +
        name +
        '" title="' +
        name +
        '"><kbd>' +
        ["1", "2", "3", "TAB"][i] +
        "</kbd>" +
        art(i) +
        (i === 2 ? '<small id="medcount">×2</small>' : "") +
        "</button>",
    )
    .join("");
}
