export const normalizeInstanceUrl = (input: string): string => {
  const trimmed = input.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const createAccountId = (): string => crypto.randomUUID();

export const formatHandle = (handle: string, instanceUrl: string): string => {
  if (!handle) {
    return "";
  }
  if (handle.includes("@")) {
    return handle;
  }
  try {
    const host = new URL(instanceUrl).hostname;
    return `${handle}@${host}`;
  } catch {
    return handle;
  }
};

export const formatReplyHandle = (
  accountHandle: string,
  accountUrl: string | null,
  currentAccountInstanceUrl: string
): string => {
  if (!accountHandle) {
    return "";
  }
  
  // If handle already includes domain, return as-is
  if (accountHandle.includes("@")) {
    return accountHandle;
  }
  
  // Try to determine if user is from the same server
  if (accountUrl) {
    try {
      const userHost = new URL(accountUrl).hostname;
      const currentHost = new URL(currentAccountInstanceUrl).hostname;
      
      // If different servers, use full handle
      if (userHost !== currentHost) {
        return `${accountHandle}@${userHost}`;
      }
    } catch {
      // If URL parsing fails, fall back to simple handle
      return accountHandle;
    }
  }
  
  // Same server or couldn't determine, use simple handle
  return accountHandle;
};

export const parseAccountLabel = (
  label: string
): { displayName: string; handle: string } | null => {
  const match = label.match(/^(.*)\\s+@([^\\s]+)$/);
  if (!match) {
    return null;
  }
  return { displayName: match[1].trim(), handle: match[2].trim() };
};
