export type Notice = {
  kind: string;
  message: string;
  createdAt: string;
};

export function buildNotice(kind: string, message: string, createdAt: string): Notice {
  return { kind, message, createdAt };
}
