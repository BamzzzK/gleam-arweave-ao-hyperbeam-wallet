import { defineMessages } from "../define";

export const connectedApps = defineMessages({
  en: {
    title: "Connected apps",
    empty: "No apps connected yet. Grants you approve will show up here.",
    scopePayments: "Sees your address, can request payments",
    scopeMore: "Sees your address and more",
    scopeAddress: "Sees your address only",
    noExpiry: "No expiry · until revoked",
    expiresOneDay: "Expires in {days} day",
    expiresDays: "Expires in {days} days",
    revoke: "Revoke",
  },
  "zh-CN": {
    title: "已连接的应用",
    empty: "尚未连接任何应用。你批准的授权会显示在这里。",
    scopePayments: "可查看你的地址，可发起付款请求",
    scopeMore: "可查看你的地址及更多信息",
    scopeAddress: "仅可查看你的地址",
    noExpiry: "无到期时间 · 撤销前一直有效",
    expiresOneDay: "{days} 天后到期",
    expiresDays: "{days} 天后到期",
    revoke: "撤销",
  },
  "zh-TW": {
    title: "已連接的應用程式",
    empty: "尚未連接任何應用程式。你批准的授權會顯示在這裡。",
    scopePayments: "可檢視你的地址，可發起付款請求",
    scopeMore: "可檢視你的地址及更多資訊",
    scopeAddress: "僅可檢視你的地址",
    noExpiry: "無到期時間 · 撤銷前一直有效",
    expiresOneDay: "{days} 天後到期",
    expiresDays: "{days} 天後到期",
    revoke: "撤銷",
  },
});
