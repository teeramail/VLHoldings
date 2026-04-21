"use client";

import { useState } from "react";
import Image from "next/image";
import { compressCardImage } from "./study-cards";
import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Plus,
  Minus,
  Trash2,
  Edit,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { api } from "~/trpc/react";
import { getCardPermissions } from "~/config/card-settings";
import { CardDiscussion } from "./card-discussion";

interface CardTabsContainerProps {
  card: {
    id: number;
    title: string;
    groupCalendar: string | null;
    expenses: string | null;
    notes: string | null;
  };
}

type CalendarEvent = { id: string; date: string; time: string; note: string };
type ExpenseItem = { id: string; item: string; amount: number; date: string; note: string; timestamp: string };
type ItemMedia = {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  url: string;
  subfolder?: string;
};
type CardItemRow = {
  id: number;
  cardId: number;
  nameTitle: string;
  linkUrl: string | null;
  value: number;
  itemDate: string | null;
  media: ItemMedia | null;
  createdAt: Date;
  updatedAt: Date | null;
};
type NoteTableData = {
  columnCount: number;
  columnWidths: number[];
  rows: string[][];
};
type CardNotesPayload = {
  version: 1;
  text: string;
  noteTable: NoteTableData | null;
};

function createEmptyNoteTable(columnCount = 3): NoteTableData {
  return {
    columnCount,
    columnWidths: Array.from({ length: columnCount }, () => 180),
    rows: [
      Array.from({ length: columnCount }, () => ""),
      Array.from({ length: columnCount }, () => ""),
    ],
  };
}

function normalizeNoteTable(noteTable: NoteTableData | null | undefined): NoteTableData {
  const safeColumnCount = Math.min(8, Math.max(1, noteTable?.columnCount ?? 3));
  const safeColumnWidths = Array.from(
    { length: safeColumnCount },
    (_value, index) => Math.min(480, Math.max(100, noteTable?.columnWidths?.[index] ?? 180)),
  );
  const safeRows = noteTable?.rows?.length
    ? noteTable.rows.map((row) => {
        const nextRow = Array.from({ length: safeColumnCount }, (_value, index) => row[index] ?? "");
        return nextRow;
      })
    : createEmptyNoteTable(safeColumnCount).rows;

  return {
    columnCount: safeColumnCount,
    columnWidths: safeColumnWidths,
    rows: safeRows,
  };
}

function parseCardNotes(rawNotes: string | null | undefined) {
  if (!rawNotes) {
    return {
      text: "",
      noteTable: createEmptyNoteTable(),
      hasStructuredData: false,
    };
  }

  try {
    const parsed = JSON.parse(rawNotes) as Partial<CardNotesPayload>;
    if (parsed && parsed.version === 1) {
      return {
        text: parsed.text ?? "",
        noteTable: normalizeNoteTable(parsed.noteTable),
        hasStructuredData: true,
      };
    }
  } catch {
  }

  return {
    text: rawNotes,
    noteTable: createEmptyNoteTable(),
    hasStructuredData: false,
  };
}

function serializeCardNotes(text: string, noteTable: NoteTableData) {
  const trimmedText = text.trim();
  const normalizedTable = normalizeNoteTable(noteTable);
  const hasNoteTableContent = normalizedTable.rows.some((row) => row.some((cell) => cell.trim().length > 0));

  if (!trimmedText && !hasNoteTableContent) {
    return null;
  }

  if (!hasNoteTableContent) {
    return trimmedText || null;
  }

  return JSON.stringify({
    version: 1,
    text: trimmedText,
    noteTable: normalizedTable,
  } satisfies CardNotesPayload);
}

