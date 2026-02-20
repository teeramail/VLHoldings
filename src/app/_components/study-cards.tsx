"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  Plus,
  Search,
  BookOpen,
  Star,
  CheckCircle2,
  Play,
  X,
  Edit,
  Trash2,
  Save,
  Upload,
  ImageIcon,
  Paperclip,
  FileText,
  FileVideo,
  Download,
  Loader2,
  Grid3x3,
  List,
  Folder,
  ClipboardPaste,
  ExternalLink,
} from "lucide-react";
import { api } from "~/trpc/react";
import { format } from "date-fns";

const SUBJECT_TAG_SUGGESTIONS = [
  "physics",
  "classical mechanics",
  "kinematics",
  "dynamics",
  "electricity",
  "electromagnetism",
  "electrostatics",
  "circuits",
  "optics",
  "thermodynamics",
  "waves",
  "sound",
  "fluid mechanics",
  "quantum physics",
  "atomic physics",
  "nuclear physics",
  "relativity",
  "astrophysics",
  "algebra",
  "linear algebra",
  "geometry",
  "trigonometry",
  "calculus",
  "statistics",
  "probability",
  "number theory",
  "discrete math",
  "arithmetic",
  "chemistry",
  "organic chemistry",
  "inorganic chemistry",
  "physical chemistry",
  "analytical chemistry",
  "biochemistry",
  "biology",
  "botany",
  "zoology",
  "genetics",
  "microbiology",
  "ecology",
  "human anatomy",
  "physiology",
  "neuroscience",
  "marine biology",
  "oceanography",
  "earth science",
  "geology",
  "meteorology",
  "astronomy",
  "space science",
  "coding",
  "computer science",
  "programming",
  "algorithms",
  "data structures",
  "web development",
  "cybersecurity",
  "ai",
  "machine learning",
  "data science",
  "robotics",
  "history",
  "world history",
  "geography",
  "economics",
  "civics",
  "english",
  "reading",
  "writing",
  "vocabulary",
  "grammar",
  "literature",
  "public speaking",
  "music",
  "art",
  "drawing",
  "design",
  "critical thinking",
  "problem solving",
];

function getYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/").filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeColorValue(value: string) {
  const color = value.trim().toLowerCase();
  if (!color || color.includes(";") || color.includes("url(") || color.includes("expression(")) {
    return false;
  }

  return (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\([\d\s.,%]+\)$/i.test(color) ||
    /^hsla?\([\d\s.,%]+\)$/i.test(color) ||
    /^[a-z]+$/i.test(color)
  );
}

function sanitizeDescriptionHtml(raw: string) {
  if (!raw) return "";
  if (typeof window === "undefined") return escapeHtml(raw);

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${raw}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  if (!root) return escapeHtml(raw);

  const allowedTags = new Set(["br", "p", "div", "span", "strong", "b", "em", "i", "u"]);

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const inner = Array.from(element.childNodes).map(sanitizeNode).join("");

    if (!allowedTags.has(tag)) {
      return inner;
    }

    if (tag === "br") {
      return "<br />";
    }

    const color = element.style.color;
    const styleAttr = color && isSafeColorValue(color) ? ` style="color:${color}"` : "";

    return `<${tag}${styleAttr}>${inner}</${tag}>`;
  };

  return Array.from(root.childNodes).map(sanitizeNode).join("");
}

function getDescriptionHtml(description: string) {
  const sanitized = sanitizeDescriptionHtml(description);
  return sanitized || "&nbsp;";
}

function getDescriptionEditorHtml(description: string) {
  if (!description) return "";

  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(description);
  if (hasHtmlTags) {
    return sanitizeDescriptionHtml(description);
  }

  return escapeHtml(description).replace(/\n/g, "<br />");
}

