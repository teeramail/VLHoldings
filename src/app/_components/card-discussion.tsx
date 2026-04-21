"use client";

import { useState } from "react";

import { type RouterOutputs, api } from "~/trpc/react";

interface Attachment {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  url: string;
  subfolder?: string;
}

type DiscussionPost = RouterOutputs["studyCardPosts"]["listByCardId"][number];

type ComposerPayload = {
  authorName?: string;
  content: string;
  attachments?: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseAttachments(raw: string | null): Attachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Attachment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function uploadAttachments(files: File[]): Promise<{ uploaded: Attachment[]; failed: string[] }> {
  const uploaded: Attachment[] = [];
  const failed: string[] = [];

  for (const file of files) {
    try {
      const presignRes = await fetch("/api/presign-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
          subfolder: "study-cards/post-attachments",
        }),
      });

      if (!presignRes.ok) {
        failed.push(file.name);
        continue;
      }

      const presignData = (await presignRes.json()) as Attachment & { uploadUrl: string };

      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (!uploadRes.ok) {
        failed.push(file.name);
        continue;
      }

      uploaded.push({
        fileName: presignData.fileName,
        originalName: presignData.originalName,
        mimeType: presignData.mimeType,
        fileSize: presignData.fileSize,
        s3Key: presignData.s3Key,
        url: presignData.url,
        subfolder: presignData.subfolder,
      });
    } catch {
      failed.push(file.name);
    }
  }

  return { uploaded, failed };
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment) => {
        const isLink = attachment.mimeType === "text/x-url";
        return (
          <a
            key={`${attachment.s3Key}-${attachment.fileName}`}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm hover:border-violet-200 hover:bg-violet-50"
          >
            <span className="truncate pr-3 text-gray-700">
              {isLink ? `Link: ${attachment.originalName}` : attachment.originalName}
            </span>
            {!isLink && <span className="shrink-0 text-xs text-gray-500">{formatFileSize(attachment.fileSize)}</span>}
          </a>
        );
      })}
    </div>
  );
}

function PostComposer({
  onSubmit,
  isSubmitting,
  submitLabel,
  placeholder,
  onCancel,
}: {
  onSubmit: (payload: ComposerPayload) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  placeholder: string;
  onCancel?: () => void;
}) {
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleAddLink = () => {
    const normalized = normalizeUrl(linkUrl);
    if (!normalized) {
      alert("Please enter a valid URL");
      return;
    }

    const parsed = new URL(normalized);
    setAttachments((prev) => [
      ...prev,
      {
        fileName: parsed.hostname,
        originalName: parsed.hostname,
        mimeType: "text/x-url",
        fileSize: 0,
        s3Key: normalized,
        url: normalized,
        subfolder: "external-links",
      },
    ]);
    setLinkUrl("");
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const { uploaded, failed } = await uploadAttachments(Array.from(files));
    setUploading(false);

    if (uploaded.length > 0) {
      setAttachments((prev) => [...prev, ...uploaded]);
    }
    if (failed.length > 0) {
      alert(`Some files failed to upload: ${failed.join(", ")}`);
    }

    event.target.value = "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    await onSubmit({
      authorName: authorName.trim() || undefined,
      content: trimmedContent,
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : undefined,
    });

    setAuthorName("");
    setContent("");
    setLinkUrl("");
    setAttachments([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          placeholder="Your name (optional)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          required
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="https://facebook.com/..."
          className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="button"
          onClick={handleAddLink}
          className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
        >
          Add link
        </button>
        <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {uploading ? "Uploading..." : "Attach file"}
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          {attachments.map((attachment, index) => (
            <div key={`${attachment.s3Key}-${index}`} className="flex items-center justify-between text-sm">
              <span className="truncate pr-3 text-gray-700">{attachment.originalName}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_item, itemIndex) => itemIndex !== index))}
                className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || uploading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function CardDiscussion({ cardId, hideHeader = false }: { cardId: number; hideHeader?: boolean }) {
  const [replyTargetId, setReplyTargetId] = useState<number | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const utils = api.useUtils();

  const postsQuery = api.studyCardPosts.listByCardId.useQuery({ cardId });

  const createPostMutation = api.studyCardPosts.create.useMutation({
    onSuccess: () => {
      void utils.studyCardPosts.listByCardId.invalidate({ cardId });
    },
  });

  const answerPostMutation = api.studyCardPosts.answer.useMutation({
    onSuccess: () => {
      void utils.studyCardPosts.listByCardId.invalidate({ cardId });
    },
  });

  const posts = postsQuery.data ?? [];
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const handleCreatePost = async (payload: ComposerPayload) => {
    await createPostMutation.mutateAsync({ cardId, ...payload });
  };

  const handleAnswerPost = async (postId: number, payload: ComposerPayload) => {
    await answerPostMutation.mutateAsync({ postId, ...payload });
    setReplyTargetId(null);
  };

  const content = (
    <div className="space-y-4">
      {!hideHeader && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Discussion</h2>
          <p className="text-sm text-gray-500">Post updates, answer, and attach files or links.</p>
        </div>
      )}

      {postsQuery.isLoading ? (
        <p className="text-sm text-gray-500">Loading posts...</p>
      ) : sortedPosts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          No posts yet. Start the conversation for this card.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedPosts.map((post) => {
            const attachments = parseAttachments(post.attachments);
            const topic = post.content
              .split(/\r?\n/)
              .map((line) => line.trim())
              .find(Boolean) ?? "Untitled topic";
            const isExpanded = expandedPostId === post.id;
            return (
              <article key={post.id} className="rounded-xl border border-gray-200 p-4">
                <button
                  type="button"
                  onClick={() => {
                    const isClosing = expandedPostId === post.id;
                    setExpandedPostId(isClosing ? null : post.id);
                    if (isClosing || replyTargetId !== post.id) {
                      setReplyTargetId(null);
                    }
                  }}
                  className="w-full rounded-md px-1 py-1 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  {topic}
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-800">{post.authorName}</p>
                      <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{post.content}</p>
                    <AttachmentList attachments={attachments} />

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyTargetId((current) => (current === post.id ? null : post.id))}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {replyTargetId === post.id ? "Hide reply form" : "Reply"}
                      </button>
                    </div>

                    {replyTargetId === post.id && (
                      <div className="mt-3">
                        <PostComposer
                          onSubmit={async (payload) => handleAnswerPost(post.id, payload)}
                          isSubmitting={answerPostMutation.isPending}
                          submitLabel="Post reply"
                          placeholder="Write your reply..."
                          onCancel={() => setReplyTargetId(null)}
                        />
                      </div>
                    )}

                    {post.replies.length > 0 && (
                      <div className="mt-4 space-y-3 border-l-2 border-violet-100 pl-4">
                        {post.replies.map((reply) => {
                          const replyAttachments = parseAttachments(reply.attachments);
                          return (
                            <div key={reply.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-gray-800">{reply.authorName}</p>
                                <p className="text-xs text-gray-400">{new Date(reply.createdAt).toLocaleString()}</p>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{reply.content}</p>
                              <AttachmentList attachments={replyAttachments} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <PostComposer
        onSubmit={handleCreatePost}
        isSubmitting={createPostMutation.isPending}
        submitLabel="Post"
        placeholder="Write a post about this card..."
      />
    </div>
  );

  if (hideHeader) {
    return content;
  }

  return (
    <section className="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      {content}
    </section>
  );
}
