// Accounts sign in with a username; auth needs an email, so we derive a fixed internal one.
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@bestatahalak.local`;

export type AppRole = "supervisor" | "manager" | "employee";

export const roleLabel: Record<AppRole, string> = {
  supervisor: "سوبر فايزر",
  manager: "مدير",
  employee: "موظف",
};
