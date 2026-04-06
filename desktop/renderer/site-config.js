"use strict";
const SITE_PRESETS = [
    {
        id: "novelpia",
        key: "1",
        name: "Novelpia",
        url: "https://novelpia.com/",
        loginUrl: "https://novelpia.com/page/login"
    },
    {
        id: "munpia",
        key: "2",
        name: "Munpia",
        url: "https://novel.munpia.com/",
        loginUrl: "https://nssl.munpia.com/login"
    },
    {
        id: "kakaopage",
        key: "3",
        name: "KakaoPage",
        url: "https://page.kakao.com/",
        loginUrl: "https://accounts.kakao.com/login/?continue=https%3A%2F%2Fpage.kakao.com%2F"
    },
    {
        id: "joara",
        key: "4",
        name: "Joara",
        url: "https://www.joara.com/",
        loginUrl: "https://auth.joara.com/"
    }
];
function getPresetHomeUrl(site) {
    return site?.mobileUrl || site?.url || "";
}
function getPresetLoginUrl(site) {
    return site?.mobileLoginUrl || site?.loginUrl || getPresetHomeUrl(site);
}
function getPresetMeta(site) {
    return `${site.mobileUrl ? "Mobile" : "Quick"} | Ctrl+${site.key}`;
}
