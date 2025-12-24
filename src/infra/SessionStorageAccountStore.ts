import type { Account } from "../domain/types";
import type { AccountStore } from "../services/AccountStore";

const STORAGE_KEY = "textodon.accounts";

export class SessionStorageAccountStore implements AccountStore {
  load(): Account[] {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const data = JSON.parse(raw) as Account[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  save(accounts: Account[]): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }
}
