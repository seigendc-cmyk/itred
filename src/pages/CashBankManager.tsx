/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { CashBankAccount } from "../types.ts";
import { financeService } from "../services/financeService.ts";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const CashBankManager: React.FC = () => {
  const [accounts] = useState<CashBankAccount[]>(() =>
    financeService.getCashBankAccounts(),
  );

  const totals = useMemo(() => {
    const activeAccounts = accounts.filter((account) => account.status === "active");
    return {
      activeCount: activeAccounts.length,
      openingBalance: activeAccounts.reduce(
        (sum, account) => sum + account.openingBalance,
        0,
      ),
      currentBalance: activeAccounts.reduce(
        (sum, account) => sum + account.currentBalance,
        0,
      ),
    };
  }, [accounts]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <section className="bg-white border border-stone-200 p-5 md:p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-brand-orange">
          Cash / Bank Control
        </p>
        <h1 className="text-2xl font-black text-brand-charcoal mt-2">
          Cash & Bank Manager
        </h1>
        <p className="text-sm text-stone-600 mt-3 max-w-4xl">
          Phase 1 displays configured operating cash, bank, mobile money and
          processor accounts with setup balances.
        </p>
      </section>

      <section className="border-l-4 border-brand-orange bg-orange-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-800">
          Payments, receipts, deposits and ledger posting will be enabled in
          Phase 2.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-stone-200 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
            Active Accounts
          </p>
          <p className="text-2xl font-black text-brand-charcoal mt-3">
            {totals.activeCount}
          </p>
        </div>
        <div className="bg-white border-2 border-stone-200 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
            Opening Balances
          </p>
          <p className="text-2xl font-black text-brand-charcoal mt-3">
            {formatMoney(totals.openingBalance)}
          </p>
        </div>
        <div className="bg-white border-2 border-stone-200 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
            Current Balances
          </p>
          <p className="text-2xl font-black text-brand-charcoal mt-3">
            {formatMoney(totals.currentBalance)}
          </p>
        </div>
      </section>

      <section className="bg-white border border-stone-200">
        <div className="p-4 border-b border-stone-200">
          <h2 className="text-sm font-black uppercase text-brand-charcoal">
            Configured Cash/Bank Accounts
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Manage account setup from Finance Desk.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-widest text-stone-400">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Bank / Wallet</th>
                <th className="px-4 py-3">Opening</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="px-4 py-3">
                    <div className="font-bold text-brand-charcoal">
                      {account.accountName}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono">
                      {account.accountCode || "Uncoded"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{account.accountType}</td>
                  <td className="px-4 py-3">{account.currency}</td>
                  <td className="px-4 py-3">
                    {account.bankName ||
                      account.walletNumber ||
                      account.accountNumber ||
                      "Not specified"}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {formatMoney(account.openingBalance)}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    {formatMoney(account.currentBalance)}
                  </td>
                  <td className="px-4 py-3 capitalize">{account.status}</td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-stone-400" colSpan={7}>
                    No cash/bank accounts configured. Open Finance Desk to add
                    accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default CashBankManager;
