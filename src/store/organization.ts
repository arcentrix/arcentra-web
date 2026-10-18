import { create } from "zustand";
import type { Organization } from "@/models/organization";

/** Optional navigation selection only. It never creates memberships or grants. */
interface OrganizationState {
  currentOrganization: Organization | null;
  setCurrentOrganization: (organization: Organization | null) => void;
  reset: () => void;
}
export const useOrganizationStore = create<OrganizationState>((set) => ({
  currentOrganization: null,
  setCurrentOrganization: (currentOrganization) => set({ currentOrganization }),
  reset: () => set({ currentOrganization: null }),
}));
