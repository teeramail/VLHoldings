"use client";

import React, { useState, useMemo, useCallback } from "react";
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
  Download,
  Archive,
  Search,
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
  description: string | null;
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
  const parsedNotes = useMemo(() => parseCardNotes(card.notes), [card.notes]);
  const [activeTab, setActiveTab] = useState<"item" | "discussion" | "calendar" | "expense" | "note">("item");
  const [savingTab, setSavingTab] = useState<"calendar" | "expense" | "item" | "note" | null>(null);
  const permissions = useMemo(() => getCardPermissions(card.title), [card.title]);

  // Use a key to force re-render on card change
  const containerKey = useMemo(() => `card-tabs-${card.id}`, [card.id]);

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
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemLinkUrl, setNewItemLinkUrl] = useState("");
  const [newItemValue, setNewItemValue] = useState<number | "">("");
  const [newItemDate, setNewItemDate] = useState("");
  const [newItemMedia, setNewItemMedia] = useState<ItemMedia | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemNameTitle, setEditingItemNameTitle] = useState("");
  const [editingItemDescription, setEditingItemDescription] = useState("");
  const [editingItemLinkUrl, setEditingItemLinkUrl] = useState("");
  const [editingItemValue, setEditingItemValue] = useState<number | "">("");
  const [editingItemDate, setEditingItemDate] = useState("");
  const [editingItemMedia, setEditingItemMedia] = useState<ItemMedia | null>(null);
  const [editingItemMediaDirty, setEditingItemMediaDirty] = useState(false);
  const [viewingItemIndex, setViewingItemIndex] = useState<number | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemPage, setItemPage] = useState(1);
  const ITEM_PAGE_SIZE = 10;
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(() => new Set());
  const [itemMediaUploading, setItemMediaUploading] = useState(false);
  const [itemMediaPasteMode, setItemMediaPasteMode] = useState(false);
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
  const updateItemMutation = api.studyCardItems.update.useMutation({
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
  const itemTotalValue = useMemo(() => itemRows.reduce((sum, row) => sum + row.value, 0), [itemRows]);
  const filteredItemRows = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return itemRows;
    return itemRows.filter((row) => {
      const haystack = [
        row.nameTitle,
        row.description ?? "",
        row.linkUrl ?? "",
        row.itemDate ?? "",
        String(row.value),
        row.media?.originalName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [itemRows, itemSearch]);
  const itemTotalPages = Math.max(1, Math.ceil(filteredItemRows.length / ITEM_PAGE_SIZE));
  const effectiveItemPage = Math.min(itemPage, itemTotalPages);
  const paginatedItemRows = useMemo(() => {
    const start = (effectiveItemPage - 1) * ITEM_PAGE_SIZE;
    return filteredItemRows.slice(start, start + ITEM_PAGE_SIZE);
  }, [filteredItemRows, effectiveItemPage]);

  const saveCalendarEvents = useCallback(async (events: CalendarEvent[]) => {
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
  }, [card.id, permissions.canAddCalendar, updateCard]);

  const addCalendarEvent = useCallback(() => {
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
  }, [calendarEvents, newEventDate, newEventNote, newEventTime, permissions.canAddCalendar, saveCalendarEvents]);

  const deleteCalendarEvent = useCallback((id: string) => {
    if (!permissions.canDeleteCalendar) return;
    if (!confirm("Delete this event?")) return;
    const updatedEvents = calendarEvents.filter((e) => e.id !== id);
    setCalendarEvents(updatedEvents);
    void saveCalendarEvents(updatedEvents);
  }, [calendarEvents, permissions.canDeleteCalendar, saveCalendarEvents]);

  const updateCalendarEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
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
  }, [calendarEvents, permissions.canEditCalendar, saveCalendarEvents]);

  const saveExpenseItems = useCallback(async (items: ExpenseItem[]) => {
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
  }, [card.id, permissions.canAddExpense, updateCard]);

  const addExpenseItem = useCallback(() => {
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
  }, [expenseItems, newExpenseAmount, newExpenseDate, newExpenseItem, newExpenseNote, permissions.canAddExpense, saveExpenseItems]);

  const deleteExpenseItem = useCallback((id: string) => {
    if (!permissions.canDeleteExpense) return;
    if (!confirm("Delete this expense?")) return;
    const updatedItems = expenseItems.filter((e) => e.id !== id);
    setExpenseItems(updatedItems);
    void saveExpenseItems(updatedItems);
  }, [expenseItems, permissions.canDeleteExpense, saveExpenseItems]);

  const updateExpenseItem = useCallback((id: string, updates: Partial<ExpenseItem>) => {
    if (!permissions.canEditExpense) return;
    const updatedItems = expenseItems
      .map((e) => (e.id === id ? { ...e, ...updates } : e))
      .sort((a, b) => b.date.localeCompare(a.date));
    setExpenseItems(updatedItems);
    void saveExpenseItems(updatedItems);
    setEditingExpenseId(null);
  }, [expenseItems, permissions.canEditExpense, saveExpenseItems]);

  const saveNoteTable = useCallback(async (nextNoteTable: NoteTableData) => {
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
  }, [card.id, parsedNotes.text, permissions.canEditCard, updateCard]);

  const updateNoteColumnCount = useCallback((columnCount: number) => {
    if (!permissions.canEditCard) return;
    const nextNoteTable = normalizeNoteTable({
      columnCount,
      columnWidths: noteTable.columnWidths,
      rows: noteTable.rows,
    });
    setNoteTable(nextNoteTable);
    void saveNoteTable(nextNoteTable);
  }, [noteTable.columnWidths, noteTable.rows, permissions.canEditCard, saveNoteTable]);

  const uploadItemMedia = useCallback(async (file: File): Promise<ItemMedia | null> => {
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

      const extension = finalContentType === "image/webp" ? "webp" : "bin";
      const uploadFileName = finalFile.name || file.name || `upload-${Date.now()}.${extension}`;

      const presignRes = await fetch("/api/presign-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadFileName,
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
        headers: { "Content-Type": finalContentType, "x-amz-acl": "public-read" },
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
  }, []);

  const handleItemMediaChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10 MB limit");
      e.target.value = "";
      return;
    }
    
    const uploaded = await uploadItemMedia(file);
    if (uploaded) {
      setNewItemMedia(uploaded);
    }
    e.target.value = "";
  }, [uploadItemMedia]);

  const handleItemMediaPaste = useCallback(async (e: ClipboardEvent) => {
    if (!itemMediaPasteMode) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          if (file.size > 10 * 1024 * 1024) {
            alert("File size exceeds 10 MB limit");
            setItemMediaPasteMode(false);
            return;
          }
          
          const uploaded = await uploadItemMedia(file);
          if (uploaded) {
            setNewItemMedia(uploaded);
          }
          setItemMediaPasteMode(false);
          return;
        }
      }
    }
  }, [itemMediaPasteMode, uploadItemMedia]);

  React.useEffect(() => {
    if (itemMediaPasteMode) {
      document.addEventListener("paste", handleItemMediaPaste);
      return () => document.removeEventListener("paste", handleItemMediaPaste);
    }
  }, [handleItemMediaPaste, itemMediaPasteMode]);

  // Clamp viewingItemIndex if the filtered items list shrinks/changes
  React.useEffect(() => {
    if (viewingItemIndex === null) return;
    if (filteredItemRows.length === 0) {
      setViewingItemIndex(null);
      return;
    }
    if (viewingItemIndex >= filteredItemRows.length) {
      setViewingItemIndex(filteredItemRows.length - 1);
    }
  }, [filteredItemRows.length, viewingItemIndex]);

  // Reset to page 1 when the search changes
  React.useEffect(() => {
    setItemPage(1);
  }, [itemSearch]);

  const closeItemViewer = useCallback(() => setViewingItemIndex(null), []);
  const showPrevItem = useCallback(() => {
    setViewingItemIndex((idx) => {
      if (idx === null || filteredItemRows.length === 0) return idx;
      return idx === 0 ? filteredItemRows.length - 1 : idx - 1;
    });
  }, [filteredItemRows.length]);
  const showNextItem = useCallback(() => {
    setViewingItemIndex((idx) => {
      if (idx === null || filteredItemRows.length === 0) return idx;
      return idx === filteredItemRows.length - 1 ? 0 : idx + 1;
    });
  }, [itemRows.length]);

  // Keyboard navigation while the viewer is open
  React.useEffect(() => {
    if (viewingItemIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeItemViewer();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        showPrevItem();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        showNextItem();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeItemViewer, showNextItem, showPrevItem, viewingItemIndex]);

  const goToItemPage = useCallback((page: number) => {
    setItemPage(() => Math.min(Math.max(1, page), itemTotalPages));
  }, [itemTotalPages]);

  const addItemRow = useCallback(async () => {
    if (!permissions.canEditCard) return;
    if (!newItemNameTitle.trim()) return;
    setSavingTab("item");
    try {
      await createItemMutation.mutateAsync({
        cardId: card.id,
        nameTitle: newItemNameTitle.trim(),
        description: newItemDescription.trim() || undefined,
        linkUrl: newItemLinkUrl.trim() || undefined,
        value: newItemValue === "" ? 0 : Number(newItemValue),
        itemDate: newItemDate || undefined,
        media: newItemMedia,
      });
      setNewItemNameTitle("");
      setNewItemDescription("");
      setNewItemLinkUrl("");
      setNewItemValue("");
      setNewItemDate("");
      setNewItemMedia(null);
    } finally {
      setSavingTab(null);
    }
  }, [card.id, createItemMutation, newItemDate, newItemDescription, newItemLinkUrl, newItemMedia, newItemNameTitle, newItemValue, permissions.canEditCard]);

  const deleteItemRow = useCallback(async (itemId: number) => {
    if (!permissions.canEditCard) return;
    if (!confirm("Delete this item row?")) return;
    await deleteItemMutation.mutateAsync({ id: itemId });
  }, [deleteItemMutation, permissions.canEditCard]);

  const startEditItemRow = useCallback((item: CardItemRow) => {
    setEditingItemId(item.id);
    setEditingItemNameTitle(item.nameTitle);
    setEditingItemDescription(item.description ?? "");
    setEditingItemLinkUrl(item.linkUrl ?? "");
    setEditingItemValue(item.value);
    setEditingItemDate(item.itemDate ?? "");
    setEditingItemMedia(item.media ?? null);
    setEditingItemMediaDirty(false);
  }, []);

  const cancelEditItemRow = useCallback(() => {
    setEditingItemId(null);
    setEditingItemNameTitle("");
    setEditingItemDescription("");
    setEditingItemLinkUrl("");
    setEditingItemValue("");
    setEditingItemDate("");
    setEditingItemMedia(null);
    setEditingItemMediaDirty(false);
  }, []);

  const handleEditingItemMediaChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10 MB limit");
      e.target.value = "";
      return;
    }
    const uploaded = await uploadItemMedia(file);
    if (uploaded) {
      setEditingItemMedia(uploaded);
      setEditingItemMediaDirty(true);
    }
    e.target.value = "";
  }, [uploadItemMedia]);

  const removeEditingItemMedia = useCallback(() => {
    setEditingItemMedia(null);
    setEditingItemMediaDirty(true);
  }, []);

  const saveEditItemRow = useCallback(async () => {
    if (!permissions.canEditCard || editingItemId === null) return;
    if (!editingItemNameTitle.trim()) return;

    await updateItemMutation.mutateAsync({
      id: editingItemId,
      nameTitle: editingItemNameTitle.trim(),
      description: editingItemDescription.trim() || undefined,
      linkUrl: editingItemLinkUrl.trim() || undefined,
      value: editingItemValue === "" ? 0 : Number(editingItemValue),
      itemDate: editingItemDate || undefined,
      ...(editingItemMediaDirty ? { media: editingItemMedia } : {}),
    });

    cancelEditItemRow();
  }, [
    cancelEditItemRow,
    editingItemDate,
    editingItemDescription,
    editingItemId,
    editingItemLinkUrl,
    editingItemMedia,
    editingItemMediaDirty,
    editingItemNameTitle,
    editingItemValue,
    permissions.canEditCard,
    updateItemMutation,
  ]);

  const updateNoteColumnWidth = useCallback((columnIndex: number, width: number) => {
    if (!permissions.canEditCard) return;
    const nextNoteTable = {
      ...noteTable,
      columnWidths: noteTable.columnWidths.map((currentWidth, currentIndex) =>
        currentIndex === columnIndex ? Math.min(480, Math.max(100, width)) : currentWidth,
      ),
    };
    setNoteTable(nextNoteTable);
    void saveNoteTable(nextNoteTable);
  }, [noteTable, permissions.canEditCard, saveNoteTable]);

  const updateNoteCell = useCallback((rowIndex: number, columnIndex: number, value: string) => {
    setNoteTable(prev => ({
      ...prev,
      rows: prev.rows.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) => (currentColumnIndex === columnIndex ? value : cell))
          : row
      ),
    }));
  }, []);

  const saveNoteCell = useCallback(() => {
    if (!permissions.canEditCard) return;
    void saveNoteTable(noteTable);
  }, [noteTable, permissions.canEditCard, saveNoteTable]);

  const addNoteRow = useCallback(() => {
    if (!permissions.canEditCard) return;
    setNoteTable(prev => ({
      ...prev,
      rows: [...prev.rows, Array.from({ length: prev.columnCount }, () => "")]
    }));
    // We need to save the table after state update, but setNoteTable is async.
    // However, the current pattern calls saveNoteTable with the next state.
    const nextNoteTable = {
      ...noteTable,
      rows: [...noteTable.rows, Array.from({ length: noteTable.columnCount }, () => "")]
    };
    void saveNoteTable(nextNoteTable);
  }, [noteTable, permissions.canEditCard, saveNoteTable]);

  const deleteNoteRow = useCallback((rowIndex: number) => {
    if (!permissions.canEditCard || noteTable.rows.length <= 1) return;
    const nextRows = noteTable.rows.filter((_row, currentRowIndex) => currentRowIndex !== rowIndex);
    const nextNoteTable = {
      ...noteTable,
      rows: nextRows.length > 0 ? nextRows : createEmptyNoteTable(noteTable.columnCount).rows,
    };
    setNoteTable(nextNoteTable);
    void saveNoteTable(nextNoteTable);
  }, [noteTable, permissions.canEditCard, saveNoteTable]);

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

            {/* Search + total count */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.currentTarget.value)}
                  placeholder="Search items (name, description, link, date)..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-8 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                {itemSearch && (
                  <button
                    type="button"
                    onClick={() => setItemSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {itemSearch
                  ? `${filteredItemRows.length} of ${itemRows.length} items`
                  : `${itemRows.length} items`}
              </p>
            </div>

            <div className="-mx-3 overflow-x-auto sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Name / Title</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Description</th>
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
                        <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500">
                          Loading item rows...
                        </td>
                      </tr>
                    ) : filteredItemRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500">
                          {itemSearch
                            ? `No items match "${itemSearch}".`
                            : "No item rows for this card."}
                        </td>
                      </tr>
                    ) : (
                      paginatedItemRows.map((item, pageIndex) => {
                        const itemIndex = (effectiveItemPage - 1) * ITEM_PAGE_SIZE + pageIndex;
                        const isEditingItem = editingItemId === item.id;
                        const isImage = item.media
                          ? (item.media.mimeType.startsWith("image/") ||
                            /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(
                              item.media.originalName || item.media.fileName,
                            ))
                          : false;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => {
                              if (isEditingItem) return;
                              setViewingItemIndex(itemIndex);
                            }}
                            className={`hover:bg-violet-50 ${isEditingItem ? "" : "cursor-pointer"}`}
                          >
                            <td className="px-3 py-2 font-medium text-gray-900 break-words">
                              {isEditingItem ? (
                                <input
                                  type="text"
                                  value={editingItemNameTitle}
                                  onChange={(e) => setEditingItemNameTitle(e.currentTarget.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                              ) : (
                                item.nameTitle
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-600 max-w-[200px]">
                              {isEditingItem ? (
                                <input
                                  type="text"
                                  value={editingItemDescription}
                                  onChange={(e) => setEditingItemDescription(e.currentTarget.value)}
                                  placeholder="Short details"
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                              ) : item.description?.trim() ? (
                                <div>
                                  <p className={expandedDescriptions.has(item.id) ? "whitespace-pre-wrap break-words text-xs" : "line-clamp-2 break-words text-xs"}>
                                    {item.description.trim()}
                                  </p>
                                  {item.description.trim().length > 80 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedDescriptions((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(item.id)) next.delete(item.id);
                                          else next.add(item.id);
                                          return next;
                                        });
                                      }}
                                      className="mt-0.5 text-[11px] font-medium text-violet-600 hover:underline"
                                    >
                                      {expandedDescriptions.has(item.id) ? "less" : "more"}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {isEditingItem ? (
                                <input
                                  type="url"
                                  value={editingItemLinkUrl}
                                  onChange={(e) => setEditingItemLinkUrl(e.currentTarget.value)}
                                  placeholder="https://example.com"
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                              ) : (
                                item.linkUrl ? (
                                  <a
                                    href={item.linkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-violet-700 underline-offset-2 hover:underline"
                                  >
                                    Open link
                                  </a>
                                ) : (
                                  "—"
                                )
                              )}
                            </td>
                            <td className="px-3 py-2 font-semibold text-green-700 whitespace-nowrap">
                              {isEditingItem ? (
                                <input
                                  type="number"
                                  value={editingItemValue}
                                  onChange={(e) =>
                                    setEditingItemValue(e.currentTarget.value === "" ? "" : Number(e.currentTarget.value))
                                  }
                                  min="0"
                                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                              ) : (
                                item.value.toLocaleString()
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                              {isEditingItem ? (
                                <input
                                  type="date"
                                  value={editingItemDate}
                                  onChange={(e) => setEditingItemDate(e.currentTarget.value)}
                                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                              ) : (
                                item.itemDate ? format(new Date(item.itemDate), "MMM d, yyyy") : "—"
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditingItem ? (
                                <div className="flex flex-col gap-1">
                                  {editingItemMedia ? (
                                    <div className="flex items-center gap-2">
                                      {editingItemMedia.mimeType.startsWith("image/") ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                          src={editingItemMedia.url}
                                          alt={editingItemMedia.originalName}
                                          width={40}
                                          height={40}
                                          className="h-10 w-10 shrink-0 rounded border border-gray-200 object-cover"
                                        />
                                      ) : (
                                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50">
                                          {editingItemMedia.mimeType === "application/pdf"
                                            ? <FileText className="h-4 w-4 text-red-400" />
                                            : <Archive className="h-4 w-4 text-amber-500" />}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeEditingItemMedia();
                                        }}
                                        className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">No media</span>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="file"
                                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                      onChange={(e) => {
                                        void handleEditingItemMediaChange(e);
                                      }}
                                      disabled={itemMediaUploading}
                                      className="w-full text-xs text-gray-600"
                                    />
                                    {itemMediaUploading && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
                                  </div>
                                </div>
                              ) : item.media ? (
                                <div className="flex items-center gap-2">
                                  {isImage ? (
                                    <a
                                      href={item.media.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="block h-10 w-10 shrink-0 overflow-hidden rounded border border-gray-200"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={item.media.url}
                                        alt={item.media.originalName}
                                        width={40}
                                        height={40}
                                        className="h-full w-full object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={`/api/download?url=${encodeURIComponent(item.media.url)}&filename=${encodeURIComponent(item.media.originalName)}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-50"
                                      title={`Download ${item.media.originalName}`}
                                    >
                                      {item.media.mimeType === "application/pdf"
                                        ? <FileText className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                        : <Archive className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                      <Download className="h-3 w-3 shrink-0" />
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
                            <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                              {permissions.canEditCard && (
                                <div className="flex items-center justify-end gap-1">
                                  {isEditingItem ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void saveEditItemRow();
                                        }}
                                        disabled={updateItemMutation.isPending || !editingItemNameTitle.trim()}
                                        className="rounded border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {updateItemMutation.isPending ? "Saving..." : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditItemRow}
                                        disabled={updateItemMutation.isPending}
                                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => startEditItemRow(item)}
                                      disabled={updateItemMutation.isPending || deleteItemMutation.isPending}
                                      className="rounded p-1 text-gray-400 hover:bg-violet-100 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void deleteItemRow(item.id)}
                                    disabled={deleteItemMutation.isPending || updateItemMutation.isPending}
                                    className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
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
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-green-700 whitespace-nowrap">{itemTotalValue.toLocaleString()}</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {filteredItemRows.length > ITEM_PAGE_SIZE && (
              <div className="flex flex-col items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 sm:flex-row">
                <p className="text-xs text-gray-600">
                  Showing {(effectiveItemPage - 1) * ITEM_PAGE_SIZE + 1}–{Math.min(effectiveItemPage * ITEM_PAGE_SIZE, filteredItemRows.length)} of {filteredItemRows.length}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToItemPage(effectiveItemPage - 1)}
                    disabled={effectiveItemPage === 1}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </button>
                  {(() => {
                    const pages: (number | "...")[] = [];
                    const maxButtons = 7;
                    if (itemTotalPages <= maxButtons) {
                      for (let i = 1; i <= itemTotalPages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      const left = Math.max(2, effectiveItemPage - 1);
                      const right = Math.min(itemTotalPages - 1, effectiveItemPage + 1);
                      if (left > 2) pages.push("...");
                      for (let i = left; i <= right; i++) pages.push(i);
                      if (right < itemTotalPages - 1) pages.push("...");
                      pages.push(itemTotalPages);
                    }
                    return pages.map((p, i) =>
                      p === "..." ? (
                        <span key={`ell-${i}`} className="px-1 text-xs text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => goToItemPage(p)}
                          className={`min-w-[28px] rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            p === effectiveItemPage
                              ? "bg-violet-600 text-white"
                              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => goToItemPage(effectiveItemPage + 1)}
                    disabled={effectiveItemPage >= itemTotalPages}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {viewingItemIndex !== null && filteredItemRows[viewingItemIndex] && (() => {
              const viewItem = filteredItemRows[viewingItemIndex];
              const viewIsImage = viewItem.media
                ? (viewItem.media.mimeType.startsWith("image/") ||
                  /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(
                    viewItem.media.originalName || viewItem.media.fileName,
                  ))
                : false;
              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  onClick={closeItemViewer}
                >
                  <div
                    className="relative max-h-[92vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl ring-2 ring-violet-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Top nav: Previous / counter / Next / Close */}
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={showPrevItem}
                        disabled={filteredItemRows.length <= 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-violet-600">
                          Item {viewingItemIndex + 1} of {filteredItemRows.length}
                        </span>
                        <button
                          type="button"
                          onClick={closeItemViewer}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                          aria-label="Close"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={showNextItem}
                        disabled={filteredItemRows.length <= 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 break-words">
                      {viewItem.nameTitle}
                    </h3>

                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Description</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words text-gray-800">
                          {viewItem.description?.trim() ? viewItem.description : <span className="text-gray-400">—</span>}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Media</dt>
                        <dd className="mt-1">
                          {viewItem.media ? (
                            viewIsImage ? (
                              <a
                                href={viewItem.media.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={viewItem.media.url}
                                  alt={viewItem.media.originalName}
                                  className="max-h-[50vh] w-full object-contain"
                                />
                              </a>
                            ) : (
                              <a
                                href={`/api/download?url=${encodeURIComponent(viewItem.media.url)}&filename=${encodeURIComponent(viewItem.media.originalName)}`}
                                className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-violet-300 hover:bg-violet-50"
                              >
                                {viewItem.media.mimeType === "application/pdf"
                                  ? <FileText className="h-4 w-4 text-red-400" />
                                  : <Archive className="h-4 w-4 text-amber-500" />}
                                <span className="max-w-[260px] truncate">{viewItem.media.originalName}</span>
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">DB Timestamp</dt>
                        <dd className="mt-1 text-xs text-gray-500">
                          {format(toZonedTime(new Date(viewItem.createdAt), "Asia/Bangkok"), "MMM d, yyyy HH:mm")}
                        </dd>
                      </div>
                    </dl>

                    {/* Bottom meta row: Value / Date / Link */}
                    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 font-semibold text-green-700">
                        Value: {viewItem.value.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                        Date: {viewItem.itemDate ? format(new Date(viewItem.itemDate), "MMM d, yyyy") : "—"}
                      </span>
                      {viewItem.linkUrl ? (
                        <a
                          href={viewItem.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-100 px-3 py-1 font-medium text-violet-700 hover:bg-violet-200"
                        >
                          <span className="truncate">Link: {viewItem.linkUrl}</span>
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-500">
                          Link: —
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

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
                    <label className="mb-1 block text-xs text-gray-600">2. Description</label>
                    <input
                      type="text"
                      value={newItemDescription}
                      onChange={(e) => setNewItemDescription(e.currentTarget.value)}
                      placeholder="Short details"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">3. Link (URL)</label>
                    <input
                      type="url"
                      value={newItemLinkUrl}
                      onChange={(e) => setNewItemLinkUrl(e.currentTarget.value)}
                      placeholder="https://example.com"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">4. Value</label>
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
                    <label className="mb-1 block text-xs text-gray-600">5. Date</label>
                    <input
                      type="date"
                      value={newItemDate}
                      onChange={(e) => setNewItemDate(e.currentTarget.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs text-gray-600">6. Media</label>

                  {/* Preview if media is selected */}
                  {newItemMedia ? (
                    <div className="mb-2 flex items-center gap-3 rounded-lg border border-violet-200 bg-white p-2">
                      {newItemMedia.mimeType.startsWith("image/") ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={newItemMedia.url}
                          alt={newItemMedia.originalName}
                          className="h-16 w-16 shrink-0 rounded border border-gray-200 object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50">
                          {newItemMedia.mimeType === "application/pdf"
                            ? <FileText className="h-6 w-6 text-red-400" />
                            : <Archive className="h-6 w-6 text-amber-500" />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {newItemMedia.originalName}
                        </p>
                        <p className="text-xs text-gray-500">Ready to upload</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewItemMedia(null)}
                        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {/* Camera (mobile-first) */}
                      <label
                        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-violet-300 bg-white px-4 py-4 text-center text-sm font-medium text-violet-700 transition-colors hover:border-violet-500 hover:bg-violet-50 ${
                          itemMediaUploading ? "cursor-not-allowed opacity-50" : ""
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            void handleItemMediaChange(e);
                          }}
                          disabled={itemMediaUploading}
                          className="sr-only"
                        />
                        <span className="text-2xl leading-none">📷</span>
                        <span>Take Photo</span>
                      </label>

                      {/* Choose from device */}
                      <label
                        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-4 text-center text-sm font-medium text-gray-700 transition-colors hover:border-violet-400 hover:bg-violet-50 ${
                          itemMediaUploading ? "cursor-not-allowed opacity-50" : ""
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={(e) => {
                            void handleItemMediaChange(e);
                          }}
                          disabled={itemMediaUploading}
                          className="sr-only"
                        />
                        <span className="text-2xl leading-none">📁</span>
                        <span>Choose File</span>
                      </label>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {itemMediaUploading && (
                      <span className="inline-flex items-center gap-1 text-xs text-violet-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </span>
                    )}
                    {/* Desktop-only paste helper */}
                    <button
                      type="button"
                      onClick={() => setItemMediaPasteMode(true)}
                      disabled={itemMediaUploading || itemMediaPasteMode}
                      className={`hidden sm:inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
                        itemMediaPasteMode
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {itemMediaPasteMode ? "Ready to paste (Ctrl+V)..." : "📋 Paste from clipboard"}
                    </button>
                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    Max 10 MB. Images &gt;100 KB auto-compress to WebP.
                  </p>
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
