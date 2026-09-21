import type { ContractDocumentStore } from "./store.js";

export function memoryContractStore() {
  const files = new Map<string, Uint8Array>();
  const store: ContractDocumentStore = {
    async upload(path, body) {
      files.set(path, new Uint8Array(body));
    },
    async download(path) {
      const value = files.get(path);
      if (!value) throw new Error("Missing test document");
      return new Uint8Array(value);
    },
  };
  return { files, store };
}

