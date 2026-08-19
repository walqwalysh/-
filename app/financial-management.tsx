import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { EmptyState, IconCircle, PrimaryButton } from "@/components/accounting-ui";
import { ScreenContainer } from "@/components/screen-container";
import { formatAmount, type CashBankAccountType, useAccounting } from "@/lib/accounting";

type Section = "accounts" | "movement" | "transfer" | "budget";
type PickerKind = "asset" | "cashBank" | "counterpart" | "from" | "to" | "budget" | "budgetAccount" | null;
type PickerOption = { id: string; title: string; subtitle: string };

const sections: { id: Section; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: "accounts", label: "الصندوق والبنوك", icon: "account-balance-wallet" },
  { id: "movement", label: "حركة قبض أو صرف", icon: "swap-vert" },
  { id: "transfer", label: "تحويل داخلي", icon: "swap-horiz" },
  { id: "budget", label: "الميزانيات", icon: "pie-chart" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function FinancialManagementScreen() {
  const router = useRouter();
  const { state, accountBalances, addCashBankAccount, createCashBankTransaction, transferCashBankFunds, addBudget, addBudgetLine } = useAccounting();
  const [section, setSection] = useState<Section>("accounts");
  const [picker, setPicker] = useState<PickerKind>(null);
  const [cashBankForm, setCashBankForm] = useState({ name: "", type: "cash" as CashBankAccountType, accountId: "", bankName: "", accountNumber: "", notes: "" });
  const [movementForm, setMovementForm] = useState({ type: "receipt" as "receipt" | "payment", cashBankAccountId: "", counterpartAccountId: "", date: today(), amount: "", description: "" });
  const [transferForm, setTransferForm] = useState({ fromCashBankAccountId: "", toCashBankAccountId: "", date: today(), amount: "", description: "" });
  const [budgetForm, setBudgetForm] = useState({ name: "", startDate: "", endDate: "", notes: "" });
  const [budgetLineForm, setBudgetLineForm] = useState({ budgetId: "", accountId: "", plannedAmount: "" });

  const assetAccounts = useMemo(() => state.accounts.filter((account) => account.category === "asset"), [state.accounts]);
  const budgetAccounts = useMemo(() => state.accounts.filter((account) => account.category === "revenue" || account.category === "expense"), [state.accounts]);
  const cashBankById = useMemo(() => new Map(state.cashBankAccounts.map((account) => [account.id, account])), [state.cashBankAccounts]);
  const accountById = useMemo(() => new Map(state.accounts.map((account) => [account.id, account])), [state.accounts]);
  const selectedCashBank = cashBankById.get(movementForm.cashBankAccountId);
  const selectedCounterpart = accountById.get(movementForm.counterpartAccountId);
  const selectedFrom = cashBankById.get(transferForm.fromCashBankAccountId);
  const selectedTo = cashBankById.get(transferForm.toCashBankAccountId);
  const selectedBudget = state.budgets.find((budget) => budget.id === budgetLineForm.budgetId);
  const selectedBudgetAccount = accountById.get(budgetLineForm.accountId);

  const pickerOptions = useMemo<PickerOption[]>(() => {
    if (picker === "asset") return assetAccounts.map((account) => ({ id: account.id, title: account.name, subtitle: `${account.code} · ${formatAmount(accountBalances[account.id] ?? 0, state.currency)}` }));
    if (picker === "cashBank" || picker === "from" || picker === "to") return state.cashBankAccounts.map((account) => ({ id: account.id, title: account.name, subtitle: `${account.type === "cash" ? "صندوق" : account.bankName || "حساب بنكي"} · ${formatAmount(accountBalances[account.accountId] ?? 0, state.currency)}` }));
    if (picker === "counterpart") return state.accounts.map((account) => ({ id: account.id, title: account.name, subtitle: `${account.code} · ${formatAmount(accountBalances[account.id] ?? 0, state.currency)}` }));
    if (picker === "budget") return state.budgets.map((budget) => ({ id: budget.id, title: budget.name, subtitle: `${budget.startDate} ← ${budget.endDate}` }));
    if (picker === "budgetAccount") return budgetAccounts.map((account) => ({ id: account.id, title: account.name, subtitle: `${account.category === "revenue" ? "إيراد" : "مصروف"} · ${account.code}` }));
    return [];
  }, [accountBalances, assetAccounts, budgetAccounts, picker, state.accounts, state.budgets, state.cashBankAccounts, state.currency]);

  const selectPicker = (id: string) => {
    if (picker === "asset") setCashBankForm((form) => ({ ...form, accountId: id }));
    if (picker === "cashBank") setMovementForm((form) => ({ ...form, cashBankAccountId: id }));
    if (picker === "counterpart") setMovementForm((form) => ({ ...form, counterpartAccountId: id }));
    if (picker === "from") setTransferForm((form) => ({ ...form, fromCashBankAccountId: id }));
    if (picker === "to") setTransferForm((form) => ({ ...form, toCashBankAccountId: id }));
    if (picker === "budget") setBudgetLineForm((form) => ({ ...form, budgetId: id }));
    if (picker === "budgetAccount") setBudgetLineForm((form) => ({ ...form, accountId: id }));
    setPicker(null);
  };

  const submitCashBank = async () => {
    try {
      await addCashBankAccount(cashBankForm);
      setCashBankForm({ name: "", type: "cash", accountId: "", bankName: "", accountNumber: "", notes: "" });
      Alert.alert("تم الحفظ", "تمت إضافة حساب الصندوق أو البنك دون إنشاء أي رصيد مبدئي.");
    } catch (error) { Alert.alert("تعذر الحفظ", error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
  };
  const submitMovement = async () => {
    try {
      await createCashBankTransaction({ ...movementForm, amount: Number(movementForm.amount) });
      setMovementForm({ type: "receipt", cashBankAccountId: "", counterpartAccountId: "", date: today(), amount: "", description: "" });
      Alert.alert("تم الترحيل", "تم إنشاء قيد مزدوج متوازن للحركة.");
    } catch (error) { Alert.alert("تعذر الترحيل", error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
  };
  const submitTransfer = async () => {
    try {
      await transferCashBankFunds({ ...transferForm, amount: Number(transferForm.amount) });
      setTransferForm({ fromCashBankAccountId: "", toCashBankAccountId: "", date: today(), amount: "", description: "" });
      Alert.alert("تم الترحيل", "تم إنشاء قيد تحويل داخلي متوازن.");
    } catch (error) { Alert.alert("تعذر الترحيل", error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
  };
  const submitBudget = async () => {
    try {
      const budget = await addBudget(budgetForm);
      setBudgetForm({ name: "", startDate: "", endDate: "", notes: "" });
      setBudgetLineForm((form) => ({ ...form, budgetId: budget.id }));
      Alert.alert("تم الحفظ", "تم إنشاء الميزانية. أضف الآن بنود الإيرادات أو المصروفات المخططة.");
    } catch (error) { Alert.alert("تعذر الحفظ", error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
  };
  const submitBudgetLine = async () => {
    try {
      await addBudgetLine({ ...budgetLineForm, plannedAmount: Number(budgetLineForm.plannedAmount) });
      setBudgetLineForm((form) => ({ ...form, accountId: "", plannedAmount: "" }));
      Alert.alert("تمت الإضافة", "أُضيف البند المخطط إلى الميزانية المختارة.");
    } catch (error) { Alert.alert("تعذر الحفظ", error instanceof Error ? error.message : "حدث خطأ غير متوقع."); }
  };

  const header = <View style={styles.headerBlock}><View style={styles.header}><Pressable accessibilityLabel="رجوع" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name="arrow-forward" size={22} color="#154C79" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>إدارة السيولة والتخطيط</Text><Text style={styles.title}>الصندوق والبنوك والميزانيات</Text></View></View><FlatList horizontal inverted data={sections} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabList} renderItem={({ item }) => <Pressable onPress={() => setSection(item.id)} style={({ pressed }) => [styles.tab, section === item.id && styles.activeTab, pressed && styles.pressed]}><MaterialIcons name={item.icon} size={16} color={section === item.id ? "#FFFFFF" : "#65737E"} /><Text style={[styles.tabText, section === item.id && styles.activeTabText]}>{item.label}</Text></Pressable>} /></View>;

  const renderAccounts = () => (
    <FlatList
      data={state.cashBankAccounts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        {header}
        <View style={styles.formCard}>
          <SectionLead icon="account-balance-wallet" title="إضافة صندوق أو بنك" description="اربطه بحساب أصل في دليل الحسابات. يبقى رصيده صفراً حتى تسجل حركة فعلية." />
          <Field label="اسم الصندوق أو البنك" value={cashBankForm.name} onChangeText={(name) => setCashBankForm((form) => ({ ...form, name }))} placeholder="مثال: الصندوق الرئيسي" />
          <Text style={styles.fieldLabel}>النوع</Text>
          <View style={styles.typeRow}>{(["cash", "bank"] as CashBankAccountType[]).map((type) => <Pressable key={type} onPress={() => setCashBankForm((form) => ({ ...form, type }))} style={({ pressed }) => [styles.typeChoice, cashBankForm.type === type && styles.typeChoiceActive, pressed && styles.pressed]}><MaterialIcons name={type === "cash" ? "payments" : "account-balance"} size={18} color={cashBankForm.type === type ? "#FFFFFF" : "#154C79"} /><Text style={[styles.typeText, cashBankForm.type === type && styles.typeTextActive]}>{type === "cash" ? "صندوق" : "بنك"}</Text></Pressable>)}</View>
          <SelectField label="الحساب المحاسبي (أصل)" value={assetAccounts.find((account) => account.id === cashBankForm.accountId)?.name} onPress={() => setPicker("asset")} placeholder="اختر حساب أصل" />
          {cashBankForm.type === "bank" ? <><Field label="اسم المصرف" value={cashBankForm.bankName} onChangeText={(bankName) => setCashBankForm((form) => ({ ...form, bankName }))} placeholder="اختياري" /><Field label="رقم الحساب أو IBAN" value={cashBankForm.accountNumber} onChangeText={(accountNumber) => setCashBankForm((form) => ({ ...form, accountNumber }))} placeholder="اختياري" /></> : null}
          <Field label="ملاحظات" value={cashBankForm.notes} onChangeText={(notes) => setCashBankForm((form) => ({ ...form, notes }))} placeholder="اختياري" multiline />
          <PrimaryButton label="حفظ الحساب" icon="add" onPress={submitCashBank} />
        </View>
        <Text style={styles.sectionTitle}>الحسابات المسجلة</Text>
      </>}
      ListEmptyComponent={<View style={styles.empty}><EmptyState icon="account-balance-wallet" title="لا توجد صناديق أو بنوك" description="أنشئ أول حساب مرتبط بدليل الحسابات، ثم سجل القبض أو الصرف أو التحويلات منه." /></View>}
      renderItem={({ item }) => { const linked = accountById.get(item.accountId); return <View style={styles.listRow}><IconCircle icon={item.type === "cash" ? "payments" : "account-balance"} color={item.type === "cash" ? "#168A63" : "#154C79"} background={item.type === "cash" ? "#E3F5EE" : "#E4F1F9"} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.type === "cash" ? "صندوق" : item.bankName || "حساب بنكي"} · {linked?.code || "—"}</Text></View><Text style={styles.rowAmount}>{formatAmount(accountBalances[item.accountId] ?? 0, state.currency)}</Text></View>; }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );

  /* الصياغة الأولى للأقسام التالية محتفَظ بها مؤقتاً أثناء استبدالها بتراكيب FlatList متعددة الأسطر. 
  const renderMovement = () => <FlatList data={state.cashBankTransactions.filter((transaction) => transaction.type !== "transfer")} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} ListHeaderComponent={<><>{header}</><View style={styles.formCard}><SectionLead icon="swap-vert" title="تسجيل قبض أو صرف" description="تُرحّل العملية فوراً كقيد مزدوج متوازن، من دون اتصال بنكي أو سحب فعلي." /><Text style={styles.fieldLabel}>نوع الحركة</Text><View style={styles.typeRow}>{(["receipt", "payment"] as const).map((type) => <Pressable key={type} onPress={() => setMovementForm((form) => ({ ...form, type }))} style={({ pressed }) => [styles.typeChoice, movementForm.type === type && styles.typeChoiceActive, pressed && styles.pressed]}><MaterialIcons name={type === "receipt" ? "south-west" : "north-east"} size={18} color={movementForm.type === type ? "#FFFFFF" : "#154C79"} /><Text style={[styles.typeText, movementForm.type === type && styles.typeTextActive]}>{type === "receipt" ? "قبض" : "صرف"}</Text></Pressable>)}</View><SelectField label="الصندوق أو البنك" value={selectedCashBank?.name} onPress={() => setPicker("cashBank")} placeholder="اختر الحساب" /><SelectField label="الحساب المقابل" value={selectedCounterpart?.name} onPress={() => setPicker("counterpart")} placeholder="اختر الحساب المقابل" /><Field label="التاريخ (YYYY-MM-DD)" value={movementForm.date} onChangeText={(date) => setMovementForm((form) => ({ ...form, date }))} placeholder="2026-01-31" keyboardType="numbers-and-punctuation" /><Field label="المبلغ" value={movementForm.amount} onChangeText={(amount) => setMovementForm((form) => ({ ...form, amount }))} placeholder="0.00" keyboardType="decimal-pad" /><Field label="البيان" value={movementForm.description} onChangeText={(description) => setMovementForm((form) => ({ ...form, description }))} placeholder="وصف واضح للحركة" multiline /><PrimaryButton label="ترحيل الحركة" icon="check" onPress={submitMovement} /></View><Text style={styles.sectionTitle}>أحدث الحركات</Text></>} ListEmptyComponent={<View style={styles.empty}><EmptyState icon="swap-vert" title="لا توجد حركات قبض أو صرف" description="سجل حركة من النموذج أعلاه بعد إضافة صندوق أو بنك وربطه بحساب أصل." /></View>} renderItem={({ item }) => { const cashBank = item.cashBankAccountId ? cashBankById.get(item.cashBankAccountId) : undefined; const counterpart = item.counterpartAccountId ? accountById.get(item.counterpartAccountId) : undefined; return <View style={styles.listRow}><IconCircle icon={item.type === "receipt" ? "south-west" : "north-east"} color={item.type === "receipt" ? "#168A63" : "#C44747"} background={item.type === "receipt" ? "#E3F5EE" : "#FCEAEA"} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.description}</Text><Text style={styles.rowMeta}>{item.date} · {cashBank?.name || "—"} ↔ {counterpart?.name || "—"}</Text></View><Text style={[styles.rowAmount, { color: item.type === "receipt" ? "#168A63" : "#C44747" }]}>{formatAmount(item.amount, state.currency)}</Text></View>; }} ItemSeparatorComponent={() => <View style={styles.separator} />} /></>;

  const renderTransfer = () => <FlatList data={state.cashBankTransactions.filter((transaction) => transaction.type === "transfer")} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} ListHeaderComponent={<><>{header}</><View style={styles.formCard}><SectionLead icon="swap-horiz" title="تحويل بين الصناديق والبنوك" description="ينشئ القيد: مدين للحساب المستلم ودائن للحساب المرسل بالقيمة نفسها." /><SelectField label="من حساب" value={selectedFrom?.name} onPress={() => setPicker("from")} placeholder="اختر الحساب المرسل" /><SelectField label="إلى حساب" value={selectedTo?.name} onPress={() => setPicker("to")} placeholder="اختر الحساب المستلم" /><Field label="التاريخ (YYYY-MM-DD)" value={transferForm.date} onChangeText={(date) => setTransferForm((form) => ({ ...form, date }))} placeholder="2026-01-31" keyboardType="numbers-and-punctuation" /><Field label="المبلغ" value={transferForm.amount} onChangeText={(amount) => setTransferForm((form) => ({ ...form, amount }))} placeholder="0.00" keyboardType="decimal-pad" /><Field label="بيان التحويل" value={transferForm.description} onChangeText={(description) => setTransferForm((form) => ({ ...form, description }))} placeholder="مثال: إيداع في المصرف" multiline /><PrimaryButton label="ترحيل التحويل" icon="sync-alt" onPress={submitTransfer} /></View><Text style={styles.sectionTitle}>التحويلات المسجلة</Text></>} ListEmptyComponent={<View style={styles.empty}><EmptyState icon="swap-horiz" title="لا توجد تحويلات داخلية" description="ستظهر هنا التحويلات المحاسبية بين الصناديق والحسابات البنكية." /></View>} renderItem={({ item }) => <View style={styles.listRow}><IconCircle icon="swap-horiz" color="#7357C8" background="#EEE9FE" /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.description}</Text><Text style={styles.rowMeta}>{item.date} · {cashBankById.get(item.fromCashBankAccountId || "")?.name || "—"} ← {cashBankById.get(item.toCashBankAccountId || "")?.name || "—"}</Text></View><Text style={styles.rowAmount}>{formatAmount(item.amount, state.currency)}</Text></View>} ItemSeparatorComponent={() => <View style={styles.separator} />} /></>;

  const budgetActual = (accountId: string, startDate: string, endDate: string) => state.journalEntries.filter((entry) => entry.date >= startDate && entry.date <= endDate).reduce((total, entry) => total + entry.lines.filter((line) => line.accountId === accountId).reduce((lineTotal, line) => { const account = accountById.get(accountId); return lineTotal + (account?.nature === "debit" ? line.debit - line.credit : line.credit - line.debit); }, 0), 0);
  const budgetRows = state.budgetLines.map((line) => ({ line, budget: state.budgets.find((budget) => budget.id === line.budgetId), account: accountById.get(line.accountId) })).filter((item) => item.budget && item.account);
  const renderBudget = () => <FlatList data={budgetRows} keyExtractor={(item) => item.line.id} contentContainerStyle={styles.content} ListHeaderComponent={<><>{header}</><View style={styles.formCard}><SectionLead icon="pie-chart" title="إنشاء ميزانية تخطيطية" description="لا تنشئ الميزانية قيوداً أو أرصدة؛ هي خطة تقارن لاحقاً بالحركات الفعلية فقط." /><Field label="اسم الميزانية" value={budgetForm.name} onChangeText={(name) => setBudgetForm((form) => ({ ...form, name }))} placeholder="مثال: ميزانية 2026" /><Field label="بداية الفترة (YYYY-MM-DD)" value={budgetForm.startDate} onChangeText={(startDate) => setBudgetForm((form) => ({ ...form, startDate }))} placeholder="2026-01-01" keyboardType="numbers-and-punctuation" /><Field label="نهاية الفترة (YYYY-MM-DD)" value={budgetForm.endDate} onChangeText={(endDate) => setBudgetForm((form) => ({ ...form, endDate }))} placeholder="2026-12-31" keyboardType="numbers-and-punctuation" /><Field label="ملاحظات" value={budgetForm.notes} onChangeText={(notes) => setBudgetForm((form) => ({ ...form, notes }))} placeholder="اختياري" multiline /><PrimaryButton label="حفظ الميزانية" icon="add-chart" onPress={submitBudget} /></View><View style={styles.formCard}><SectionLead icon="playlist-add" title="إضافة بند مخطط" description="متاح لحسابات الإيرادات والمصروفات فقط، ويظهر الفعلي من قيود الفترة." /><SelectField label="الميزانية" value={selectedBudget?.name} onPress={() => setPicker("budget")} placeholder="اختر الميزانية" /><SelectField label="الحساب" value={selectedBudgetAccount?.name} onPress={() => setPicker("budgetAccount")} placeholder="اختر إيراداً أو مصروفاً" /><Field label="المبلغ المخطط" value={budgetLineForm.plannedAmount} onChangeText={(plannedAmount) => setBudgetLineForm((form) => ({ ...form, plannedAmount }))} placeholder="0.00" keyboardType="decimal-pad" /><PrimaryButton label="إضافة البند" icon="playlist-add" onPress={submitBudgetLine} /></View><Text style={styles.sectionTitle}>مقارنة المخطط والفعلي</Text></>} ListEmptyComponent={<View style={styles.empty}><EmptyState icon="pie-chart" title="لا توجد بنود ميزانية" description="أنشئ ميزانية ثم أضف بنود الإيرادات والمصروفات المخططة لتظهر المقارنة." /></View>} renderItem={({ item }) => { const actual = budgetActual(item.line.accountId, item.budget!.startDate, item.budget!.endDate); const variance = actual - item.line.plannedAmount; return <View style={styles.budgetRow}><View style={styles.budgetTop}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.account!.name}</Text><Text style={styles.rowMeta}>{item.budget!.name} · {item.budget!.startDate} ← {item.budget!.endDate}</Text></View><Text style={[styles.variance, { color: variance > 0 ? "#B97512" : "#168A63" }]}>{variance === 0 ? "مطابق" : `${variance > 0 ? "+" : ""}${formatAmount(variance, state.currency)}`}</Text></View><View style={styles.budgetValues}><BudgetValue label="مخطط" value={item.line.plannedAmount} currency={state.currency} /><BudgetValue label="فعلي" value={actual} currency={state.currency} /></View></View>; }} ItemSeparatorComponent={() => <View style={styles.separator} />} /></>;

  */
  const renderMovement = () => (
    <FlatList
      data={state.cashBankTransactions.filter((transaction) => transaction.type !== "transfer")}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        {header}
        <View style={styles.formCard}>
          <SectionLead icon="swap-vert" title="تسجيل قبض أو صرف" description="تُرحّل العملية كقيد مزدوج متوازن، من دون اتصال بنكي أو سحب فعلي." />
          <View style={styles.typeRow}>{(["receipt", "payment"] as const).map((type) => <Pressable key={type} onPress={() => setMovementForm((form) => ({ ...form, type }))} style={({ pressed }) => [styles.typeChoice, movementForm.type === type && styles.typeChoiceActive, pressed && styles.pressed]}><MaterialIcons name={type === "receipt" ? "south-west" : "north-east"} size={18} color={movementForm.type === type ? "#FFFFFF" : "#154C79"} /><Text style={[styles.typeText, movementForm.type === type && styles.typeTextActive]}>{type === "receipt" ? "قبض" : "صرف"}</Text></Pressable>)}</View>
          <SelectField label="الصندوق أو البنك" value={selectedCashBank?.name} onPress={() => setPicker("cashBank")} placeholder="اختر الحساب" />
          <SelectField label="الحساب المقابل" value={selectedCounterpart?.name} onPress={() => setPicker("counterpart")} placeholder="اختر الحساب المقابل" />
          <Field label="التاريخ (YYYY-MM-DD)" value={movementForm.date} onChangeText={(date) => setMovementForm((form) => ({ ...form, date }))} placeholder="2026-01-31" keyboardType="numbers-and-punctuation" />
          <Field label="المبلغ" value={movementForm.amount} onChangeText={(amount) => setMovementForm((form) => ({ ...form, amount }))} placeholder="0.00" keyboardType="decimal-pad" />
          <Field label="البيان" value={movementForm.description} onChangeText={(description) => setMovementForm((form) => ({ ...form, description }))} placeholder="وصف واضح للحركة" multiline />
          <PrimaryButton label="ترحيل الحركة" icon="check" onPress={submitMovement} />
        </View>
        <Text style={styles.sectionTitle}>أحدث الحركات</Text>
      </>}
      ListEmptyComponent={<View style={styles.empty}><EmptyState icon="swap-vert" title="لا توجد حركات قبض أو صرف" description="سجل حركة من النموذج أعلاه بعد إضافة صندوق أو بنك وربطه بحساب أصل." /></View>}
      renderItem={({ item }) => <View style={styles.listRow}><IconCircle icon={item.type === "receipt" ? "south-west" : "north-east"} color={item.type === "receipt" ? "#168A63" : "#C44747"} background={item.type === "receipt" ? "#E3F5EE" : "#FCEAEA"} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.description}</Text><Text style={styles.rowMeta}>{item.date} · {cashBankById.get(item.cashBankAccountId || "")?.name || "—"}</Text></View><Text style={styles.rowAmount}>{formatAmount(item.amount, state.currency)}</Text></View>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
  const renderTransfer = () => (
    <FlatList
      data={state.cashBankTransactions.filter((transaction) => transaction.type === "transfer")}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        {header}
        <View style={styles.formCard}>
          <SectionLead icon="swap-horiz" title="تحويل بين الصناديق والبنوك" description="ينشئ القيد مديناً للحساب المستلم ودائناً للحساب المرسل بالقيمة نفسها." />
          <SelectField label="من حساب" value={selectedFrom?.name} onPress={() => setPicker("from")} placeholder="اختر الحساب المرسل" />
          <SelectField label="إلى حساب" value={selectedTo?.name} onPress={() => setPicker("to")} placeholder="اختر الحساب المستلم" />
          <Field label="التاريخ (YYYY-MM-DD)" value={transferForm.date} onChangeText={(date) => setTransferForm((form) => ({ ...form, date }))} placeholder="2026-01-31" keyboardType="numbers-and-punctuation" />
          <Field label="المبلغ" value={transferForm.amount} onChangeText={(amount) => setTransferForm((form) => ({ ...form, amount }))} placeholder="0.00" keyboardType="decimal-pad" />
          <Field label="بيان التحويل" value={transferForm.description} onChangeText={(description) => setTransferForm((form) => ({ ...form, description }))} placeholder="مثال: إيداع في المصرف" multiline />
          <PrimaryButton label="ترحيل التحويل" icon="sync-alt" onPress={submitTransfer} />
        </View>
        <Text style={styles.sectionTitle}>التحويلات المسجلة</Text>
      </>}
      ListEmptyComponent={<View style={styles.empty}><EmptyState icon="swap-horiz" title="لا توجد تحويلات داخلية" description="ستظهر التحويلات المحاسبية بين الصناديق والحسابات البنكية هنا." /></View>}
      renderItem={({ item }) => <View style={styles.listRow}><IconCircle icon="swap-horiz" color="#7357C8" background="#EEE9FE" /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.description}</Text><Text style={styles.rowMeta}>{item.date} · {cashBankById.get(item.fromCashBankAccountId || "")?.name || "—"} ← {cashBankById.get(item.toCashBankAccountId || "")?.name || "—"}</Text></View><Text style={styles.rowAmount}>{formatAmount(item.amount, state.currency)}</Text></View>}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
  const budgetActual = (accountId: string, startDate: string, endDate: string) => state.journalEntries.filter((entry) => entry.date >= startDate && entry.date <= endDate).reduce((total, entry) => total + entry.lines.filter((line) => line.accountId === accountId).reduce((lineTotal, line) => lineTotal + (accountById.get(accountId)?.nature === "debit" ? line.debit - line.credit : line.credit - line.debit), 0), 0);
  const budgetRows = state.budgetLines.map((line) => ({ line, budget: state.budgets.find((budget) => budget.id === line.budgetId), account: accountById.get(line.accountId) })).filter((item) => item.budget && item.account);
  const renderBudget = () => (
    <FlatList
      data={budgetRows}
      keyExtractor={(item) => item.line.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        {header}
        <View style={styles.formCard}>
          <SectionLead icon="pie-chart" title="إنشاء ميزانية تخطيطية" description="لا تنشئ الميزانية قيوداً أو أرصدة؛ هي خطة تقارن لاحقاً بالحركات الفعلية فقط." />
          <Field label="اسم الميزانية" value={budgetForm.name} onChangeText={(name) => setBudgetForm((form) => ({ ...form, name }))} placeholder="مثال: ميزانية 2026" />
          <Field label="بداية الفترة (YYYY-MM-DD)" value={budgetForm.startDate} onChangeText={(startDate) => setBudgetForm((form) => ({ ...form, startDate }))} placeholder="2026-01-01" keyboardType="numbers-and-punctuation" />
          <Field label="نهاية الفترة (YYYY-MM-DD)" value={budgetForm.endDate} onChangeText={(endDate) => setBudgetForm((form) => ({ ...form, endDate }))} placeholder="2026-12-31" keyboardType="numbers-and-punctuation" />
          <Field label="ملاحظات" value={budgetForm.notes} onChangeText={(notes) => setBudgetForm((form) => ({ ...form, notes }))} placeholder="اختياري" multiline />
          <PrimaryButton label="حفظ الميزانية" icon="add-chart" onPress={submitBudget} />
        </View>
        <View style={styles.formCard}>
          <SectionLead icon="playlist-add" title="إضافة بند مخطط" description="متاح لحسابات الإيرادات والمصروفات فقط، ويعرض الفعلي من قيود الفترة." />
          <SelectField label="الميزانية" value={selectedBudget?.name} onPress={() => setPicker("budget")} placeholder="اختر الميزانية" />
          <SelectField label="الحساب" value={selectedBudgetAccount?.name} onPress={() => setPicker("budgetAccount")} placeholder="اختر إيراداً أو مصروفاً" />
          <Field label="المبلغ المخطط" value={budgetLineForm.plannedAmount} onChangeText={(plannedAmount) => setBudgetLineForm((form) => ({ ...form, plannedAmount }))} placeholder="0.00" keyboardType="decimal-pad" />
          <PrimaryButton label="إضافة البند" icon="playlist-add" onPress={submitBudgetLine} />
        </View>
        <Text style={styles.sectionTitle}>مقارنة المخطط والفعلي</Text>
      </>}
      ListEmptyComponent={<View style={styles.empty}><EmptyState icon="pie-chart" title="لا توجد بنود ميزانية" description="أنشئ ميزانية ثم أضف بنود الإيرادات والمصروفات المخططة لتظهر المقارنة." /></View>}
      renderItem={({ item }) => { const actual = budgetActual(item.line.accountId, item.budget!.startDate, item.budget!.endDate); const variance = actual - item.line.plannedAmount; return <View style={styles.budgetRow}><View style={styles.budgetTop}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.account!.name}</Text><Text style={styles.rowMeta}>{item.budget!.name} · {item.budget!.startDate} ← {item.budget!.endDate}</Text></View><Text style={[styles.variance, { color: variance > 0 ? "#B97512" : "#168A63" }]}>{variance === 0 ? "مطابق" : `${variance > 0 ? "+" : ""}${formatAmount(variance, state.currency)}`}</Text></View><View style={styles.budgetValues}><BudgetValue label="مخطط" value={item.line.plannedAmount} currency={state.currency} /><BudgetValue label="فعلي" value={actual} currency={state.currency} /></View></View>; }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );

  return <ScreenContainer className="px-4">{section === "accounts" ? renderAccounts() : section === "movement" ? renderMovement() : section === "transfer" ? renderTransfer() : renderBudget()}<Modal transparent visible={picker !== null} animationType="slide" onRequestClose={() => setPicker(null)}><View style={styles.modalOverlay}><Pressable onPress={() => setPicker(null)} style={styles.modalBack} /><View style={styles.modalPanel}><View style={styles.modalHeader}><Pressable accessibilityLabel="إغلاق" onPress={() => setPicker(null)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><MaterialIcons name="close" size={21} color="#154C79" /></Pressable><Text style={styles.modalTitle}>اختر من القائمة</Text></View><FlatList data={pickerOptions} keyExtractor={(item) => item.id} ListEmptyComponent={<EmptyState icon="search-off" title="لا توجد خيارات" description="أضف الحسابات أو الصناديق أو الميزانيات المطلوبة أولاً." />} renderItem={({ item }) => <Pressable onPress={() => selectPicker(item.id)} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><MaterialIcons name="account-balance-wallet" size={20} color="#154C79" /><View style={styles.optionCopy}><Text style={styles.optionTitle}>{item.title}</Text><Text style={styles.optionMeta}>{item.subtitle}</Text></View></Pressable>} ItemSeparatorComponent={() => <View style={styles.separator} />} /></View></View></Modal></ScreenContainer>;
}

function SectionLead({ icon, title, description }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; description: string }) { return <View style={styles.lead}><IconCircle icon={icon} color="#154C79" background="#E4F1F9" /><View style={styles.leadCopy}><Text style={styles.leadTitle}>{title}</Text><Text style={styles.leadDescription}>{description}</Text></View></View>; }
function Field({ label, value, onChangeText, placeholder, keyboardType, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "decimal-pad" | "numbers-and-punctuation"; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#91A1AF" keyboardType={keyboardType} multiline={multiline} textAlign="right" style={[styles.input, multiline && styles.multiline]} /></View>; }
function SelectField({ label, value, onPress, placeholder }: { label: string; value?: string; onPress: () => void; placeholder: string }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.select, pressed && styles.pressed]}><MaterialIcons name="expand-more" size={22} color="#65737E" /><Text numberOfLines={1} style={[styles.selectText, !value && styles.placeholder]}>{value || placeholder}</Text></Pressable></View>; }
function BudgetValue({ label, value, currency }: { label: string; value: number; currency: string }) { return <View style={styles.budgetValue}><Text style={styles.budgetValueLabel}>{label}</Text><Text style={styles.budgetValueText}>{formatAmount(value, currency)}</Text></View>; }

const styles = StyleSheet.create({
  content: { paddingBottom: 34, paddingTop: 10 }, headerBlock: { gap: 14, marginBottom: 14 }, header: { alignItems: "center", flexDirection: "row", gap: 12 }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 }, headerCopy: { alignItems: "flex-end", flex: 1 }, eyebrow: { color: "#65737E", fontSize: 11, fontWeight: "700", writingDirection: "rtl" }, title: { color: "#14212B", fontSize: 21, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, tabList: { gap: 8, paddingVertical: 2 }, tab: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 999, borderWidth: 1, flexDirection: "row-reverse", gap: 5, paddingHorizontal: 12, paddingVertical: 9 }, activeTab: { backgroundColor: "#154C79", borderColor: "#154C79" }, tabText: { color: "#65737E", fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, activeTabText: { color: "#FFFFFF" }, formCard: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 20, borderWidth: 1, gap: 12, marginBottom: 16, padding: 15 }, lead: { alignItems: "flex-start", flexDirection: "row-reverse", gap: 10, marginBottom: 3 }, leadCopy: { alignItems: "flex-end", flex: 1 }, leadTitle: { color: "#14212B", fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, leadDescription: { color: "#65737E", fontSize: 11, lineHeight: 17, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, field: { gap: 6 }, fieldLabel: { color: "#3A4A55", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, input: { backgroundColor: "#F9FBFC", borderColor: "#DCE5EA", borderRadius: 13, borderWidth: 1, color: "#14212B", fontSize: 14, minHeight: 46, paddingHorizontal: 12, writingDirection: "rtl" }, multiline: { minHeight: 74, paddingTop: 10, textAlignVertical: "top" }, select: { alignItems: "center", backgroundColor: "#F9FBFC", borderColor: "#DCE5EA", borderRadius: 13, borderWidth: 1, flexDirection: "row", minHeight: 46, paddingHorizontal: 12 }, selectText: { color: "#14212B", flex: 1, fontSize: 13, fontWeight: "700", textAlign: "right", writingDirection: "rtl" }, placeholder: { color: "#91A1AF", fontWeight: "400" }, typeRow: { flexDirection: "row-reverse", gap: 8 }, typeChoice: { alignItems: "center", backgroundColor: "#F7FAFC", borderColor: "#DCE5EA", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row-reverse", gap: 6, justifyContent: "center", minHeight: 44 }, typeChoiceActive: { backgroundColor: "#154C79", borderColor: "#154C79" }, typeText: { color: "#154C79", fontSize: 13, fontWeight: "800", writingDirection: "rtl" }, typeTextActive: { color: "#FFFFFF" }, sectionTitle: { color: "#14212B", fontSize: 16, fontWeight: "800", marginBottom: 10, textAlign: "right", writingDirection: "rtl" }, empty: { backgroundColor: "#FFFFFF", borderColor: "#E1E8EE", borderRadius: 19, borderWidth: 1 }, listRow: { alignItems: "center", backgroundColor: "#FFFFFF", flexDirection: "row-reverse", gap: 10, minHeight: 70, paddingHorizontal: 12 }, rowCopy: { alignItems: "flex-end", flex: 1 }, rowTitle: { color: "#14212B", fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, rowMeta: { color: "#73818A", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, rowAmount: { color: "#154C79", fontSize: 11, fontWeight: "800", textAlign: "left", writingDirection: "rtl" }, separator: { backgroundColor: "#EAF0F3", height: 1 }, budgetRow: { backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 12 }, budgetTop: { alignItems: "center", flexDirection: "row-reverse", gap: 8 }, variance: { fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, budgetValues: { flexDirection: "row-reverse", gap: 8, marginTop: 10 }, budgetValue: { backgroundColor: "#F7FAFC", borderRadius: 11, flex: 1, padding: 9 }, budgetValueLabel: { color: "#73818A", fontSize: 10, fontWeight: "700", textAlign: "right", writingDirection: "rtl" }, budgetValueText: { color: "#154C79", fontSize: 11, fontWeight: "800", marginTop: 3, textAlign: "right", writingDirection: "rtl" }, modalOverlay: { backgroundColor: "rgba(15, 34, 48, 0.36)", flex: 1, justifyContent: "flex-end" }, modalBack: { flex: 1 }, modalPanel: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "72%", minHeight: 240, paddingBottom: 18 }, modalHeader: { alignItems: "center", borderBottomColor: "#EAF0F3", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 16 }, close: { alignItems: "center", backgroundColor: "#F4F8FA", borderRadius: 12, height: 38, justifyContent: "center", width: 38 }, modalTitle: { color: "#14212B", fontSize: 16, fontWeight: "800", writingDirection: "rtl" }, option: { alignItems: "center", flexDirection: "row-reverse", gap: 10, minHeight: 64, paddingHorizontal: 16 }, optionCopy: { alignItems: "flex-end", flex: 1 }, optionTitle: { color: "#14212B", fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, optionMeta: { color: "#73818A", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
