import { defineMessages } from "../define";

export const displayCurrency = defineMessages({
  en: {
    title: "Currency",
    searchLabel: "Search currencies",
    searchPlaceholder: "Search",
    sectionTokens: "Tokens",
    sectionCurrencies: "Currencies",
    noMatch: "No currency matches “{query}”.",
  },
  "zh-CN": {
    title: "货币",
    searchLabel: "搜索货币",
    searchPlaceholder: "搜索",
    sectionTokens: "代币",
    sectionCurrencies: "法定货币",
    noMatch: "没有与“{query}”匹配的货币。",
  },
  "zh-TW": {
    title: "貨幣",
    searchLabel: "搜尋貨幣",
    searchPlaceholder: "搜尋",
    sectionTokens: "代幣",
    sectionCurrencies: "法定貨幣",
    noMatch: "沒有與「{query}」相符的貨幣。",
  },
});
