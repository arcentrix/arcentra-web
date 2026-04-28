/**
 * 组织状态管理
 * TODO: 实现组织状态管理逻辑
 */

import { create } from "zustand";
import type { Organization } from "@/models/organization";

interface OrganizationState {
  // 当前选中的组织
  currentOrganization: Organization | null;
  // 用户的所有组织
  organizations: Organization[];
  // 加载状态
  loading: boolean;
  // 错误信息
  error: string | null;

  // Actions
  setCurrentOrganization: (org: Organization | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // TODO: 实现以下方法
  // fetchOrganizations: () => Promise<void>
  // createOrganization: (data: CreateOrganizationRequest) => Promise<void>
  // updateOrganization: (id: string, data: UpdateOrganizationRequest) => Promise<void>
  // deleteOrganization: (id: string) => Promise<void>
}

export const useOrganizationStore = create<OrganizationState>((set) => ({
  currentOrganization: null,
  organizations: [],
  loading: false,
  error: null,

  setCurrentOrganization: (org) => set({ currentOrganization: org }),
  setOrganizations: (orgs) => set({ organizations: orgs }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // TODO: 实现 API 集成方法
}));
