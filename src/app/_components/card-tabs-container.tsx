"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Edit,
  X,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "~/trpc/react";
import { getCardPermissions } from "~/config/card-settings";
import { CardDiscussion } from "./card-discussion";

interface CardTabsContainerProps {
  card: {
    id: number;
    title: string;
    groupCalendar: string | null;
    expenses: string | null;
  };
}

type CalendarEvent = { id: string; date: string; time: string; note: string };
type ExpenseItem = { id: string; item: string; amount: number; date: string; note: string };

export function CardTabsContainer({ card }: CardTabsContainerProps) {
  const [activeTab, setActiveTab] = useState<"discussion" | "calendar" | "expense">("discussion");
  const [savingTab, setSavingTab] = useState<"calendar" | "expense" | null>(null);
  const permissions = getCardPermissions(card.title);

  // Use a key to force re-render on card change
  const containerKey = `card-tabs-${card.id}`;

  // ... (rest of the state and handlers)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    try {
      return card.groupCalendar ? (JSON.parse(card.groupCalendar) as CalendarEvent[]) : [];
    } catch {
      return [];
    }
  });
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventNote, setNewEventNote] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Expense state
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>(() => {
    try {
      return card.expenses ? (JSON.parse(card.expenses) as ExpenseItem[]) : [];
    } catch {
      return [];
    }
  });
  const [newExpenseItem, setNewExpenseItem] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | "">("");
  const [newExpenseDate, setNewExpenseDate] = useState("");
  const [newExpenseNote, setNewExpenseNote] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const utils = api.useUtils();
  const updateCard = api.studyCards.update.useMutation({
    onSuccess: () => {
      void utils.studyCards.getAll.invalidate();
    },
  });

  const saveCalendarEvents = async (events: CalendarEvent[]) => {
    if (!permissions.canEditCard) return;
    setSavingTab("calendar");
    try {
      await updateCard.mutateAsync({
        id: card.id,
        groupCalendar: JSON.stringify(events),
      });
    } finally {
      setSavingTab(null);
    }
  };

  const addCalendarEvent = () => {
    if (!permissions.canEditCard) return;
    if (!newEventDate || !newEventNote.trim()) return;
    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      date: newEventDate,
      time: newEventTime || "",
      note: newEventNote.trim(),
    };
    const updatedEvents = [...calendarEvents, newEvent].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
    setCalendarEvents(updatedEvents);
    void saveCalendarEvents(updatedEvents);
    setNewEventDate("");
    setNewEventTime("");
    setNewEventNote("");
  };

  const deleteCalendarEvent = (id: string) => {
    if (!permissions.canDeleteCalendar) return;
    if (!confirm("Delete this event?")) return;
    const updatedEvents = calendarEvents.filter((e) => e.id !== id);
    setCalendarEvents(updatedEvents);
    void saveCalendarEvents(updatedEvents);
  };

  const updateCalendarEvent = (id: string, updates: Partial<CalendarEvent>) => {
    if (!permissions.canEditCalendar) return;
    const updatedEvents = calendarEvents
      .map((e) => (e.id === id ? { ...e, ...updates } : e))
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
    setCalendarEvents(updatedEvents);
    void saveCalendarEvents(updatedEvents);
    setEditingEventId(null);
  };

  const saveExpenseItems = async (items: ExpenseItem[]) => {
    if (!permissions.canEditCard) return;
    setSavingTab("expense");
    try {
      await updateCard.mutateAsync({
        id: card.id,
        expenses: JSON.stringify(items),
      });
    } finally {
      setSavingTab(null);
    }
  };

  const addExpenseItem = () => {
    if (!permissions.canAddExpense) return;
    if (!newExpenseItem.trim() || newExpenseAmount === "" || !newExpenseDate) return;
    const newItem: ExpenseItem = {
      id: Date.now().toString(),
      item: newExpenseItem.trim(),
      amount: Number(newExpenseAmount),
      date: newExpenseDate,
      note: newExpenseNote.trim(),
    };
    const updatedItems = [...expenseItems, newItem].sort((a, b) => a.date.localeCompare(b.date));
    setExpenseItems(updatedItems);
    void saveExpenseItems(updatedItems);
    setNewExpenseItem("");
    setNewExpenseAmount("");
    setNewExpenseDate("");
    setNewExpenseNote("");
  };

  const deleteExpenseItem = (id: string) => {
    if (!permissions.canDeleteExpense) return;
    if (!confirm("Delete this expense?")) return;
    const updatedItems = expenseItems.filter((e) => e.id !== id);
    setExpenseItems(updatedItems);
    void saveExpenseItems(updatedItems);
  };

  const updateExpenseItem = (id: string, updates: Partial<ExpenseItem>) => {
    if (!permissions.canEditExpense) return;
    const updatedItems = expenseItems
      .map((e) => (e.id === id ? { ...e, ...updates } : e))
      .sort((a, b) => a.date.localeCompare(b.date));
    setExpenseItems(updatedItems);
    void saveExpenseItems(updatedItems);
    setEditingExpenseId(null);
  };

  return (
    <div key={containerKey} className="mt-5 w-full rounded-xl border-2 border-violet-100 bg-white p-3 sm:p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3">
        <p className="text-center text-base font-bold text-violet-800 sm:text-left">Card Content Tabs</p>
        <div className="flex w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-violet-100 bg-violet-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("discussion")}
            className={`flex-1 min-w-[100px] rounded-md px-2 py-2 text-center font-bold transition-all sm:flex-none sm:px-6 ${
              activeTab === "discussion"
                ? "bg-violet-700 text-white shadow-md ring-2 ring-violet-400"
                : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-gray-200"
            } text-xs sm:text-sm cursor-pointer`}
          >
            Discussion
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 min-w-[100px] rounded-md px-2 py-2 text-center font-bold transition-all sm:flex-none sm:px-6 ${
              activeTab === "calendar"
                ? "bg-violet-700 text-white shadow-md ring-2 ring-violet-400"
                : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-gray-200"
            } text-xs sm:text-sm cursor-pointer`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expense")}
            className={`flex-1 min-w-[100px] rounded-md px-2 py-2 text-center font-bold transition-all sm:flex-none sm:px-6 ${
              activeTab === "expense"
                ? "bg-violet-700 text-white shadow-md ring-2 ring-violet-400"
                : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-gray-200"
            } text-xs sm:text-sm cursor-pointer`}
          >
            Expense
          </button>
        </div>
      </div>

      <div className="mt-2 min-h-[300px]" key={activeTab}>
        {activeTab === "discussion" && (
          <div className="animate-in fade-in duration-300">
            <CardDiscussion cardId={card.id} hideHeader={true} />
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <p className="text-xs text-gray-500">
              Add events with dates, times, and notes. Events are sorted chronologically.
            </p>
            {!permissions.canAddCalendar && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This card is locked. Calendar items are view-only.
              </div>
            )}

            {/* Event List */}
            {calendarEvents.length > 0 && (
              <div className="space-y-2">
                {calendarEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      {editingEventId === event.id ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="date"
                              defaultValue={event.date}
                              onChange={(e) => updateCalendarEvent(event.id, { date: e.target.value })}
                              className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
                            />
                            <input
                              type="time"
                              defaultValue={event.time}
                              onChange={(e) => updateCalendarEvent(event.id, { time: e.target.value })}
                              className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
                            />
                          </div>
                          <input
                            type="text"
                            defaultValue={event.note}
                            onBlur={(e) => updateCalendarEvent(event.id, { note: e.currentTarget.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateCalendarEvent(event.id, { note: e.currentTarget.value });
                              }
                            }}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-violet-500 shrink-0" />
                            <span className="font-medium text-gray-900 whitespace-nowrap">
                              {format(new Date(event.date), "MMM d, yyyy")}
                            </span>
                            {event.time && (
                              <div className="flex items-center gap-1 text-gray-600">
                                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span className="whitespace-nowrap">{event.time}</span>
                              </div>
                            )}
                          </div>
                          <p className="mt-1 break-words text-sm text-gray-700">{event.note}</p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {editingEventId === event.id ? (
                        <button
                          type="button"
                          onClick={() => setEditingEventId(null)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : (
                        permissions.canEditCalendar ? (
                          <button
                            type="button"
                            onClick={() => setEditingEventId(event.id)}
                            className="rounded p-1 text-gray-400 hover:bg-violet-100 hover:text-violet-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        ) : null
                      )}
                      {permissions.canDeleteCalendar && (
                        <button
                          type="button"
                          onClick={() => deleteCalendarEvent(event.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {calendarEvents.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                No calendar events for this card.
              </div>
            )}

            {/* Add New Event */}
            {permissions.canAddCalendar && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="mb-2 text-xs font-medium text-violet-700">Add New Event</p>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-600">Date *</label>
                      <input
                        type="date"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-600">Time (optional)</label>
                      <input
                        type="time"
                        value={newEventTime}
                        onChange={(e) => setNewEventTime(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">Note *</label>
                    <input
                      type="text"
                      value={newEventNote}
                      onChange={(e) => setNewEventNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newEventDate && newEventNote.trim()) {
                          addCalendarEvent();
                        }
                      }}
                      placeholder="Meeting, deadline, reminder..."
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={addCalendarEvent}
                      disabled={!newEventDate || !newEventNote.trim() || savingTab === "calendar"}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingTab === "calendar" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Add Event
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "expense" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <p className="text-xs text-gray-500">
              Track expenses with item name, amount, date, and notes.
            </p>
            {!permissions.canAddExpense && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This card is locked. Expense items are view-only.
              </div>
            )}

            {/* Expense Table */}
            <div className="-mx-3 overflow-x-auto sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Item</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell">Note</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {expenseItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                          No expenses for this card.
                        </td>
                      </tr>
                    )}
                    {expenseItems.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        {editingExpenseId === expense.id ? (
                          <>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                defaultValue={expense.item}
                                onBlur={(e) => updateExpenseItem(expense.id, { item: e.currentTarget.value })}
                                className="w-full min-w-[80px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
                                autoFocus
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                defaultValue={expense.amount}
                                onBlur={(e) => updateExpenseItem(expense.id, { amount: Number(e.currentTarget.value) })}
                                className="w-full min-w-[60px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                defaultValue={expense.date}
                                onChange={(e) => updateExpenseItem(expense.id, { date: e.target.value })}
                                className="w-full min-w-[110px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 hidden sm:table-cell">
                              <input
                                type="text"
                                defaultValue={expense.note}
                                onBlur={(e) => updateExpenseItem(expense.id, { note: e.currentTarget.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setEditingExpenseId(null)}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-medium text-gray-900 break-words">{expense.item}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                                {expense.amount.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                              {format(new Date(expense.date), "MMM d, yyyy")}
                            </td>
                            <td className="px-3 py-2 text-gray-600 hidden sm:table-cell truncate max-w-[150px]">{expense.note || "—"}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                {permissions.canEditExpense && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingExpenseId(expense.id)}
                                    className="rounded p-1 text-gray-400 hover:bg-violet-100 hover:text-violet-600"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                )}
                                {permissions.canDeleteExpense && (
                                  <button
                                    type="button"
                                    onClick={() => deleteExpenseItem(expense.id)}
                                    className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">Total</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <DollarSign className="h-4 w-4 shrink-0" />
                          {expenseItems.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                        </span>
                      </td>
                      <td colSpan={3} className="hidden sm:table-cell"></td>
                      <td colSpan={2} className="sm:hidden"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Add New Expense */}
            {permissions.canAddExpense && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="mb-2 text-xs font-medium text-violet-700">Add New Expense</p>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-600">Item *</label>
                      <input
                        type="text"
                        value={newExpenseItem}
                        onChange={(e) => setNewExpenseItem(e.currentTarget.value)}
                        placeholder="Equipment, materials, service..."
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-600">Amount *</label>
                      <input
                        type="number"
                        value={newExpenseAmount}
                        onChange={(e) =>
                          setNewExpenseAmount(e.currentTarget.value === "" ? "" : Number(e.currentTarget.value))
                        }
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-600">Date *</label>
                      <input
                        type="date"
                        value={newExpenseDate}
                        onChange={(e) => setNewExpenseDate(e.currentTarget.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-600">Note (optional)</label>
                      <input
                        type="text"
                        value={newExpenseNote}
                        onChange={(e) => setNewExpenseNote(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            newExpenseItem.trim() &&
                            newExpenseAmount !== "" &&
                            newExpenseDate
                          ) {
                            addExpenseItem();
                          }
                        }}
                        placeholder="Payment method, vendor..."
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={addExpenseItem}
                      disabled={
                        !newExpenseItem.trim() ||
                        newExpenseAmount === "" ||
                        !newExpenseDate ||
                        savingTab === "expense"
                      }
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingTab === "expense" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Add Expense
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
