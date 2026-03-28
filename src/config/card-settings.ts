export const cardSettings = {
  lockedTitlePrefix: "mnote",
  defaultPermissions: {
    canEditCard: true,
    canDeleteCard: true,
    canAddExpense: true,
    canEditExpense: true,
    canDeleteExpense: true,
    canAddCalendar: true,
    canEditCalendar: true,
    canDeleteCalendar: true,
  },
  lockedPermissions: {
    canEditCard: false,
    canDeleteCard: false,
    canAddExpense: true,
    canEditExpense: false,
    canDeleteExpense: false,
    canAddCalendar: true,
    canEditCalendar: false,
    canDeleteCalendar: false,
  },
} as const;

export function normalizeCardTitle(title: string) {
  return title.trim().toLowerCase();
}

export function isLockedCardTitle(title: string) {
  return normalizeCardTitle(title).startsWith(cardSettings.lockedTitlePrefix);
}

export function getCardPermissions(title: string) {
  return isLockedCardTitle(title)
    ? cardSettings.lockedPermissions
    : cardSettings.defaultPermissions;
}