function getDescriptionPlainText(description: string) {
  if (!description) return "";
  if (typeof window === "undefined") {
    return description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const doc = new DOMParser().parseFromString(description, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function StudyCards() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [showCompleted, setShowCompleted] = useState<boolean | undefined>(undefined);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  const utils = api.useUtils();

  const { data: cardsData, isLoading } = api.studyCards.getAll.useQuery({
    search: search || undefined,
    category: selectedCategory || undefined,
    difficulty: selectedDifficulty || undefined,
    isCompleted: showCompleted,
    limit: 50,
  });

  const { data: categories } = api.studyCards.getCategories.useQuery();
  const { data: stats } = api.studyCards.getStats.useQuery();

  const createCard = api.studyCards.create.useMutation({
    onSuccess: () => {
      void utils.studyCards.getAll.invalidate();
      void utils.studyCards.getStats.invalidate();
      setShowCreateForm(false);
    },
  });

  const updateCard = api.studyCards.update.useMutation({
    onSuccess: () => {
      void utils.studyCards.getAll.invalidate();
      void utils.studyCards.getStats.invalidate();
      setEditingCard(null);
    },
  });

  const deleteCard = api.studyCards.delete.useMutation({
    onSuccess: () => {
      void utils.studyCards.getAll.invalidate();
      void utils.studyCards.getStats.invalidate();
    },
  });

  const uploadImage = api.studyCards.uploadImage.useMutation();

  const setImage = api.studyCards.setImage.useMutation();

  const items = cardsData?.items ?? [];

  const handleImageUpload = async (cardId: number, file: File) => {
    const result = await uploadImage.mutateAsync({
      fileName: file.name,
      contentType: file.type,
    });

    const response = await fetch(result.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    if (response.ok) {
      await setImage.mutateAsync({
        id: cardId,
        s3Key: result.s3Key,
        imageUrl: result.publicUrl,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Study Cards</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create educational cards with videos and images
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1 text-gray-600">
              <BookOpen className="h-4 w-4 text-violet-500" />
              <span className="font-medium">{stats?.total ?? 0}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">{stats?.completed ?? 0}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="font-medium">{stats?.avgRating ?? "0.0"}</span>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            New Card
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards..."
            className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="">All Categories</option>
          {categories
            ?.filter((cat): cat is string => Boolean(cat))
            .map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
        </select>
        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="">All Levels</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button
          onClick={() => {
            if (showCompleted === undefined) setShowCompleted(false);
            else if (showCompleted === false) setShowCompleted(true);
            else setShowCompleted(undefined);
          }}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            showCompleted === undefined
              ? "bg-gray-100 text-gray-700"
              : showCompleted
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {showCompleted === undefined
            ? "All Status"
            : showCompleted
            ? "Completed"
            : "Pending"}
        </button>
        <div className="flex items-center rounded-lg border border-gray-200">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 ${viewMode === "grid" ? "bg-violet-100 text-violet-700" : "text-gray-500"}`}
          >
            <Grid3x3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-violet-100 text-violet-700" : "text-gray-500"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <CreateCardForm
          onClose={() => setShowCreateForm(false)}
          onSubmit={(data) => createCard.mutate(data)}
          isSubmitting={createCard.isPending}
        />
      )}

      {selectedCard && !editingCard && (
        <StudyCardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 py-20">
          <BookOpen className="h-16 w-16 text-gray-300" />
          <p className="mt-4 text-lg font-medium text-gray-500">No study cards yet</p>
          <p className="text-sm text-gray-400">Create your first educational card</p>
        </div>
      )}

      {/* Cards Grid/List */}
      {items.length > 0 && (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "space-y-3"
          }
        >
          {items.map((card) => (
            <StudyCard
              key={card.id}
              card={card}
              viewMode={viewMode}
              isEditing={editingCard === card.id}
              onEdit={() => {
                setSelectedCard(null);
                setEditingCard(card.id);
              }}
              onSave={(data) => updateCard.mutate({ id: card.id, ...data })}
              onDelete={() => {
                if (confirm("Delete this study card?")) {
                  deleteCard.mutate({ id: card.id });
                }
              }}
              onCancel={() => setEditingCard(null)}
              onView={() => setSelectedCard(card)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StudyCardDetailModalProps {
  card: any;
  onClose: () => void;
}

function StudyCardDetailModal({ card, onClose }: StudyCardDetailModalProps) {
  const parsedAttachments: Attachment[] = card.attachments ? JSON.parse(card.attachments) : [];
  const cardImages: CardImageMeta[] = parsedAttachments
    .filter((att) => att.kind === "card-image")
    .map((att) => ({
      s3Key: att.s3Key,
      imageUrl: att.url,
      subfolder: att.subfolder,
      originalName: att.originalName,
      fileSize: att.fileSize,
    }));
  const galleryImages = [...cardImages];
  if (card.imageUrl && !galleryImages.some((img) => img.s3Key === card.imageS3Key || img.imageUrl === card.imageUrl)) {
    galleryImages.unshift({
      s3Key: card.imageS3Key ?? card.imageUrl,
      imageUrl: card.imageUrl,
      subfolder: "study-cards/images",
      originalName: "Card image",
      fileSize: 0,
    });
  }

  const embedUrl = card.youtubeUrl ? getYoutubeEmbedUrl(card.youtubeUrl) : null;
  const visibleAttachments = parsedAttachments.filter((att) => att.kind !== "card-image");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{card.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{format(new Date(card.createdAt), "MMM d, yyyy")}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {galleryImages.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-medium text-gray-700">Images</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {galleryImages.map((img) => (
                <a key={img.s3Key} href={img.imageUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                  <Image src={img.imageUrl} alt={img.originalName} fill className="object-cover" unoptimized />
                </a>
              ))}
            </div>
          </div>
        )}

        {embedUrl && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-medium text-gray-700">Video</p>
            <div className="aspect-video overflow-hidden rounded-lg border border-gray-200">
              <iframe src={embedUrl} title={card.title} className="h-full w-full" allowFullScreen />
            </div>
          </div>
        )}

        {card.referenceUrl && (
          <div className="mb-5">
            <p className="mb-2 text-sm font-medium text-gray-700">Reference Link</p>
            <a
              href={card.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              <ExternalLink className="h-4 w-4" />
              Open link
            </a>
          </div>
        )}

        <div
          className="whitespace-pre-wrap text-gray-700"
          dangerouslySetInnerHTML={{ __html: getDescriptionHtml(card.description) }}
        />

        {card.estimatedCost !== null && card.estimatedCost !== undefined && card.estimatedCost > 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">Estimated Cost:</span>
            <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">
              ${card.estimatedCost.toLocaleString()}
            </span>
          </div>
        )}

        {card.investDate && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-700">Invest Date:</span>
            <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-700">
              {format(new Date(card.investDate), "MMM d, yyyy")}
            </span>
          </div>
        )}

        {card.tags && (
          <div className="mt-4 flex flex-wrap gap-2">
            {card.tags.split(",").map((tag: string, idx: number) => (
              <span key={idx} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                {tag.trim()}
              </span>
            ))}
          </div>
        )}

        {card.notes && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {card.notes}
          </div>
        )}

        {visibleAttachments.length > 0 && (
          <div className="mt-5 rounded-lg border border-gray-200 p-3">
            <p className="mb-2 text-sm font-medium text-gray-700">Attachments</p>
            <div className="space-y-2">
              {visibleAttachments.map((att) => {
                const Icon = getAttachmentIcon(att.mimeType);
                return (
                  <a
                    key={att.s3Key}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm hover:bg-violet-50"
                  >
                    <Icon className="h-4 w-4 text-violet-500" />
                    <span className="flex-1 truncate">{att.originalName}</span>
                    <span className="text-xs text-gray-400">{formatFileSize(att.fileSize)}</span>
                    <Download className="h-4 w-4 text-gray-400" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StudyCardProps {
  card: any;
  viewMode: "grid" | "list";
  isEditing: boolean;
  onEdit: () => void;
  onSave: (data: any) => void;
  onDelete: () => void;
  onCancel: () => void;
  onView: () => void;
}

function StudyCard({
  card,
  viewMode,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onCancel,
  onView,
}: StudyCardProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [referenceUrl, setReferenceUrl] = useState(card.referenceUrl ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(card.youtubeUrl ?? "");
  const [category, setCategory] = useState(card.category ?? "");
  const [difficulty, setDifficulty] = useState(card.difficulty ?? "medium");
  const [tags, setTags] = useState(card.tags ?? "");
  const [showEditTagSuggestions, setShowEditTagSuggestions] = useState(false);
  const [notes, setNotes] = useState(card.notes ?? "");
  const [isCompleted, setIsCompleted] = useState(card.isCompleted);
  const [rating, setRating] = useState(card.rating ?? 0);
  const [estimatedCost, setEstimatedCost] = useState<number | "">(card.estimatedCost ?? "");
  const [investDate, setInvestDate] = useState(card.investDate ? new Date(card.investDate).toISOString().split("T")[0] : "");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageSubfolder, setImageSubfolder] = useState("study-cards/images");
  const [isEditImageDragOver, setIsEditImageDragOver] = useState(false);

  // Parse attachments
  const parsedAttachments: Attachment[] = card.attachments ? JSON.parse(card.attachments) : [];
  const persistedCardImages: CardImageMeta[] = parsedAttachments
    .filter((att) => att.kind === "card-image")
    .map((att) => ({
      s3Key: att.s3Key,
      imageUrl: att.url,
      subfolder: att.subfolder,
      originalName: att.originalName,
      fileSize: att.fileSize,
    }));
  const nonCardImageAttachments = parsedAttachments.filter((att) => att.kind !== "card-image");
  const visibleAttachments = nonCardImageAttachments;

  const [editedAttachments, setEditedAttachments] = useState<Attachment[]>(
    nonCardImageAttachments,
  );
  const [editAttachmentUploading, setEditAttachmentUploading] = useState(false);
  const [editAttachmentSubfolder, setEditAttachmentSubfolder] = useState(
    nonCardImageAttachments[0]?.subfolder ?? "study-cards/attachments",
  );

  const [editedImages, setEditedImages] = useState<CardImageMeta[]>(() => {
    const images: CardImageMeta[] = [...persistedCardImages];
    if (card.imageUrl && card.imageS3Key && !images.some((img) => img.s3Key === card.imageS3Key)) {
      images.unshift({
        s3Key: card.imageS3Key,
        imageUrl: card.imageUrl,
        subfolder: "study-cards/images",
        originalName: "Card image",
        fileSize: 0,
      });
    }
    return images.slice(0, MAX_CARD_IMAGES);
  });

  const currentEditTagToken = tags.split(",").at(-1)?.trimStart() ?? "";
  const selectedEditTags = tags
    .split(",")
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);
  const suggestedEditTags = SUBJECT_TAG_SUGGESTIONS.filter(
    (tag) =>
      tag.toLowerCase().includes(currentEditTagToken.toLowerCase()) &&
      !selectedEditTags.includes(tag.toLowerCase()),
  ).slice(0, 20);

  const applyEditTagSuggestion = (tag: string) => {
    const committedTags = tags
      .split(",")
      .slice(0, -1)
      .map((t: string) => t.trim())
      .filter(Boolean);
    const nextTags = [...committedTags, tag];
    setTags(`${nextTags.join(", ")}, `);
    setShowEditTagSuggestions(false);
  };

  const uploadEditedImage = async (file: File) => {
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subfolder", imageSubfolder);

      const res = await fetch("/api/upload-card-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = (await res.json()) as {
        s3Key: string;
        imageUrl: string;
        subfolder: string;
        compressedSize: number;
      };
      return {
        s3Key: data.s3Key,
        imageUrl: data.imageUrl,
        subfolder: data.subfolder,
        originalName: file.name,
        fileSize: data.compressedSize,
      } satisfies CardImageMeta;
    } catch {
      alert("Image upload failed");
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  const uploadManyEditedImages = async (files: File[]) => {
    const remaining = MAX_CARD_IMAGES - editedImages.length;
    if (remaining <= 0) {
      alert(`You can upload up to ${MAX_CARD_IMAGES} images per card.`);
      return;
    }

    for (const file of files.slice(0, remaining)) {
      const uploaded = await uploadEditedImage(file);
      if (uploaded) {
        setEditedImages((prev) => [...prev, uploaded]);
      }
    }
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadManyEditedImages(Array.from(files));
    e.target.value = "";
  };

  const removeEditedImage = (s3Key: string) => {
    setEditedImages((prev) => prev.filter((img) => img.s3Key !== s3Key));
  };

  const handleEditImageDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsEditImageDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (droppedFiles.length > 0) {
      await uploadManyEditedImages(droppedFiles);
    }
  };

  const handleEditAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setEditAttachmentUploading(true);

    try {
      const uploadedAttachments: Attachment[] = [];
      const failedFiles: string[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subfolder", editAttachmentSubfolder);

        try {
          const res = await fetch("/api/upload-attachment", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            failedFiles.push(file.name);
            continue;
          }

          const data = (await res.json()) as Attachment;
          uploadedAttachments.push(data);
        } catch {
          failedFiles.push(file.name);
        }
      }

      if (uploadedAttachments.length > 0) {
        setEditedAttachments((prev) => [...prev, ...uploadedAttachments]);
      }

      if (failedFiles.length > 0) {
        alert(`Some files failed to upload: ${failedFiles.join(", ")}`);
      }
    } finally {
      setEditAttachmentUploading(false);
      e.target.value = "";
    }
  };

  const removeEditedAttachment = (index: number) => {
    setEditedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const sanitizedDescription = sanitizeDescriptionHtml(description);
    if (!title.trim() || !getDescriptionPlainText(sanitizedDescription)) return;

    const cardImageAttachments: Attachment[] = editedImages.map((img, index) => ({
      fileName: `card-image-${index + 1}.webp`,
      originalName: img.originalName,
      mimeType: "image/webp",
      fileSize: img.fileSize,
      s3Key: img.s3Key,
      url: img.imageUrl,
      subfolder: img.subfolder,
      kind: "card-image",
    }));

    onSave({
      title,
      description: sanitizedDescription,
      referenceUrl: referenceUrl || undefined,
      youtubeUrl: youtubeUrl || undefined,
      imageUrl: editedImages[0]?.imageUrl,
      imageS3Key: editedImages[0]?.s3Key,
      attachments:
        [...editedAttachments, ...cardImageAttachments].length > 0
          ? JSON.stringify([...editedAttachments, ...cardImageAttachments])
          : undefined,
      category: category || undefined,
      difficulty,
      tags: tags || undefined,
      notes: notes || undefined,
      isCompleted,
      rating: rating || undefined,
      estimatedCost: estimatedCost === "" ? undefined : Number(estimatedCost),
      investDate: investDate || undefined,
    });
  };

  const embedUrl = card.youtubeUrl ? getYoutubeEmbedUrl(card.youtubeUrl) : null;

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 shadow-xl ring-2 ring-violet-500">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Edit Study Card</h3>
            <button
              onClick={onCancel}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Card title..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-medium focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setDescription((e.currentTarget as HTMLDivElement).innerHTML)}
            dangerouslySetInnerHTML={{ __html: getDescriptionEditorHtml(description) }}
            className="min-h-24 whitespace-pre-wrap rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <p className="text-xs text-gray-500">Paste rich text here to keep font colors and line breaks.</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Card Image</label>
            <div className="mb-2 flex items-center gap-2">
              <Folder className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={imageSubfolder}
                onChange={(e) => setImageSubfolder(e.target.value)}
                placeholder="Folder path (e.g., study-cards/images)"
                className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>
            {editedImages.length > 0 && (
              <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {editedImages.map((img) => (
                  <div key={img.s3Key} className="relative overflow-hidden rounded-lg border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt={img.originalName} className="aspect-video w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeEditedImage(img.s3Key)}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 shadow hover:bg-white"
                    >
                      <X className="h-3 w-3 text-gray-700" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsEditImageDragOver(true);
              }}
              onDragLeave={() => setIsEditImageDragOver(false)}
              onDrop={handleEditImageDrop}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-sm transition-colors ${
                isEditImageDragOver
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-gray-300 text-gray-500 hover:border-violet-400 hover:bg-violet-50/50"
              }`}
            >
              {imageUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading image...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4" />
                  Drag & drop or upload images ({editedImages.length}/{MAX_CARD_IMAGES})
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleEditImageUpload}
                disabled={imageUploading || editedImages.length >= MAX_CARD_IMAGES}
              />
            </label>
          </div>
          <input
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="Reference URL (optional)..."
            type="url"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="YouTube URL (optional)..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Attachments
              <span className="ml-1 text-xs font-normal text-gray-400">
                (PDF, Word, images, videos)
              </span>
            </label>
            <div className="mb-2 flex items-center gap-2">
              <Folder className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={editAttachmentSubfolder}
                onChange={(e) => setEditAttachmentSubfolder(e.target.value)}
                placeholder="Folder path for attachments"
                className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>

            {editedAttachments.length > 0 && (
              <div className="mb-2 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2">
                {editedAttachments.map((att, idx) => {
                  const Icon = getAttachmentIcon(att.mimeType);
                  return (
                    <div
                      key={att.s3Key}
                      className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-violet-500" />
                      <span className="min-w-0 flex-1 truncate text-gray-700">
                        {att.originalName}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatFileSize(att.fileSize)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEditedAttachment(idx)}
                        className="shrink-0 rounded p-0.5 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 transition-colors hover:border-violet-400 hover:bg-violet-50/50">
              {editAttachmentUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading attachments...
                </>
              ) : (
                <>
                  <Paperclip className="h-4 w-4" />
                  Add more attachments
                </>
              )}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleEditAttachmentUpload}
                disabled={editAttachmentUploading}
              />
            </label>
          </div>
          <input
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="Estimated Cost (optional)..."
            type="number"
            min="0"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={investDate}
            onChange={(e) => setInvestDate(e.target.value)}
            placeholder="Invest Date (optional)..."
            type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tags</label>
            <div className="relative">
              <input
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                  setShowEditTagSuggestions(true);
                }}
                onFocus={() => setShowEditTagSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowEditTagSuggestions(false), 120);
                }}
                placeholder="algebra, electricity, botany, oceanography"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />

              {showEditTagSuggestions && suggestedEditTags.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                  {suggestedEditTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyEditTagSuggestion(tag);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-violet-50"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Add many tags with comma separation. You can pick suggestions or type your own.
            </p>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Personal notes..."
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-gray-700">Completed</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-amber-400 hover:text-amber-500"
                >
                  {star <= rating ? (
                    <Star className="h-4 w-4 fill-current" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={imageUploading || editAttachmentUploading}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div
        onClick={onView}
        className="flex cursor-pointer items-center gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md"
      >
        {card.imageUrl && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={card.imageUrl}
              alt={card.title}
              fill
              className="object-cover"
              sizes="64px"
              unoptimized
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-gray-900">{card.title}</h3>
              <div
                className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-600"
                dangerouslySetInnerHTML={{ __html: getDescriptionHtml(card.description) }}
              />
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                {card.category && <span>{card.category}</span>}
                <span className="capitalize">{card.difficulty}</span>
                {card.tags && <span>{card.tags}</span>}
                <span>{format(new Date(card.createdAt), "MMM d")}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {card.isCompleted && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {card.rating > 0 && (
                <div className="flex items-center gap-0.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-medium text-gray-600">
                    {card.rating}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {card.referenceUrl && (
            <a
              href={card.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {card.youtubeUrl && (
            <a
              href={card.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
            >
              <Play className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onView}
      className="group relative cursor-pointer rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md"
    >
      {/* Header with actions */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded-full bg-white/90 p-1.5 shadow-sm hover:bg-white"
        >
          <Edit className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-full bg-white/90 p-1.5 shadow-sm hover:bg-white"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </button>
      </div>

      {/* Status badges */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
        {card.isCompleted && (
          <div className="rounded-full bg-green-500 p-1">
            <CheckCircle2 className="h-3 w-3 text-white" />
          </div>
        )}
        {card.rating > 0 && (
          <div className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-amber-700">
              {card.rating}
            </span>
          </div>
        )}
      </div>

      {/* Image or Video */}
      <div className="relative aspect-video overflow-hidden rounded-t-xl bg-gray-100">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            title={card.title}
            className="h-full w-full"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-50 to-rose-50">
            <BookOpen className="h-12 w-12 text-violet-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{card.title}</h3>
        <div
          className="mt-2 whitespace-pre-wrap text-sm text-gray-600 line-clamp-3"
          dangerouslySetInnerHTML={{ __html: getDescriptionHtml(card.description) }}
        />

        {/* Tags and metadata */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {card.category && (
            <span className="rounded-full bg-violet-100 px-2 py-1 font-medium text-violet-700">
              {card.category}
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600 capitalize">
            {card.difficulty}
          </span>
          {card.estimatedCost !== null && card.estimatedCost !== undefined && card.estimatedCost > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-700">
              ${card.estimatedCost.toLocaleString()}
            </span>
          )}
          {card.investDate && (
            <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-700">
              {format(new Date(card.investDate), "MMM d, yyyy")}
            </span>
          )}
          {card.youtubeUrl && (
            <a
              href={card.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-medium text-red-700 hover:bg-red-200"
            >
              <Play className="h-3 w-3" />
              Video
            </a>
          )}
          {card.referenceUrl && (
            <a
              href={card.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 font-medium text-violet-700 hover:bg-violet-200"
            >
              <ExternalLink className="h-3 w-3" />
              Link
            </a>
          )}
        </div>

        {/* Tags */}
        {card.tags && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.tags.split(",").map((tag: string, idx: number) => (
              <span
                key={idx}
                className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        )}

        {/* Attachments */}
        {visibleAttachments.length > 0 && (
          <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-2">
            <p className="mb-1 text-xs font-medium text-gray-500">Attachments:</p>
            <div className="space-y-1">
              {visibleAttachments.map((att: Attachment) => {
                const Icon = getAttachmentIcon(att.mimeType);
                return (
                  <a
                    key={att.s3Key}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs hover:bg-violet-50"
                  >
                    <Icon className="h-3 w-3 text-violet-500" />
                    <span className="flex-1 truncate text-gray-700">{att.originalName}</span>
                    <span className="text-gray-400">{formatFileSize(att.fileSize)}</span>
                    <Download className="h-3 w-3 text-gray-400" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {card.notes && (
          <div className="mt-3 rounded-lg bg-amber-50 p-2">
            <p className="text-xs text-amber-800 italic">{card.notes}</p>
          </div>
        )}

        {/* Date */}
        <p className="mt-3 text-xs text-gray-400">
          {format(new Date(card.createdAt), "MMM d, yyyy")}
        </p>
      </div>
    </div>
  );
}

interface Attachment {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  url: string;
  subfolder?: string;
  kind?: "card-image" | "attachment";
}

interface CardImageMeta {
  s3Key: string;
  imageUrl: string;
  subfolder?: string;
  originalName: string;
  fileSize: number;
}

const MAX_CARD_IMAGES = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.startsWith("video/")) return FileVideo;
  return FileText;
}

interface CreateCardFormProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}

function CreateCardForm({ onClose, onSubmit, isSubmitting }: CreateCardFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [tags, setTags] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [notes, setNotes] = useState("");
  const [estimatedCost, setEstimatedCost] = useState<number | "">("");
  const [investDate, setInvestDate] = useState("");
  const [subfolder, setSubfolder] = useState("study-cards/images");

  const [cardImages, setCardImages] = useState<CardImageMeta[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [isCreateImageDragOver, setIsCreateImageDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentSubfolder, setAttachmentSubfolder] = useState("study-cards/attachments");

  const currentTagToken = tags.split(",").at(-1)?.trimStart() ?? "";
  const selectedTags = tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const suggestedTags = SUBJECT_TAG_SUGGESTIONS.filter(
    (tag) =>
      tag.toLowerCase().includes(currentTagToken.toLowerCase()) &&
      !selectedTags.includes(tag.toLowerCase()),
  ).slice(0, 20);

  const applyTagSuggestion = (tag: string) => {
    const committedTags = tags
      .split(",")
      .slice(0, -1)
      .map((t) => t.trim())
      .filter(Boolean);
    const nextTags = [...committedTags, tag];
    setTags(`${nextTags.join(", ")}, `);
    setShowTagSuggestions(false);
  };

  // Handle clipboard paste
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!pasteMode) return;
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const uploaded = await uploadImageFile(file);
          if (uploaded) {
            setCardImages((prev) =>
              prev.length >= MAX_CARD_IMAGES ? prev : [...prev, uploaded],
            );
          }
        }
      }
    }
    setPasteMode(false);
  }, [pasteMode]);

  useEffect(() => {
    if (pasteMode) {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }
  }, [handlePaste, pasteMode]);

  const uploadImageFile = async (file: File) => {
    setImageUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subfolder", subfolder);

      const res = await fetch("/api/upload-card-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = (await res.json()) as {
        s3Key: string;
        imageUrl: string;
        subfolder: string;
        compressedSize: number;
      };
      return {
        s3Key: data.s3Key,
        imageUrl: data.imageUrl,
        subfolder: data.subfolder,
        originalName: file.name,
        fileSize: data.compressedSize,
      } satisfies CardImageMeta;
    } catch {
      alert("Image upload failed");
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  const uploadManyCardImages = async (files: File[]) => {
    const remaining = MAX_CARD_IMAGES - cardImages.length;
    if (remaining <= 0) {
      alert(`You can upload up to ${MAX_CARD_IMAGES} images per card.`);
      return;
    }

    for (const file of files.slice(0, remaining)) {
      const uploaded = await uploadImageFile(file);
      if (uploaded) {
        setCardImages((prev) => [...prev, uploaded]);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadManyCardImages(Array.from(files));
    e.target.value = "";
  };

  const removeCardImage = (s3Key: string) => {
    setCardImages((prev) => prev.filter((img) => img.s3Key !== s3Key));
  };

  const handleCreateImageDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsCreateImageDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (droppedFiles.length > 0) {
      await uploadManyCardImages(droppedFiles);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAttachmentUploading(true);

    try {
      const uploadedAttachments: Attachment[] = [];
      const failedFiles: string[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("subfolder", attachmentSubfolder);

        try {
          const res = await fetch("/api/upload-attachment", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            failedFiles.push(file.name);
            continue;
          }

          const data = (await res.json()) as Attachment;
          uploadedAttachments.push(data);
        } catch {
          failedFiles.push(file.name);
        }
      }

      if (uploadedAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...uploadedAttachments]);
      }

      if (failedFiles.length > 0) {
        alert(`Some files failed to upload: ${failedFiles.join(", ")}`);
      }
    } finally {
      setAttachmentUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedDescription = sanitizeDescriptionHtml(description);
    if (!title.trim() || !getDescriptionPlainText(sanitizedDescription)) return;

    const cardImageAttachments: Attachment[] = cardImages.map((img, index) => ({
      fileName: `card-image-${index + 1}.webp`,
      originalName: img.originalName,
      mimeType: "image/webp",
      fileSize: img.fileSize,
      s3Key: img.s3Key,
      url: img.imageUrl,
      subfolder: img.subfolder,
      kind: "card-image",
    }));
    const combinedAttachments = [...attachments, ...cardImageAttachments];

    onSubmit({
      title: title.trim(),
      description: sanitizedDescription,
      referenceUrl: referenceUrl.trim() || undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      imageUrl: cardImages[0]?.imageUrl,
      imageS3Key: cardImages[0]?.s3Key,
      attachments: combinedAttachments.length > 0 ? JSON.stringify(combinedAttachments) : undefined,
      category: category.trim() || undefined,
      difficulty,
      tags: tags.trim() || undefined,
      notes: notes.trim() || undefined,
      estimatedCost: estimatedCost === "" ? undefined : Number(estimatedCost),
      investDate: investDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Create Study Card</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter card title..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <div
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setDescription((e.currentTarget as HTMLDivElement).innerHTML)}
              dangerouslySetInnerHTML={{ __html: getDescriptionEditorHtml(description) }}
              className="min-h-28 whitespace-pre-wrap rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <p className="mt-1 text-xs text-gray-500">Paste or type rich text to preserve colors and paragraph spacing.</p>
          </div>

          {/* Card Image Upload with Subfolder & Clipboard Paste */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Card Image
              <span className="ml-1 text-xs font-normal text-gray-400">(auto-compressed to WebP &lt; 100KB)</span>
            </label>
            
            {/* Subfolder Input */}
            <div className="mb-2 flex items-center gap-2">
              <Folder className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={subfolder}
                onChange={(e) => setSubfolder(e.target.value)}
                placeholder="Folder path (e.g., study-cards/math)"
                className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>

            {cardImages.length > 0 && (
              <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cardImages.map((img) => (
                  <div key={img.s3Key} className="relative overflow-hidden rounded-lg border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt={img.originalName} className="aspect-video w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeCardImage(img.s3Key)}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 shadow hover:bg-white"
                    >
                      <X className="h-3 w-3 text-gray-700" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsCreateImageDragOver(true);
                }}
                onDragLeave={() => setIsCreateImageDragOver(false)}
                onDrop={handleCreateImageDrop}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors ${
                  isCreateImageDragOver
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-gray-300 text-gray-500 hover:border-violet-400 hover:bg-violet-50/50"
                }`}
              >
                {imageUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5" />
                    Drag & drop or click to upload images ({cardImages.length}/{MAX_CARD_IMAGES})
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={imageUploading || cardImages.length >= MAX_CARD_IMAGES}
                />
              </label>
              <button
                type="button"
                onClick={() => setPasteMode(true)}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm transition-colors ${
                  pasteMode
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-gray-300 text-gray-500 hover:border-violet-400 hover:bg-violet-50/50"
                }`}
              >
                <ClipboardPaste className="h-5 w-5" />
                {pasteMode ? "Press Ctrl+V to paste image" : "Click then paste image (Ctrl+V)"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference URL
            </label>
            <input
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://example.com/article"
              type="url"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              YouTube URL
            </label>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              type="url"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimated Cost
            </label>
            <input
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Enter estimated cost (e.g., 100)"
              type="number"
              min="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invest Date
            </label>
            <input
              value={investDate}
              onChange={(e) => setInvestDate(e.target.value)}
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Attachments Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachments
              <span className="ml-1 text-xs font-normal text-gray-400">(PDF, Word, images, videos — original quality)</span>
            </label>
            
            {/* Attachment Subfolder Input */}
            <div className="mb-2 flex items-center gap-2">
              <Folder className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={attachmentSubfolder}
                onChange={(e) => setAttachmentSubfolder(e.target.value)}
                placeholder="Folder path for attachments"
                className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>

            {attachments.length > 0 && (
              <div className="mb-2 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2">
                {attachments.map((att, idx) => {
                  const Icon = getAttachmentIcon(att.mimeType);
                  return (
                    <div
                      key={att.s3Key}
                      className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-violet-500" />
                      <span className="min-w-0 flex-1 truncate text-gray-700">
                        {att.originalName}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatFileSize(att.fileSize)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="shrink-0 rounded p-0.5 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 transition-colors hover:border-violet-400 hover:bg-violet-50/50">
              {attachmentUploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Paperclip className="h-5 w-5" />
                  Click to attach files
                </>
              )}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleAttachmentUpload}
                disabled={attachmentUploading}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Science, Math, History"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="relative">
              <input
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                  setShowTagSuggestions(true);
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowTagSuggestions(false), 120);
                }}
                placeholder="algebra, electricity, botany, oceanography"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />

              {showTagSuggestions && suggestedTags.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                  {suggestedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyTagSuggestion(tag);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-violet-50"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Suggestions appear as you type. Add as many tags as you want (comma-separated), including custom tags.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your personal notes or teaching points..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                imageUploading ||
                attachmentUploading ||
                !title.trim() ||
                !getDescriptionPlainText(description)
              }
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
