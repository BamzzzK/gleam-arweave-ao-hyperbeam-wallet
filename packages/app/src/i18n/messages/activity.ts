import { defineMessages } from "../define";

export const activity = defineMessages({
  en: {
    avatarOf: "{name} avatar",
    addressAvatar: "Address avatar",
    overBalance: "That's more than your current balance.",
    overBalanceWithFeeNewAddress:
      "This address is new to Arweave, so the network fee is {fee}. That plus this amount is more than your balance.",
    overBalanceWithFee: "The network fee is {fee}. That plus this amount is more than your balance.",
  },
  "zh-CN": {
    avatarOf: "{name}的头像",
    addressAvatar: "地址头像",
    overBalance: "超出了当前余额。",
    overBalanceWithFeeNewAddress: "该地址是 Arweave 上的新地址，网络手续费为 {fee}。加上本次金额后超出了你的余额。",
    overBalanceWithFee: "网络手续费为 {fee}。加上本次金额后超出了你的余额。",
  },
  "zh-TW": {
    avatarOf: "{name}的頭像",
    addressAvatar: "地址頭像",
    overBalance: "超出了目前餘額。",
    overBalanceWithFeeNewAddress: "此地址是 Arweave 上的新地址，網路手續費為 {fee}。加上本次金額後超出了你的餘額。",
    overBalanceWithFee: "網路手續費為 {fee}。加上本次金額後超出了你的餘額。",
  },
});