export function CardTabsContainer({ card }: CardTabsContainerProps) {
  const parsedNotes = parseCardNotes(card.notes);
  const [activeTab, setActiveTab] = useState<"item" | "discussion" | "calendar" | "expense" | "note">("item");
  const [savingTab, setSavingTab] = useState<"calendar" | "expense" | "item" | "note" | null>(null);
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
  const [expensePage, setExpensePage] = useState(1);
  const EXPENSE_PAGE_SIZE = 20;
  const [newItemNameTitle, setNewItemNameTitle] = useState("");
  const [newItemLinkUrl, setNewItemLinkUrl] = useState("");
  const [newItemValue, setNewItemValue] = useState<number | "">("");
  const [newItemDate, setNewItemDate] = useState("");
  const [newItemMedia, setNewItemMedia] = useState<ItemMedia | null>(null);
  const [itemMediaUploading, setItemMediaUploading] = useState(false);
  const [noteTable, setNoteTable] = useState<NoteTableData>(() => parsedNotes.noteTable);

  const utils = api.useUtils();
  const updateCard = api.studyCards.update.useMutation({
    onSuccess: () => {
      void utils.studyCards.getAll.invalidate();
    },
  });
  const itemRowsQuery = api.studyCardItems.listByCardId.useQuery({ cardId: card.id });
  const createItemMutation = api.studyCardItems.create.useMutation({
    onSuccess: () => {
      void utils.studyCardItems.listByCardId.invalidate({ cardId: card.id });
    },
  });
  const deleteItemMutation = api.studyCardItems.delete.useMutation({
    onSuccess: () => {
      void utils.studyCardItems.listByCardId.invalidate({ cardId: card.id });
    },
  });
  const itemRows = (itemRowsQuery.data ?? []) as CardItemRow[];
  const itemTotalValue = itemRows.reduce((sum, row) => sum + row.value, 0);

  const saveCalendarEvents = async (events: CalendarEvent[]) => {
    if (!permissions.canAddCalendar) return;
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
    if (!permissions.canAddCalendar) return;
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
    if (!permissions.canAddExpense) return;
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
      timestamp: new Date().toISOString(),
    };
    const updatedItems = [...expenseItems, newItem].sort((a, b) => b.date.localeCompare(a.date));
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
      .sort((a, b) => b.date.localeCompare(a.date));
    setExpenseItems(updatedItems);
    void saveExpenseItems(updatedItems);
    setEditingExpenseId(null);
  };

  const saveNoteTable = async (nextNoteTable: NoteTableData) => {
    if (!permissions.canEditCard) return;
    setSavingTab("note");
    try {
      await updateCard.mutateAsync({
        id: card.id,
        notes: serializeCardNotes(parsedNotes.text, nextNoteTable) ?? undefined,
      });
    } finally {
      setSavingTab(null);
    }
  };

  const updateNoteColumnCount = (columnCount: number) => {
    if (!permissions.canEditCard) return;
    const nextNoteTable = normalizeNoteTable({
      columnCount,
      columnWidths: noteTable.columnWidths,
      rows: noteTable.rows,
    });
    setNoteTable(nextNoteTable);
    void saveNoteTable(nextNoteTable);
  };

  const uploadItemMedia = async (file: File): Promise<ItemMedia | null> => {
    setItemMediaUploading(true);
    try {
      const isImage = file.type.startsWith("image/");
      const shouldCompress = isImage && file.size > 100 * 1024;
      
      let finalFile = file;
      let finalContentType = file.type || "application/octet-stream";
      
      if (shouldCompress) {
        try {
          finalFile = await compressCardImage(file);
          finalContentType = "image/webp";
        } catch (error) {
          console.error("Image compression failed, uploading original:", error);
        }
      }

      const presignRes = await fetch("/api/presign-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: finalContentType,
          fileSize: finalFile.size,
          subfolder: "study-cards/items",
        }),
      });

      if (!presignRes.ok) {
        alert("Failed to prepare item media upload");
        return null;
      }

      const presignData = (await presignRes.json()) as ItemMedia & { uploadUrl: string };
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        body: finalFile,
        headers: { "Content-Type": finalContentType },
      });

      if (!uploadRes.ok) {
        alert("Failed to upload item media");
        return null;
      }

      return {
        fileName: presignData.fileName,
        originalName: presignData.originalName,
        mimeType: presignData.mimeType,
        fileSize: presignData.fileSize,
        s3Key: presignData.s3Key,
        url: presignData.url,
        subfolder: presignData.subfolder,
      };
    } catch {
      alert("Failed to upload item media");
      return null;
    } finally {
      setItemMediaUploading(false);
    }
  };

  const handleItemMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploaded = await uploadItemMedia(file);
    if (uploaded) {
      setNewItemMedia(uploaded);
    }
    e.target.value = "";
  };

  const addItemRow = async () => {
    if (!permissions.canEditCard) return;
    if (!newItemNameTitle.trim()) return;
    setSavingTab("item");
    try {
      await createItemMutation.mutateAsync({
        cardId: card.id,
        nameTitle: newItemNameTitle.trim(),
        linkUrl: newItemLinkUrl.trim() || undefined,
        value: newItemValue === "" ? 0 : Number(newItemValue),
        itemDate: newItemDate || undefined,
        media: newItemMedia,
      });
      setNewItemNameTitle("");
      setNewItemLinkUrl("");
      setNewItemValue("");
      setNewItemDate("");
      setNewItemMedia(null);
    } finally {
      setSavingTab(null);
    }
  };

  const deleteItemRow = async (itemId: number) => {
    if (!permissions.canEditCard) return;
    if (!confirm("Delete this item row?")) return;
    await deleteItemMutation.mutateAsync({ id: itemId });
  };

  const updateNoteColumnWidth = (columnIndex: number, width: number) => {
    if (!permissions.canEditCard) return;
    const nextNoteTable = {
      ...noteTable,
      columnWidths: noteTable.columnWidths.map((currentWidth, currentIndex) =>
        currentIndex === columnIndex ? Math.min(480, Math.max(100, width)) : currentWidth,
      ),
    };
    setNoteTable(nextNoteTable);
    void saveNoteTable(nextNoteTable);
  };

  const updateNoteCell = (rowIndex: number, columnIndex: number, value: string) => {
    const nextNoteTable = {
      ...noteTable,
      rows: noteTable.rows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) => (currentColumnIndex === columnIndex ? value : cell))
          : row,
      ),
    };
    setNoteTable(nextNoteTable);
  };

  const saveNoteCell = () => {
    if (!permissions.canEditCard) return;
    void saveNoteTable(noteTable);
  };

  const addNoteRow = () => {
    if (!permissions.canEditCard) return;
    const nextNoteTable = {
      ...noteTable,
      rows: [...noteTable.rows, Array.from({ length: noteTable.columnCount }, () => "")],
    };
    setNoteTable(nextNoteTable);
    void saveNoteTable(nextNoteTable);
  };

  const deleteNoteRow = (rowIndex: number) => {
    if (!permissions.canEditCard || noteTable.rows.length <= 1) return;
    const nextRows = noteTable.rows.filter((_row, currentRowIndex) => currentRowIndex !== rowIndex);
    const nextNoteTable = {
      ...noteTable,
      rows: nextRows.length > 0 ? nextRows : createEmptyNoteTable(noteTable.columnCount).rows,
    };
    setNoteTable(nextNoteTable);
    void saveNoteTable(nextNoteTable);
  };

  return (
    <div key={containerKey} className="mt-5 w-full rounded-xl border-2 border-violet-100 bg-white p-3 sm:p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3">
        <p className="text-center text-base font-bold text-violet-800 sm:text-left">Card Content Tabs</p>
        <div className="flex w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-violet-100 bg-violet-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("item")}
            className={`flex-1 min-w-[100px] rounded-md px-2 py-2 text-center font-bold transition-all sm:flex-none sm:px-6 ${
              activeTab === "item"
                ? "bg-violet-700 text-white shadow-md ring-2 ring-violet-400"
                : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-gray-200"
            } text-xs sm:text-sm cursor-pointer`}
          >
            Item
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("note")}
            className={`flex-1 min-w-[100px] rounded-md px-2 py-2 text-center font-bold transition-all sm:flex-none sm:px-6 ${
              activeTab === "note"
                ? "bg-violet-700 text-white shadow-md ring-2 ring-violet-400"
                : "bg-white text-gray-600 hover:bg-violet-100 hover:text-violet-700 border border-gray-200"
            } text-xs sm:text-sm cursor-pointer`}
          >
            Note
          </button>
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
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap hidden md:table-cell">Timestamp</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 hidden sm:table-cell">Note</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {expenseItems.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                          No expenses for this card.
                        </td>
                      </tr>
                    )}
                    {(() => {
                      const startIndex = (expensePage - 1) * EXPENSE_PAGE_SIZE;
                      const endIndex = startIndex + EXPENSE_PAGE_SIZE;
                      const paginatedExpenses = expenseItems.slice(startIndex, endIndex);
                      return paginatedExpenses;
                    })().map((expense) => (
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
                            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap hidden md:table-cell">
                              {expense.timestamp ? format(toZonedTime(new Date(expense.timestamp), "Asia/Bangkok"), "MMM d, yyyy HH:mm") : "—"}
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

            {/* Pagination */}
            {expenseItems.length > EXPENSE_PAGE_SIZE && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2">
                <p className="text-xs text-gray-600">
                  Showing {((expensePage - 1) * EXPENSE_PAGE_SIZE) + 1} to {Math.min(expensePage * EXPENSE_PAGE_SIZE, expenseItems.length)} of {expenseItems.length} expenses
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpensePage(expensePage - 1)}
                    disabled={expensePage === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="text-sm font-medium text-gray-700">
                    Page {expensePage} of {Math.ceil(expenseItems.length / EXPENSE_PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpensePage(expensePage + 1)}
                    disabled={expensePage >= Math.ceil(expenseItems.length / EXPENSE_PAGE_SIZE)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

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

        {activeTab === "item" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <p className="text-xs text-gray-500">
              Add item rows with name/title, link, value, date, media, and database timestamp.
            </p>
            {!permissions.canEditCard && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This card is locked. Item rows are view-only.
              </div>
            )}

            <div className="-mx-3 overflow-x-auto sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Name / Title</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Link</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Value</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Media</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap hidden md:table-cell">DB Timestamp</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {itemRowsQuery.isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500">
                          Loading item rows...
                        </td>
                      </tr>
                    ) : itemRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500">
                          No item rows for this card.
                        </td>
                      </tr>
                    ) : (
                      itemRows.map((item) => {
                        const isImage = item.media?.mimeType.startsWith("image/") ?? false;
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900 break-words">{item.nameTitle}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {item.linkUrl ? (
                                <a
                                  href={item.linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-violet-700 underline-offset-2 hover:underline"
                                >
                                  Open link
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2 font-semibold text-green-700 whitespace-nowrap">
                              {item.value.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                              {item.itemDate ? format(new Date(item.itemDate), "MMM d, yyyy") : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {item.media ? (
                                <div className="flex items-center gap-2">
                                  {isImage ? (
                                    <a
                                      href={item.media.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="relative block h-10 w-10 overflow-hidden rounded border border-gray-200"
                                    >
                                      <Image
                                        src={item.media.url}
                                        alt={item.media.originalName}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={item.media.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-violet-200 hover:bg-violet-50"
                                    >
                                      View file
                                    </a>
                                  )}
                                  <span className="max-w-[140px] truncate text-xs text-gray-500" title={item.media.originalName}>
                                    {item.media.originalName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap hidden md:table-cell">
                              {format(toZonedTime(new Date(item.createdAt), "Asia/Bangkok"), "MMM d, yyyy HH:mm")}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {permissions.canEditCard && (
                                <button
                                  type="button"
                                  onClick={() => void deleteItemRow(item.id)}
                                  disabled={deleteItemMutation.isPending}
                                  className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">SUM</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-green-700 whitespace-nowrap">{itemTotalValue.toLocaleString()}</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {permissions.canEditCard && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="mb-2 text-xs font-medium text-violet-700">Add New Item Row</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">1. Name / Title *</label>
                    <input
                      type="text"
                      value={newItemNameTitle}
                      onChange={(e) => setNewItemNameTitle(e.currentTarget.value)}
                      placeholder="Invoice #123, Movie: Inception"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">2. Link (URL)</label>
                    <input
                      type="url"
                      value={newItemLinkUrl}
                      onChange={(e) => setNewItemLinkUrl(e.currentTarget.value)}
                      placeholder="https://example.com"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">3. Value</label>
                    <input
                      type="number"
                      value={newItemValue}
                      onChange={(e) =>
                        setNewItemValue(e.currentTarget.value === "" ? "" : Number(e.currentTarget.value))
                      }
                      placeholder="0"
                      min="0"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">4. Date</label>
                    <input
                      type="date"
                      value={newItemDate}
                      onChange={(e) => setNewItemDate(e.currentTarget.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs text-gray-600">5. Media</label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={(e) => {
                        void handleItemMediaChange(e);
                      }}
                      className="w-full text-sm text-gray-600"
                    />
                    {itemMediaUploading && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
                  </div>
                  {newItemMedia && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                      <span className="max-w-[220px] truncate">{newItemMedia.originalName}</span>
                      <button
                        type="button"
                        onClick={() => setNewItemMedia(null)}
                        className="rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      void addItemRow();
                    }}
                    disabled={!newItemNameTitle.trim() || savingTab === "item" || createItemMutation.isPending}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingTab === "item" || createItemMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Add Item Row
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "note" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Build a custom note table. The first row is the header, and data rows alternate highlight colors.
              </p>
              <div className="flex items-center gap-1 self-start sm:self-auto">
                <span className="mr-2 text-xs font-medium text-gray-600">Columns</span>
                <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => updateNoteColumnCount(Math.max(1, noteTable.columnCount - 1))}
                    disabled={!permissions.canEditCard || savingTab === "note" || noteTable.columnCount <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[24px] text-center text-sm font-semibold text-gray-700">
                    {noteTable.columnCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateNoteColumnCount(Math.min(8, noteTable.columnCount + 1))}
                    disabled={!permissions.canEditCard || savingTab === "note" || noteTable.columnCount >= 8}
                    className="flex h-7 w-7 items-center justify-center rounded bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            {!permissions.canEditCard && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This card is locked. Note rows are view-only.
              </div>
            )}

            <div className="max-h-[600px] overflow-auto rounded-lg border border-violet-100">
              <table className="border-separate border-spacing-0 text-sm" style={{ minWidth: "100%" }}>
                <colgroup>
                  {noteTable.columnWidths.map((width, columnIndex) => (
                    <col key={`note-col-${columnIndex}`} style={{ width: `${width}px` }} />
                  ))}
                  <col style={{ width: "56px" }} />
                </colgroup>
                <tbody>
                  {noteTable.rows.map((row, rowIndex) => (
                    <tr
                      key={`note-row-${rowIndex}`}
                      className={
                        rowIndex === 0
                          ? "bg-violet-100"
                          : rowIndex % 2 === 1
                            ? "bg-violet-50/60"
                            : "bg-white"
                      }
                    >
                      {row.map((cell, columnIndex) => (
                        <td key={`note-cell-${rowIndex}-${columnIndex}`} className="border-b border-r border-violet-100 last:border-r-0 relative">
                          <textarea
                            value={cell}
                            onChange={(e) => updateNoteCell(rowIndex, columnIndex, e.currentTarget.value)}
                            onBlur={saveNoteCell}
                            placeholder={rowIndex === 0 ? `Header ${columnIndex + 1}` : `Row ${rowIndex}, column ${columnIndex + 1}`}
                            disabled={!permissions.canEditCard}
                            rows={rowIndex === 0 ? 1 : 2}
                            className={`block w-full resize overflow-auto whitespace-pre-wrap break-words border-0 bg-transparent px-3 py-2.5 leading-6 focus:outline-none ${
                              rowIndex === 0 ? "font-semibold text-violet-900" : "text-gray-700"
                            } disabled:cursor-default`}
                            style={{ minWidth: `${noteTable.columnWidths[columnIndex]}px` }}
                          />
                        </td>
                      ))}
                      <td className={`border-b border-violet-100 px-2 py-2 text-right ${rowIndex === 0 ? "bg-violet-100" : rowIndex % 2 === 1 ? "bg-violet-50/60" : "bg-white"}`}>
                        {permissions.canEditCard ? (
                          <button
                            type="button"
                            onClick={() => deleteNoteRow(rowIndex)}
                            disabled={noteTable.rows.length <= 1}
                            className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <FileText className="h-4 w-4 text-violet-300" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Each column width can be adjusted separately. Long text wraps onto new lines and rows can grow taller.
              </p>
              {permissions.canEditCard && (
                <button
                  type="button"
                  onClick={addNoteRow}
                  disabled={savingTab === "note"}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingTab === "note" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add Row
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
