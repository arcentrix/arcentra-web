/**
 * 把后端返回的 SettingItem 按业务语义聚合成分组（前端硬编码映射）
 *
 * 后端响应里没有 category / displayName，这里给已知 name 一个友好的展示形态；
 * 未列入任何分组的 setting 仍可在 Advanced tab 里直接编辑原始 key-value。
 */

export interface SettingFieldDescriptor {
  /** 对应 SettingItem.name */
  settingName: string;
  /** 在 SettingItem.value 内部的字段路径（点分），不指定则展示整个 value */
  path?: string;
  /** 展示用名 */
  label: string;
  /** 简短描述 */
  description?: string;
  /** 单位后缀（仅显示用，不影响存储） */
  suffix?: string;
}

export interface SettingsGroup {
  id: "agents" | "retention";
  title: string;
  description: string;
  fields: SettingFieldDescriptor[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "agents",
    title: "Agents",
    description: "Agent runtime parameters and shared secrets.",
    fields: [
      {
        settingName: "AGENT_HEARTBEAT_EXPIRE_SECONDS",
        path: "expireAfterSeconds",
        label: "Heartbeat timeout",
        description:
          "Mark an agent offline after this many seconds without heartbeat.",
        suffix: "seconds",
      },
      {
        settingName: "AGENT_SECRET_KEY",
        path: "secret_key",
        label: "Agent secret key",
        description: "Shared secret used to authenticate agent connections.",
      },
      {
        settingName: "AGENT_SECRET_KEY",
        path: "salt",
        label: "Agent secret salt",
        description: "Salt mixed into the agent secret hashing.",
      },
      {
        settingName: "AGENT_AUTO_APPROVE",
        path: "auto_approve",
        label: "Auto-approve new agents",
        description:
          "When enabled, dynamically registered agents are approved automatically.",
      },
    ],
  },
  {
    id: "retention",
    title: "Retention",
    description: "How long the platform keeps historical data.",
    fields: [
      {
        settingName: "TASK_HISTORY_EXPIRE_SECONDS",
        path: "expireAfterSeconds",
        label: "Task history retention",
        description: "Task run history is removed after this duration.",
        suffix: "seconds",
      },
    ],
  },
];

/** 已知的 setting names（在 Advanced tab 之外被分组占用的），用来做 set 判断 */
export const GROUPED_SETTING_NAMES: Set<string> = new Set(
  SETTINGS_GROUPS.flatMap((g) => g.fields.map((f) => f.settingName)),
);
