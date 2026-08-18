import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useAccounting } from "@/lib/accounting";
import { trpc } from "@/lib/trpc";

/** Applies authenticated server-created due postings to the local double-entry ledger. */
export function InstallmentPostingSync() {
  const { isAuthenticated } = useAuth();
  const { state, addJournalEntry, updateInstallmentSchedule } = useAccounting();
  const postingsQuery = trpc.installments.postings.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60_000 });

  useEffect(() => {
    if (!postingsQuery.data?.length) return;
    let cancelled = false;
    const syncPostings = async () => {
      for (const posting of postingsQuery.data) {
        if (cancelled) return;
        const installment = state.installments.find((candidate) => candidate.id === posting.scheduleId);
        const debitAccount = state.accounts.find((candidate) => candidate.code.toLocaleLowerCase() === posting.debitAccountCode.toLocaleLowerCase());
        const creditAccount = state.accounts.find((candidate) => candidate.code.toLocaleLowerCase() === posting.creditAccountCode.toLocaleLowerCase());
        if (!installment || !debitAccount || !creditAccount) continue;
        const alreadyApplied = state.journalEntries.some((entry) => entry.source?.type === "installment" && entry.source.externalEntryId === posting.id);
        try {
          if (!alreadyApplied) {
            await addJournalEntry({
              description: posting.description,
              date: posting.dueDate,
              source: { type: "installment", installmentId: installment.id, periodKey: posting.periodKey, externalEntryId: posting.id },
              lines: [
                { accountId: debitAccount.id, category: debitAccount.category, debit: Number(posting.amount), credit: 0 },
                { accountId: creditAccount.id, category: creditAccount.category, debit: 0, credit: Number(posting.amount) },
              ],
            });
          }
          if (!installment.lastProcessedDate || installment.lastProcessedDate < posting.periodKey) {
            await updateInstallmentSchedule(installment.id, { lastProcessedDate: posting.periodKey });
          }
        } catch (error) {
          console.warn("[Installments] Failed to apply due posting", error);
        }
      }
    };
    void syncPostings();
    return () => { cancelled = true; };
  }, [addJournalEntry, postingsQuery.data, state.accounts, state.installments, state.journalEntries, updateInstallmentSchedule]);

  return null;
}
