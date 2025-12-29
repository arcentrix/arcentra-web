import axios from 'axios';

// 插件版本信息
export interface PluginVersion {
  name: string;
  version: string;
}

// 版本信息接口响应类型
export interface VersionInfo {
  version: string;
  gitBranch: string;
  gitCommit: string;
  buildTime: string;
  goVersion: string;
  compiler: string;
  platform: string;
  plugins?: PluginVersion[]; // 插件版本信息（可选）
}

// 创建独立的 axios 实例用于调用系统接口
const systemClient = axios.create({
  baseURL: '', // 使用空 baseURL，直接使用完整路径
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 全局请求去重：确保 /api/v1/version 在同一时间只请求一次
let pendingVersionRequest: Promise<VersionInfo> | null = null;

// 获取版本信息
// 接口路径是 /api/v1/version
export async function getVersionInfo(): Promise<VersionInfo> {
  // 如果已经有请求正在进行，直接返回该 Promise
  if (pendingVersionRequest) {
    return pendingVersionRequest;
  }

  // 创建新的请求
  const requestPromise = systemClient.get<any>('/api/v1/version')
    .then((response) => {
      // 请求完成后，清除 pending 状态
      pendingVersionRequest = null;
      // 处理响应格式：支持 { code, message, data } 和直接返回数据两种格式
      const data = response.data;
      if (data.code === 200 && data.data) {
        return data.data as VersionInfo;
      }
      return data as VersionInfo;
    })
    .catch((error) => {
      // 请求失败后，也要清除 pending 状态
      pendingVersionRequest = null;
      throw error;
    });

  // 将请求保存
  pendingVersionRequest = requestPromise;
  return requestPromise;
}

